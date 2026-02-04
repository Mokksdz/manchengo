import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../common/logger/logger.service';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * REPORTS SERVICE — Advanced Reporting & Analytics
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export interface ReportFilters {
  startDate: Date;
  endDate: Date;
  supplierId?: number;
  productMpId?: number;
  productPfId?: number;
  status?: string;
}

export interface ReportResult<T> {
  data: T[];
  summary: Record<string, unknown>;
  generatedAt: Date;
  filters: ReportFilters;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // STOCK REPORTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Stock valorization report (FIFO)
   */
  async getStockValorizationReport(): Promise<ReportResult<any>> {
    const mpStock = await this.prisma.lotMp.findMany({
      where: { quantityRemaining: { gt: 0 }, isActive: true },
      include: { product: true },
    });

    const pfStock = await this.prisma.lotPf.findMany({
      where: { quantityRemaining: { gt: 0 }, isActive: true },
      include: { product: true },
    });

    const mpValorization = mpStock.map((lot) => ({
      type: 'MP',
      code: lot.product.code,
      name: lot.product.name,
      lotNumber: lot.lotNumber,
      quantity: lot.quantityRemaining,
      unitCost: lot.unitCost || 0,
      totalValue: lot.quantityRemaining * (lot.unitCost || 0),
      expiryDate: lot.expiryDate,
    }));

    const pfValorization = pfStock.map((lot) => ({
      type: 'PF',
      code: lot.product.code,
      name: lot.product.name,
      lotNumber: lot.lotNumber,
      quantity: lot.quantityRemaining,
      unitCost: lot.unitCost || 0,
      totalValue: lot.quantityRemaining * (lot.unitCost || 0),
      expiryDate: lot.expiryDate,
    }));

    const data = [...mpValorization, ...pfValorization];
    const totalMpValue = mpValorization.reduce((sum, item) => sum + item.totalValue, 0);
    const totalPfValue = pfValorization.reduce((sum, item) => sum + item.totalValue, 0);

    return {
      data,
      summary: {
        totalMpValue,
        totalPfValue,
        totalValue: totalMpValue + totalPfValue,
        mpLotCount: mpValorization.length,
        pfLotCount: pfValorization.length,
      },
      generatedAt: new Date(),
      filters: { startDate: new Date(), endDate: new Date() },
    };
  }

