import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import * as bcrypt from 'bcrypt';
import {
  CreateProductMpDto,
  UpdateProductMpDto,
  CreateProductPfDto,
  UpdateProductPfDto,
  CreateClientDto,
  UpdateClientDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateUserDto,
  UpdateUserDto,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  StockAdjustmentDto,
} from './dto/admin.dto';

/**
 * Admin Service - Full CRUD operations for ADMIN role
 *
 * Provides data access and mutations for admin dashboard.
 * All mutation operations are protected by ADMIN role guard.
 */
@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ALGERIAN FISCAL HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcule le taux de timbre fiscal selon la législation algérienne
   * - TTC ≤ 30 000 DA → 1%
   * - 30 000 < TTC ≤ 100 000 DA → 1.5%
   * - TTC > 100 000 DA → 2%
   */
  private calculateTimbreRate(totalTtc: number): number {
    if (totalTtc <= 3000000) return 0.01;        // ≤ 30,000 DA (centimes)
    if (totalTtc <= 10000000) return 0.015;      // ≤ 100,000 DA (centimes)
    return 0.02;                                  // > 100,000 DA
  }

  /**
   * Calcule le timbre fiscal pour un montant TTC
   * Appliqué uniquement pour les paiements en espèces
   */
  private calculateTimbreFiscal(totalTtc: number, paymentMethod: string, applyTimbre: boolean): { amount: number; rate: number } {
    if (!applyTimbre || paymentMethod !== 'ESPECES') {
      return { amount: 0, rate: 0 };
    }
    const rate = this.calculateTimbreRate(totalTtc);
    const amount = Math.round(totalTtc * rate);
    return { amount, rate };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK OVERVIEW - Calculé depuis les mouvements (jamais de stock en dur)
  // ═══════════════════════════════════════════════════════════════════════════

  private async calculateStockFromMovements(
    productType: 'MP' | 'PF',
    productId: number,
  ): Promise<number> {
    const movements = await this.prisma.stockMovement.groupBy({
      by: ['movementType'],
      where: {
        productType,
        ...(productType === 'MP' ? { productMpId: productId } : { productPfId: productId }),
        isDeleted: false,
      },
      _sum: { quantity: true },
    });

    let totalIn = 0;
    let totalOut = 0;

    for (const m of movements) {
      if (m.movementType === 'IN') {
        totalIn = m._sum.quantity || 0;
      } else {
        totalOut = m._sum.quantity || 0;
      }
    }

    return totalIn - totalOut;
  }

  private getStockStatus(stock: number, minStock: number): 'OK' | 'ALERTE' | 'RUPTURE' {
    if (stock === 0) return 'RUPTURE';
    if (stock <= minStock) return 'ALERTE';
    return 'OK';
  }

  // V6: Batch queries instead of N+1
  async getStockMp() {
    const products = await this.prisma.productMp.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    const productIds = products.map((p) => p.id);

    // 1 batch query: stock per product via groupBy
    const allMovements = await this.prisma.stockMovement.groupBy({
      by: ['productMpId', 'movementType'],
      where: { productType: 'MP', productMpId: { in: productIds }, isDeleted: false },
      _sum: { quantity: true },
    });

    const stockMap = new Map<number, number>();
    for (const m of allMovements) {
      if (!m.productMpId) continue;
      const prev = stockMap.get(m.productMpId) || 0;
      const qty = m._sum.quantity || 0;
      stockMap.set(m.productMpId, prev + (m.movementType === 'IN' ? qty : -qty));
    }

    // 1 batch query: last movement per product
    const lastMovements = await this.prisma.stockMovement.groupBy({
      by: ['productMpId'],
      where: { productType: 'MP', productMpId: { in: productIds }, isDeleted: false },
      _max: { createdAt: true },
    });

    const lastMoveMap = new Map<number, Date>();
    for (const m of lastMovements) {
      if (m.productMpId && m._max.createdAt) {
        lastMoveMap.set(m.productMpId, m._max.createdAt);
      }
    }

    return products.map((p) => {
      const totalStock = stockMap.get(p.id) || 0;
      const status = this.getStockStatus(totalStock, p.minStock);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        minStock: p.minStock,
        totalStock,
        status,
        isLowStock: status !== 'OK',
        lastMovementAt: lastMoveMap.get(p.id) || null,
      };
    });
  }

  // V6: Batch queries instead of N+1
  async getStockPf() {
    const products = await this.prisma.productPf.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    const productIds = products.map((p) => p.id);

    const allMovements = await this.prisma.stockMovement.groupBy({
      by: ['productPfId', 'movementType'],
      where: { productType: 'PF', productPfId: { in: productIds }, isDeleted: false },
      _sum: { quantity: true },
    });

    const stockMap = new Map<number, number>();
    for (const m of allMovements) {
      if (!m.productPfId) continue;
      const prev = stockMap.get(m.productPfId) || 0;
      const qty = m._sum.quantity || 0;
      stockMap.set(m.productPfId, prev + (m.movementType === 'IN' ? qty : -qty));
    }

    const lastMovements = await this.prisma.stockMovement.groupBy({
      by: ['productPfId'],
      where: { productType: 'PF', productPfId: { in: productIds }, isDeleted: false },
      _max: { createdAt: true },
    });

    const lastMoveMap = new Map<number, Date>();
    for (const m of lastMovements) {
      if (m.productPfId && m._max.createdAt) {
        lastMoveMap.set(m.productPfId, m._max.createdAt);
      }
    }

    return products.map((p) => {
      const totalStock = stockMap.get(p.id) || 0;
      const status = this.getStockStatus(totalStock, p.minStock);
      const stockValue = totalStock * p.priceHt;
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        priceHt: p.priceHt,
        minStock: p.minStock,
        totalStock,
        stockValue,
        status,
        isLowStock: status !== 'OK',
        lastMovementAt: lastMoveMap.get(p.id) || null,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUVEMENTS DE STOCK - Historique
  // ═══════════════════════════════════════════════════════════════════════════

  async getMovementsMp(productId: number, limit = 50) {
    return this.prisma.stockMovement.findMany({
      where: { productMpId: productId, isDeleted: false },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getMovementsPf(productId: number, limit = 50) {
    return this.prisma.stockMovement.findMany({
      where: { productPfId: productId, isDeleted: false },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ALERTES STOCK
  // ═══════════════════════════════════════════════════════════════════════════

  // A13: Single fetch for both alerts and value to avoid redundant queries
  async getStockAlerts() {
    const [stockMp, stockPf] = await Promise.all([
      this.getStockMp(),
      this.getStockPf(),
    ]);

    return {
      mpRupture: stockMp.filter((s: { status: string }) => s.status === 'RUPTURE'),
      mpAlerte: stockMp.filter((s: { status: string }) => s.status === 'ALERTE'),
      pfRupture: stockPf.filter((s: { status: string }) => s.status === 'RUPTURE'),
      pfAlerte: stockPf.filter((s: { status: string }) => s.status === 'ALERTE'),
      totalMpAlerts: stockMp.filter((s: { status: string }) => s.status !== 'OK').length,
      totalPfAlerts: stockPf.filter((s: { status: string }) => s.status !== 'OK').length,
      // A13: Include stock value to avoid getTotalStockValue needing another call
      pfStockValue: stockPf.reduce((sum: number, s: { stockValue?: number }) => sum + (s.stockValue || 0), 0),
    };
  }

  async getTotalStockValue() {
    // A13: Reuse getStockAlerts to avoid duplicate getStockPf() call
    const alerts = await this.getStockAlerts();
    return {
      pf: alerts.pfStockValue,
      total: alerts.pfStockValue,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICES & SALES
  // ═══════════════════════════════════════════════════════════════════════════

  async getInvoices(options: { page?: number; limit?: number; status?: string; search?: string }) {
    const { page = 1, limit = 20, status, search } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    // V11: Server-side search by reference or client name
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          client: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              productPf: { select: { id: true, code: true, name: true } },
            },
          },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTION
  // ═══════════════════════════════════════════════════════════════════════════

  async getProductionOrders(options: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        include: {
          consumptions: {
            include: {
              productMp: { select: { id: true, code: true, name: true } },
            },
          },
          lots: { select: { id: true, lotNumber: true, quantityRemaining: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productionOrder.count({ where }),
    ]);

    return {
      data: orders,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Complète un ordre de production
   * - Vérifie le stock MP disponible
   * - Crée les mouvements OUT pour les MP consommées
   * - Crée le mouvement IN pour le PF produit
   * - Met à jour le statut de l'ordre
   */
  async completeProduction(orderId: number, quantityProduced: number, userId: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        consumptions: { include: { productMp: true } },
        productPf: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Ordre de production non trouvé');
    }

    if (order.status === 'COMPLETED') {
      throw new BadRequestException('Cet ordre de production est déjà terminé');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Cet ordre de production est annulé');
    }

    // A9: Batch stock verification (was N+1 queries, now 1 groupBy)
    const mpIds = order.consumptions.map(c => c.productMpId);
    const stockGroups = await this.prisma.stockMovement.groupBy({
      by: ['productMpId', 'movementType'],
      where: { productType: 'MP', productMpId: { in: mpIds }, isDeleted: false },
      _sum: { quantity: true },
    });

    // Build stock map
    const stockMap = new Map<number, number>();
    for (const g of stockGroups) {
      if (!g.productMpId) continue;
      const current = stockMap.get(g.productMpId) || 0;
      const qty = g._sum.quantity || 0;
      stockMap.set(g.productMpId, current + (g.movementType === 'IN' ? qty : -qty));
    }

    for (const consumption of order.consumptions) {
      const stockMp = stockMap.get(consumption.productMpId) || 0;
      if (stockMp < consumption.quantityPlanned) {
        throw new BadRequestException(
          `Stock MP insuffisant pour ${consumption.productMp.name}: disponible ${stockMp}, requis ${consumption.quantityPlanned}`,
        );
      }
    }

    // Transaction: consommer MP + créer PF
    return this.prisma.$transaction(async (tx) => {
      // 1. Créer mouvements OUT pour chaque MP consommée
      for (const consumption of order.consumptions) {
        await tx.stockMovement.create({
          data: {
            movementType: 'OUT',
            productType: 'MP',
            origin: 'PRODUCTION_OUT',
            productMpId: consumption.productMpId,
            quantity: consumption.quantityPlanned,
            referenceType: 'PRODUCTION',
            referenceId: order.id,
            reference: order.reference,
            userId,
            note: `Consommation production ${order.reference} - ${consumption.productMp.name}`,
          },
        });
      }

      // 2. Créer mouvement IN pour PF produit
      await tx.stockMovement.create({
        data: {
          movementType: 'IN',
          productType: 'PF',
          origin: 'PRODUCTION_IN',
          productPfId: order.productPfId,
          quantity: quantityProduced,
          unitCost: order.productPf.priceHt,
          referenceType: 'PRODUCTION',
          referenceId: order.id,
          reference: order.reference,
          userId,
          note: `Production ${order.reference} - ${order.productPf.name}`,
        },
      });

      // 3. Mettre à jour ordre de production
      return tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          quantityProduced,
          completedAt: new Date(),
        },
        include: {
          productPf: true,
          consumptions: { include: { productMp: true } },
        },
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENTS & SUPPLIERS
  // ═══════════════════════════════════════════════════════════════════════════

  async getClients() {
    return this.prisma.client.findMany({
      include: {
        _count: { select: { invoices: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getClientById(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        _count: { select: { invoices: true } },
      },
    });
    if (!client) {
      throw new NotFoundException(`Client #${id} introuvable`);
    }
    return client;
  }

  async getClientHistory(
    clientId: number,
    filters: {
      year?: number;
      month?: number;
      from?: Date;
      to?: Date;
      page: number;
      limit: number;
    },
  ) {
    // Vérifier que le client existe
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, code: true, name: true, type: true },
    });

    if (!client) {
      throw new NotFoundException(`Client #${clientId} introuvable`);
    }

    // Construire les conditions de date
    const dateConditions: any = {};
    
    if (filters.year) {
      const startOfYear = new Date(filters.year, 0, 1);
      const endOfYear = new Date(filters.year, 11, 31, 23, 59, 59);
      dateConditions.date = { gte: startOfYear, lte: endOfYear };
    }

    if (filters.month && filters.year) {
      const startOfMonth = new Date(filters.year, filters.month - 1, 1);
      const endOfMonth = new Date(filters.year, filters.month, 0, 23, 59, 59);
      dateConditions.date = { gte: startOfMonth, lte: endOfMonth };
    }

    if (filters.from || filters.to) {
      dateConditions.date = {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: new Date(filters.to.getTime() + 24 * 60 * 60 * 1000 - 1) }),
      };
    }

    const where = { clientId, ...dateConditions };

    // Compter le total
    const total = await this.prisma.invoice.count({ where });

    // Récupérer les factures paginées
    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        lines: {
          include: {
            productPf: { select: { code: true, name: true, unit: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });

    // Calculer les totaux côté serveur
    const aggregations = await this.prisma.invoice.aggregate({
      where,
      _sum: { totalHt: true, totalTva: true, totalTtc: true, netToPay: true },
      _count: true,
    });

    // Calculer quantité totale
    const allLines = await this.prisma.invoiceLine.findMany({
      where: { invoice: where },
      select: { quantity: true },
    });
    const totalQuantity = allLines.reduce((sum: number, l: { quantity: number }) => sum + l.quantity, 0);

    return {
      client,
      filters: {
        year: filters.year,
        month: filters.month,
        from: filters.from,
        to: filters.to,
      },
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
      totals: {
        invoices: total,
        totalQuantity,
        totalHt: aggregations._sum.totalHt || 0,
        totalTva: aggregations._sum.totalTva || 0,
        totalTtc: aggregations._sum.totalTtc || 0,
        netToPay: aggregations._sum.netToPay || 0,
      },
      invoices: invoices.map((inv) => ({
        id: inv.id,
        reference: inv.reference,
        date: inv.date,
        status: inv.status,
        paymentMethod: inv.paymentMethod,
        totalHt: inv.totalHt,
        totalTva: inv.totalTva,
        totalTtc: inv.totalTtc,
        netToPay: inv.netToPay,
        lines: inv.lines.map((l) => ({
          id: l.id,
          product: l.productPf,
          quantity: l.quantity,
          unitPriceHt: l.unitPriceHt,
          lineHt: l.lineHt,
        })),
      })),
    };
  }

  async getSuppliers() {
    return this.prisma.supplier.findMany({
      include: {
        _count: { select: { lots: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK MOVEMENTS (AUDIT)
  // ═══════════════════════════════════════════════════════════════════════════

  async getStockMovements(options: { page?: number; limit?: number; type?: string }) {
    const { page = 1, limit = 50, type } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) {
      where.productType = type;
    }

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          productMp: { select: { code: true, name: true } },
          productPf: { select: { code: true, name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data: movements,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS & DEVICES
  // ═══════════════════════════════════════════════════════════════════════════

  // A29: Pagination support (backward compatible — no params = all results)
  async getUsers(options?: { page?: number; limit?: number }) {
    const { page, limit } = options || {};
    const query: any = {
      select: {
        id: true,
        code: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { devices: true } },
      },
      orderBy: { createdAt: 'desc' as const },
    };
    if (page && limit) {
      query.skip = (page - 1) * limit;
      query.take = limit;
    }
    const [users, total] = await Promise.all([
      this.prisma.user.findMany(query),
      this.prisma.user.count(),
    ]);
    return { users, total, page: page || 1, limit: limit || total };
  }

  async getDevices() {
    return this.prisma.device.findMany({
      include: {
        user: { select: { id: true, code: true, firstName: true, lastName: true, role: true, isActive: true } },
        syncStates: true,
      },
      orderBy: { lastSyncAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS MP - CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async createProductMp(dto: CreateProductMpDto) {
    const existing = await this.prisma.productMp.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Produit MP avec code ${dto.code} existe déjà`);
    }
    return this.prisma.productMp.create({
      data: {
        code: dto.code,
        name: dto.name,
        unit: dto.unit,
        minStock: dto.minStock || 0,
      },
    });
  }

  async updateProductMp(id: number, dto: UpdateProductMpDto) {
    const product = await this.prisma.productMp.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Produit MP #${id} non trouvé`);
    }
    return this.prisma.productMp.update({
      where: { id },
      data: dto,
    });
  }

  // A23: Soft delete to prevent FK violations with stock movements
  async deleteProductMp(id: number) {
    const product = await this.prisma.productMp.findUnique({
      where: { id },
      include: { lots: true },
    });
    if (!product) {
      throw new NotFoundException(`Produit MP #${id} non trouvé`);
    }
    const hasStock = product.lots.some(l => l.quantityRemaining > 0);
    if (hasStock) {
      throw new BadRequestException(`Impossible de supprimer: stock existant`);
    }
    return this.prisma.productMp.update({ where: { id }, data: { isActive: false } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS PF - CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async createProductPf(dto: CreateProductPfDto) {
    const existing = await this.prisma.productPf.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Produit PF avec code ${dto.code} existe déjà`);
    }
    return this.prisma.productPf.create({
      data: {
        code: dto.code,
        name: dto.name,
        unit: dto.unit,
        priceHt: dto.priceHt,
        minStock: dto.minStock || 0,
      },
    });
  }

  async updateProductPf(id: number, dto: UpdateProductPfDto) {
    const product = await this.prisma.productPf.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Produit PF #${id} non trouvé`);
    }
    return this.prisma.productPf.update({
      where: { id },
      data: dto,
    });
  }

  // A23: Soft delete to prevent FK violations with stock movements
  async deleteProductPf(id: number) {
    const product = await this.prisma.productPf.findUnique({
      where: { id },
      include: { lots: true },
    });
    if (!product) {
      throw new NotFoundException(`Produit PF #${id} non trouvé`);
    }
    const hasStock = product.lots.some(l => l.quantityRemaining > 0);
    if (hasStock) {
      throw new BadRequestException(`Impossible de supprimer: stock existant`);
    }
    return this.prisma.productPf.update({ where: { id }, data: { isActive: false } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENTS - CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async createClient(dto: CreateClientDto) {
    const existing = await this.prisma.client.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Client avec code ${dto.code} existe déjà`);
    }
    return this.prisma.client.create({ data: dto });
  }

  async updateClient(id: number, dto: UpdateClientDto) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client #${id} non trouvé`);
    }
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async deleteClient(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true } } },
    });
    if (!client) {
      throw new NotFoundException(`Client #${id} non trouvé`);
    }
    if (client._count.invoices > 0) {
      throw new BadRequestException(`Impossible de supprimer: ${client._count.invoices} factures associées`);
    }
    return this.prisma.client.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPLIERS - CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async createSupplier(dto: CreateSupplierDto) {
    const existing = await this.prisma.supplier.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Fournisseur avec code ${dto.code} existe déjà`);
    }
    return this.prisma.supplier.create({ data: dto });
  }

  async updateSupplier(id: number, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new NotFoundException(`Fournisseur #${id} non trouvé`);
    }
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async deleteSupplier(id: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { lots: true } } },
    });
    if (!supplier) {
      throw new NotFoundException(`Fournisseur #${id} non trouvé`);
    }
    if (supplier._count.lots > 0) {
      throw new BadRequestException(`Impossible de supprimer: ${supplier._count.lots} lots associés`);
    }
    return this.prisma.supplier.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS - CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async createUser(dto: CreateUserDto) {
    const existingCode = await this.prisma.user.findUnique({ where: { code: dto.code } });
    if (existingCode) {
      throw new ConflictException(`Utilisateur avec code ${dto.code} existe déjà`);
    }
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) {
      throw new ConflictException(`Email ${dto.email} déjà utilisé`);
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        code: dto.code,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      },
      select: {
        id: true,
        code: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur non trouvé`);
    }
    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existingEmail) {
        throw new ConflictException(`Email ${dto.email} déjà utilisé`);
      }
    }
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        code: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async resetUserPassword(id: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur non trouvé`);
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  async toggleUserStatus(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur non trouvé`);
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        code: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICES - CREATE
  // ═══════════════════════════════════════════════════════════════════════════

  async createInvoice(dto: CreateInvoiceDto, userId: string) {
    // Validate client
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) {
      throw new NotFoundException(`Client #${dto.clientId} non trouvé`);
    }

    // V19: Generate reference with retry for uniqueness
    // A24: Use Algeria timezone (UTC+1) to ensure correct date
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Algiers' }));
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '').slice(2);
    let reference = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const count = await this.prisma.invoice.count({
        where: {
          createdAt: {
            gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          },
        },
      });
      reference = `F-${dateStr}-${String(count + 1 + attempt).padStart(3, '0')}`;
      const existing = await this.prisma.invoice.findFirst({ where: { reference } });
      if (!existing) break;
      if (attempt === 2) {
        // Fallback with timestamp
        reference = `F-${dateStr}-${String(count + 1).padStart(3, '0')}-${Date.now() % 1000}`;
      }
    }

    // V7: Batch fetch all products in one query instead of N+1
    const productPfIds = [...new Set(dto.lines.map((l) => l.productPfId))];
    const products = await this.prisma.productPf.findMany({
      where: { id: { in: productPfIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate all products exist
    for (const line of dto.lines) {
      if (!productMap.has(line.productPfId)) {
        throw new NotFoundException(`Produit PF #${line.productPfId} non trouvé`);
      }
    }

    // Calculate totals
    let totalHt = 0;
    const lineData: { productPfId: number; quantity: number; unitPriceHt: number; lineHt: number }[] = [];

    for (const line of dto.lines) {
      const product = productMap.get(line.productPfId)!;
      const unitPrice = line.unitPriceHt ?? product.priceHt;
      const lineHt = unitPrice * line.quantity;
      totalHt += lineHt;
      lineData.push({
        productPfId: line.productPfId,
        quantity: line.quantity,
        unitPriceHt: unitPrice,
        lineHt,
      });
    }

    // TVA 19% (Algeria)
    const totalTva = Math.round(totalHt * 0.19);
    const totalTtc = totalHt + totalTva;

    // Timbre fiscal dynamique selon législation algérienne
    const timbre = this.calculateTimbreFiscal(totalTtc, dto.paymentMethod, dto.applyTimbre ?? true);
    const timbreFiscal = timbre.amount;
    const timbreRate = timbre.rate;
    const netToPay = totalTtc + timbreFiscal;

    // Create invoice with lines
    return this.prisma.invoice.create({
      data: {
        reference,
        clientId: dto.clientId,
        date: today,
        totalHt,
        totalTva,
        totalTtc,
        timbreFiscal,
        netToPay,
        paymentMethod: dto.paymentMethod,
        status: 'DRAFT',
        userId,
        lines: {
          create: lineData,
        },
      },
      include: {
        client: true,
        lines: {
          include: { productPf: true },
        },
      },
    });
  }

  /**
   * Récupère une facture par ID avec tous les détails
   */
  async getInvoiceById(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        lines: {
          include: { productPf: true },
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException(`Facture #${id} non trouvée`);
    }
    
    // Calculer le taux de timbre pour l'affichage
    const timbreRate = invoice.timbreFiscal > 0 
      ? this.calculateTimbreRate(invoice.totalTtc) 
      : 0;
    
    return {
      ...invoice,
      timbreRate,
      timbreRatePercent: timbreRate * 100,
    };
  }

  /**
   * Met à jour une facture (uniquement si status = DRAFT)
   */
  async updateInvoice(id: number, dto: UpdateInvoiceDto, userId: string) {
    const invoice = await this.prisma.invoice.findUnique({ 
      where: { id },
      include: { lines: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Facture #${id} non trouvée`);
    }
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException(`Impossible de modifier une facture avec le statut ${invoice.status}`);
    }

    // Si des lignes sont fournies, recalculer les totaux
    if (dto.lines && dto.lines.length > 0) {
      let totalHt = 0;
      const lineData: { productPfId: number; quantity: number; unitPriceHt: number; lineHt: number }[] = [];

      // A10: Batch product fetch instead of N findUnique
      const productIds = [...new Set(dto.lines.map(l => l.productPfId))];
      const products = await this.prisma.productPf.findMany({
        where: { id: { in: productIds } },
      });
      const productMap = new Map(products.map(p => [p.id, p]));

      for (const line of dto.lines) {
        const product = productMap.get(line.productPfId);
        if (!product) {
          throw new NotFoundException(`Produit PF #${line.productPfId} non trouvé`);
        }
        const unitPrice = line.unitPriceHt ?? product.priceHt;
        const lineHt = unitPrice * line.quantity;
        totalHt += lineHt;
        lineData.push({
          productPfId: line.productPfId,
          quantity: line.quantity,
          unitPriceHt: unitPrice,
          lineHt,
        });
      }

      const totalTva = Math.round(totalHt * 0.19);
      const totalTtc = totalHt + totalTva;
      const paymentMethod = dto.paymentMethod ?? invoice.paymentMethod;
      const applyTimbre = dto.applyTimbre ?? (invoice.timbreFiscal > 0);
      const timbre = this.calculateTimbreFiscal(totalTtc, paymentMethod, applyTimbre);
      const netToPay = totalTtc + timbre.amount;

      // V21: Atomic delete + update in transaction
      return this.prisma.$transaction(async (tx) => {
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });

        return tx.invoice.update({
          where: { id },
          data: {
            clientId: dto.clientId ?? invoice.clientId,
            paymentMethod,
            totalHt,
            totalTva,
            totalTtc,
            timbreFiscal: timbre.amount,
            netToPay,
            lines: {
              create: lineData,
            },
        },
          include: {
            client: true,
            lines: { include: { productPf: true } },
          },
        });
      }); // end $transaction
    }

    // Mise à jour simple sans lignes
    return this.prisma.invoice.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        paymentMethod: dto.paymentMethod,
      },
      include: {
        client: true,
        lines: { include: { productPf: true } },
      },
    });
  }

  /**
   * Change le statut d'une facture avec validation des transitions
   * DRAFT → PAID (valider, déduire stock PF via processSale, marquer payée)
   * DRAFT → CANCELLED (annuler)
   * PAID → (aucune transition - statut final)
   * CANCELLED → (aucune transition - statut final)
   */
  async updateInvoiceStatus(id: number, newStatus: string, userId: string, userRole: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Facture #${id} non trouvée`);
    }

    const currentStatus = invoice.status;
    const validTransitions: Record<string, string[]> = {
      'DRAFT': ['PAID', 'CANCELLED'],
      'PAID': [],
      'CANCELLED': [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Transition de ${currentStatus} vers ${newStatus} non autorisée`
      );
    }

    // V1+V2: When paying, deduct PF stock via processSale (FIFO, traçabilité)
    if (newStatus === 'PAID' && invoice.lines.length > 0) {
      await this.stockService.processSale(
        invoice.id,
        invoice.reference,
        invoice.lines.map((l) => ({
          productPfId: l.productPfId,
          quantity: l.quantity,
        })),
        userId,
        userRole as any,
      );
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: newStatus as any },
      include: {
        client: true,
        lines: { include: { productPf: true } },
      },
    });
  }

  /**
   * Génère les données pour le PDF fiscal d'une facture
   */
  async getInvoicePdfData(id: number) {
    const invoiceData = await this.getInvoiceById(id);
    
    // Informations de l'entreprise (à configurer)
    const company = {
      name: 'MANCHENGO SARL',
      address: 'Zone Industrielle, Alger, Algérie',
      nif: '000016000000000',
      rc: '16/00-0000000B00',
      ai: '16000000000',
      nis: '000016000000000',
      phone: '+213 21 00 00 00',
      email: 'contact@manchengo.dz',
    };

    return {
      company,
      invoice: {
        reference: invoiceData.reference,
        date: invoiceData.date,
        status: invoiceData.status,
      },
      client: {
        name: invoiceData.client.name,
        code: invoiceData.client.code,
        nif: invoiceData.client.nif,
        address: invoiceData.client.address,
        phone: invoiceData.client.phone,
      },
      lines: invoiceData.lines.map((line: any) => ({
        code: line.productPf.code,
        name: line.productPf.name,
        unit: line.productPf.unit,
        quantity: line.quantity,
        unitPriceHt: line.unitPriceHt,
        lineHt: line.lineHt,
      })),
      totals: {
        totalHt: invoiceData.totalHt,
        totalTva: invoiceData.totalTva,
        tvaRate: 19,
        totalTtc: invoiceData.totalTtc,
        timbreFiscal: invoiceData.timbreFiscal,
        timbreRate: invoiceData.timbreRatePercent,
        netToPay: invoiceData.netToPay,
      },
      paymentMethod: invoiceData.paymentMethod,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK ADJUSTMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  // A15: Wrapped in $transaction for atomicity
  async adjustStock(dto: StockAdjustmentDto, userId: string) {
    if (dto.productType === 'MP') {
      const product = await this.prisma.productMp.findUnique({ where: { id: dto.productId } });
      if (!product) {
        throw new NotFoundException(`Produit MP #${dto.productId} non trouvé`);
      }

      const today = new Date();
      const lotNumber = `ADJ-${today.toISOString().slice(0, 10).replace(/-/g, '')}-${dto.productId}`;

      return this.prisma.$transaction(async (tx) => {
        let lot = await tx.lotMp.findUnique({ where: { lotNumber } });
        if (lot) {
          lot = await tx.lotMp.update({
            where: { id: lot.id },
            data: { quantityRemaining: { increment: dto.quantity } },
          });
        } else {
          lot = await tx.lotMp.create({
            data: {
              productId: dto.productId,
              lotNumber,
              quantityInitial: Math.max(0, dto.quantity),
              quantityRemaining: Math.max(0, dto.quantity),
              manufactureDate: today,
              isActive: true,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            movementType: dto.quantity >= 0 ? 'IN' : 'OUT',
            productType: 'MP',
            origin: 'INVENTAIRE',
            productMpId: dto.productId,
            lotMpId: lot.id,
            quantity: Math.abs(dto.quantity),
            note: dto.reason,
            userId,
          },
        });

        return { message: 'Ajustement stock MP effectué', lot };
      });
    } else {
      const product = await this.prisma.productPf.findUnique({ where: { id: dto.productId } });
      if (!product) {
        throw new NotFoundException(`Produit PF #${dto.productId} non trouvé`);
      }

      const today = new Date();
      const lotNumber = `ADJ-PF-${today.toISOString().slice(0, 10).replace(/-/g, '')}-${dto.productId}`;

      return this.prisma.$transaction(async (tx) => {
        let lot = await tx.lotPf.findUnique({ where: { lotNumber } });
        if (lot) {
          lot = await tx.lotPf.update({
            where: { id: lot.id },
            data: { quantityRemaining: { increment: dto.quantity } },
          });
        } else {
          lot = await tx.lotPf.create({
            data: {
              productId: dto.productId,
              lotNumber,
              quantityInitial: Math.max(0, dto.quantity),
              quantityRemaining: Math.max(0, dto.quantity),
              manufactureDate: today,
              isActive: true,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            movementType: dto.quantity >= 0 ? 'IN' : 'OUT',
            productType: 'PF',
            origin: 'INVENTAIRE',
            productPfId: dto.productId,
            lotPfId: lot.id,
            quantity: Math.abs(dto.quantity),
            note: dto.reason,
            userId,
          },
        });

        return { message: 'Ajustement stock PF effectué', lot };
      }); // end PF $transaction
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEVICES - MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async revokeDevice(deviceId: string, reason?: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      throw new NotFoundException(`Appareil non trouvé`);
    }
    // Revoke all tokens for this device
    await this.prisma.refreshToken.deleteMany({ where: { deviceId } });
    return this.prisma.device.update({
      where: { id: deviceId },
      data: { isActive: false },
    });
  }

  async reactivateDevice(deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      throw new NotFoundException(`Appareil non trouvé`);
    }
    return this.prisma.device.update({
      where: { id: deviceId },
      data: { isActive: true },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY LOGS (A6)
  // ═══════════════════════════════════════════════════════════════════════════

  async getSecurityLogs(options: { action?: string; limit?: number }) {
    const { action, limit = 100 } = options;
    const where: any = {};
    if (action) {
      where.action = action;
    }

    const [logs, total] = await Promise.all([
      this.prisma.securityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.securityLog.count({ where }),
    ]);

    return { logs, total };
  }
}