  /**
   * Stock movement report
   */
  async getStockMovementReport(filters: ReportFilters): Promise<ReportResult<any>> {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        createdAt: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
        isDeleted: false,
        ...(filters.productMpId && { productMpId: filters.productMpId }),
        ...(filters.productPfId && { productPfId: filters.productPfId }),
      },
      include: {
        productMp: { select: { code: true, name: true } },
        productPf: { select: { code: true, name: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = movements.map((m) => ({
      date: m.createdAt,
      type: m.movementType,
      origin: m.origin,
      productType: m.productType,
      productCode: m.productMp?.code || m.productPf?.code,
      productName: m.productMp?.name || m.productPf?.name,
      quantity: m.quantity,
      unitCost: m.unitCost,
      reference: m.reference,
      user: `${m.user.firstName} ${m.user.lastName}`,
    }));

    const inMovements = movements.filter((m) => m.movementType === 'IN');
    const outMovements = movements.filter((m) => m.movementType === 'OUT');

    return {
      data,
      summary: {
        totalMovements: movements.length,
        totalIn: inMovements.length,
        totalOut: outMovements.length,
        totalInQuantity: inMovements.reduce((sum, m) => sum + m.quantity, 0),
        totalOutQuantity: outMovements.reduce((sum, m) => sum + m.quantity, 0),
      },
      generatedAt: new Date(),
      filters,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRODUCTION REPORTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Production performance report
   */
  async getProductionReport(filters: ReportFilters): Promise<ReportResult<any>> {
    const orders = await this.prisma.productionOrder.findMany({
      where: {
        createdAt: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
        ...(filters.status && { status: filters.status as any }),
      },
      include: {
        productPf: { select: { code: true, name: true } },
        recipe: { select: { name: true, batchWeight: true } },
        consumptions: {
          include: {
            productMp: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = orders.map((order) => ({
      reference: order.reference,
      product: order.productPf.name,
      recipe: order.recipe?.name,
      targetQuantity: order.targetQuantity,
      producedQuantity: order.quantityProduced,
      yieldPercentage: order.yieldPercentage ? Number(order.yieldPercentage) : null,
      status: order.status,
      startedAt: order.startedAt,
      completedAt: order.completedAt,
      duration: order.startedAt && order.completedAt
        ? Math.round((order.completedAt.getTime() - order.startedAt.getTime()) / 60000)
        : null,
      consumptions: order.consumptions.map((c) => ({
        mp: c.productMp.name,
        planned: Number(c.quantityPlanned),
        consumed: Number(c.quantityConsumed),
        variance: Number(c.quantityConsumed) - Number(c.quantityPlanned),
      })),
    }));

    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
    const avgYield = completedOrders.length
      ? completedOrders.reduce((sum, o) => sum + Number(o.yieldPercentage || 0), 0) / completedOrders.length
      : 0;

    return {
      data,
      summary: {
        totalOrders: orders.length,
        completed: completedOrders.length,
        inProgress: orders.filter((o) => o.status === 'IN_PROGRESS').length,
        pending: orders.filter((o) => o.status === 'PENDING').length,
        cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
        averageYield: Math.round(avgYield * 100) / 100,
        totalProduced: completedOrders.reduce((sum, o) => sum + o.quantityProduced, 0),
      },
      generatedAt: new Date(),
      filters,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PROCUREMENT REPORTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Purchase orders report
   */
  async getPurchaseOrdersReport(filters: ReportFilters): Promise<ReportResult<any>> {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: {
        createdAt: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
        ...(filters.supplierId && { supplierId: filters.supplierId }),
        ...(filters.status && { status: filters.status as any }),
      },
      include: {
        supplier: { select: { code: true, name: true } },
        items: {
          include: {
            productMp: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = orders.map((order) => ({
      reference: order.reference,
      supplier: order.supplier.name,
      status: order.status,
      totalHT: Number(order.totalHT),
      createdAt: order.createdAt,
      sentAt: order.sentAt,
      confirmedAt: order.confirmedAt,
      receivedAt: order.receivedAt,
      leadTime: order.sentAt && order.receivedAt
        ? Math.round((order.receivedAt.getTime() - order.sentAt.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      itemCount: order.items.length,
    }));

    const receivedOrders = orders.filter((o) => o.receivedAt);
    const avgLeadTime = receivedOrders.length
      ? receivedOrders.reduce((sum, o) => {
          const lt = o.sentAt && o.receivedAt
            ? (o.receivedAt.getTime() - o.sentAt.getTime()) / (1000 * 60 * 60 * 24)
            : 0;
          return sum + lt;
        }, 0) / receivedOrders.length
      : 0;

    return {
      data,
      summary: {
        totalOrders: orders.length,
        totalAmount: orders.reduce((sum, o) => sum + Number(o.totalHT), 0),
        draft: orders.filter((o) => o.status === 'DRAFT').length,
        sent: orders.filter((o) => o.status === 'SENT').length,
        confirmed: orders.filter((o) => o.status === 'CONFIRMED').length,
        received: orders.filter((o) => o.status === 'RECEIVED').length,
        averageLeadTimeDays: Math.round(avgLeadTime * 10) / 10,
      },
      generatedAt: new Date(),
      filters,
    };
  }

  /**
   * Supplier performance report
   */
  async getSupplierPerformanceReport(filters: ReportFilters): Promise<ReportResult<any>> {
    const suppliers = await this.prisma.supplier.findMany({
      where: { isActive: true },
      include: {
        purchaseOrders: {
          where: {
            createdAt: {
              gte: filters.startDate,
              lte: filters.endDate,
            },
          },
        },
      },
    });

    const data = suppliers.map((supplier) => {
      const orders = supplier.purchaseOrders;
      const receivedOrders = orders.filter((o) => o.receivedAt);

      const avgLeadTime = receivedOrders.length
        ? receivedOrders.reduce((sum, o) => {
            const lt = o.sentAt && o.receivedAt
              ? (o.receivedAt.getTime() - o.sentAt.getTime()) / (1000 * 60 * 60 * 24)
              : 0;
            return sum + lt;
          }, 0) / receivedOrders.length
        : 0;

      return {
        code: supplier.code,
        name: supplier.name,
        totalOrders: orders.length,
        totalAmount: orders.reduce((sum, o) => sum + Number(o.totalHT), 0),
        receivedOrders: receivedOrders.length,
        averageLeadTimeDays: Math.round(avgLeadTime * 10) / 10,
        onTimeDeliveryRate: 0, // TODO: Calculate based on expected delivery date
      };
    });

    return {
      data: data.filter((s) => s.totalOrders > 0).sort((a, b) => b.totalAmount - a.totalAmount),
      summary: {
        totalSuppliers: data.filter((s) => s.totalOrders > 0).length,
        totalPurchases: data.reduce((sum, s) => sum + s.totalAmount, 0),
      },
      generatedAt: new Date(),
      filters,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SALES REPORTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Sales report by client
   */
  async getSalesReport(filters: ReportFilters): Promise<ReportResult<any>> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        date: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
        status: 'PAID',
      },
      include: {
        client: { select: { code: true, name: true, type: true } },
        lines: {
          include: {
            productPf: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Sales by product
    const salesByProduct: Record<string, { code: string; name: string; quantity: number; amount: number }> = {};
    invoices.forEach((inv) => {
      inv.lines.forEach((line) => {
        const key = line.productPfId.toString();
        if (!salesByProduct[key]) {
          salesByProduct[key] = {
            code: line.productPf.code,
            name: line.productPf.name,
            quantity: 0,
            amount: 0,
          };
        }
        salesByProduct[key].quantity += line.quantity;
        salesByProduct[key].amount += line.lineHt;
      });
    });

    // Sales by client
    const salesByClient: Record<string, { code: string; name: string; type: string; invoiceCount: number; amount: number }> = {};
    invoices.forEach((inv) => {
      const key = inv.clientId.toString();
      if (!salesByClient[key]) {
        salesByClient[key] = {
          code: inv.client.code,
          name: inv.client.name,
          type: inv.client.type,
          invoiceCount: 0,
          amount: 0,
        };
      }
      salesByClient[key].invoiceCount++;
      salesByClient[key].amount += inv.totalHt;
    });

    return {
      data: invoices.map((inv) => ({
        reference: inv.reference,
        date: inv.date,
        client: inv.client.name,
        clientType: inv.client.type,
        totalHt: inv.totalHt,
        totalTva: inv.totalTva,
        totalTtc: inv.totalTtc,
        paymentMethod: inv.paymentMethod,
      })),
      summary: {
        totalInvoices: invoices.length,
        totalHt: invoices.reduce((sum, i) => sum + i.totalHt, 0),
        totalTva: invoices.reduce((sum, i) => sum + i.totalTva, 0),
        totalTtc: invoices.reduce((sum, i) => sum + i.totalTtc, 0),
        byProduct: Object.values(salesByProduct).sort((a, b) => b.amount - a.amount),
        byClient: Object.values(salesByClient).sort((a, b) => b.amount - a.amount),
      },
      generatedAt: new Date(),
      filters,
    };
  }
}
