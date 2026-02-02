import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// LOTS SERVICE - V1.1 FIFO + DLC Management
// ═══════════════════════════════════════════════════════════════════════════════
// RÈGLES MÉTIER:
// - Stock = SUM(quantityRemaining) des lots actifs
// - Consommation FIFO automatique (plus ancien d'abord)
// - Blocage production si MP expirée
// - Blocage vente si PF expiré
// - Traçabilité lot par mouvement
// ═══════════════════════════════════════════════════════════════════════════════

export type LotStatus = 'OK' | 'SOON_EXPIRED' | 'EXPIRED';

export interface LotInfo {
  id: number;
  lotNumber: string;
  productId: number;
  productCode: string;
  productName: string;
  quantityInitial: number;
  quantityRemaining: number;
  manufactureDate?: Date;
  expiryDate?: Date;
  status: LotStatus;
  daysUntilExpiry?: number;
  isActive: boolean;
}

export interface FifoConsumption {
  lotId: number;
  lotNumber: string;
  quantity: number;
  unitCost?: number;
}

// Nombre de jours avant expiration pour alerte
const EXPIRY_WARNING_DAYS = 7;

@Injectable()
export class LotsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS - STATUT DLC
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcule le statut DLC d'un lot
   */
  getLotStatus(expiryDate: Date | null): { status: LotStatus; daysUntilExpiry?: number } {
    if (!expiryDate) {
      return { status: 'OK' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - today.getTime();
    const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return { status: 'EXPIRED', daysUntilExpiry };
    }

    if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
      return { status: 'SOON_EXPIRED', daysUntilExpiry };
    }

    return { status: 'OK', daysUntilExpiry };
  }

  /**
   * Génère un numéro de lot unique
   */
  async generateLotNumber(prefix: 'MP' | 'PF'): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '');
    const baseNumber = `L${prefix}-${dateStr}`;

    // Trouver le dernier numéro du jour
    const table = prefix === 'MP' ? this.prisma.lotMp : this.prisma.lotPf;
    const lastLot = await (table as any).findFirst({
      where: { lotNumber: { startsWith: baseNumber } },
      orderBy: { lotNumber: 'desc' },
    });

    let sequence = 1;
    if (lastLot?.lotNumber) {
      const match = lastLot.lotNumber.match(/-(\d+)$/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    return `${baseNumber}-${sequence.toString().padStart(3, '0')}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOTS MP - MATIÈRES PREMIÈRES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Liste les lots MP d'un produit
   */
  async findLotsMp(productId?: number, includeInactive = false): Promise<LotInfo[]> {
    const lots = await this.prisma.lotMp.findMany({
      where: {
        ...(productId && { productId }),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        product: { select: { code: true, name: true } },
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });

    return lots.map((lot) => {
      const { status, daysUntilExpiry } = this.getLotStatus(lot.expiryDate);
      return {
        id: lot.id,
        lotNumber: lot.lotNumber,
        productId: lot.productId,
        productCode: lot.product.code,
        productName: lot.product.name,
        quantityInitial: lot.quantityInitial,
        quantityRemaining: lot.quantityRemaining,
        manufactureDate: lot.manufactureDate ?? undefined,
        expiryDate: lot.expiryDate ?? undefined,
        status,
        daysUntilExpiry,
        isActive: lot.isActive,
      };
    });
  }

  /**
   * Crée un lot MP (via réception)
   */
  async createLotMp(data: {
    productId: number;
    quantity: number;
    lotNumber?: string;
    manufactureDate?: Date;
    expiryDate?: Date;
    supplierId?: number;
    receptionId?: number;
    unitCost?: number;
  }): Promise<LotInfo> {
    const lotNumber = data.lotNumber || (await this.generateLotNumber('MP'));

    const lot = await this.prisma.lotMp.create({
      data: {
        productId: data.productId,
        lotNumber,
        quantityInitial: data.quantity,
        quantityRemaining: data.quantity,
        manufactureDate: data.manufactureDate,
        expiryDate: data.expiryDate,
        supplierId: data.supplierId,
        receptionId: data.receptionId,
        unitCost: data.unitCost,
        isActive: true,
      },
      include: {
        product: { select: { code: true, name: true } },
      },
    });

    const { status, daysUntilExpiry } = this.getLotStatus(lot.expiryDate);
    return {
      id: lot.id,
      lotNumber: lot.lotNumber,
      productId: lot.productId,
      productCode: lot.product.code,
      productName: lot.product.name,
      quantityInitial: lot.quantityInitial,
      quantityRemaining: lot.quantityRemaining,
      manufactureDate: lot.manufactureDate ?? undefined,
      expiryDate: lot.expiryDate ?? undefined,
      status,
      daysUntilExpiry,
      isActive: lot.isActive,
    };
  }

  /**
   * Consomme des MP en FIFO (pour production)
   * Retourne la liste des lots consommés avec quantités
   * @throws BadRequestException si stock insuffisant ou lots expirés
   */
  async consumeMpFifo(
    productId: number,
    quantityNeeded: number,
    blockIfExpired = true,
  ): Promise<FifoConsumption[]> {
    // Récupérer les lots actifs triés FIFO (plus ancien d'abord)
    const lots = await this.prisma.lotMp.findMany({
      where: {
        productId,
        isActive: true,
        quantityRemaining: { gt: 0 },
      },
      orderBy: [
        { expiryDate: 'asc' },
        { manufactureDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Calculer stock disponible (hors expirés si blockIfExpired)
    const today = new Date();
    let availableStock = 0;
    const validLots: typeof lots = [];

    for (const lot of lots) {
      const isExpired = lot.expiryDate && lot.expiryDate < today;
      
      if (blockIfExpired && isExpired) {
        continue; // Ignorer les lots expirés
      }

      validLots.push(lot);
      availableStock += lot.quantityRemaining;
    }

    if (availableStock < quantityNeeded) {
      const expiredCount = lots.length - validLots.length;
      if (expiredCount > 0 && blockIfExpired) {
        throw new BadRequestException(
          `Stock insuffisant: ${availableStock} disponible (${expiredCount} lot(s) expiré(s) bloqué(s)). ` +
          `Besoin: ${quantityNeeded}`,
        );
      }
      throw new BadRequestException(
        `Stock insuffisant: ${availableStock} disponible, ${quantityNeeded} demandé`,
      );
    }

    // Consommer FIFO
    const consumptions: FifoConsumption[] = [];
    let remaining = quantityNeeded;

    for (const lot of validLots) {
      if (remaining <= 0) break;

      const toConsume = Math.min(lot.quantityRemaining, remaining);
      const newQuantity = lot.quantityRemaining - toConsume;

      // Mettre à jour le lot
      await this.prisma.lotMp.update({
        where: { id: lot.id },
        data: {
          quantityRemaining: newQuantity,
          isActive: newQuantity > 0,
        },
      });

      consumptions.push({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        quantity: toConsume,
        unitCost: lot.unitCost ?? undefined,
      });

      remaining -= toConsume;
    }

    return consumptions;
  }

  /**
   * Vérifie si on peut consommer une quantité de MP (sans modifier)
   */
  async canConsumeMp(
    productId: number,
    quantityNeeded: number,
    blockIfExpired = true,
  ): Promise<{ canConsume: boolean; availableStock: number; expiredLots: number; message?: string }> {
    const lots = await this.prisma.lotMp.findMany({
      where: {
        productId,
        isActive: true,
        quantityRemaining: { gt: 0 },
      },
    });

    const today = new Date();
    let availableStock = 0;
    let expiredLots = 0;

    for (const lot of lots) {
      const isExpired = lot.expiryDate && lot.expiryDate < today;
      if (isExpired) {
        expiredLots++;
        if (!blockIfExpired) {
          availableStock += lot.quantityRemaining;
        }
      } else {
        availableStock += lot.quantityRemaining;
      }
    }

    if (availableStock >= quantityNeeded) {
      return { canConsume: true, availableStock, expiredLots };
    }

    return {
      canConsume: false,
      availableStock,
      expiredLots,
      message: expiredLots > 0 && blockIfExpired
        ? `Stock insuffisant (${expiredLots} lot(s) expiré(s))`
        : `Stock insuffisant: ${availableStock} disponible`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOTS PF - PRODUITS FINIS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Liste les lots PF d'un produit
   */
  async findLotsPf(productId?: number, includeInactive = false): Promise<LotInfo[]> {
    const lots = await this.prisma.lotPf.findMany({
      where: {
        ...(productId && { productId }),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        product: { select: { code: true, name: true } },
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });

    return lots.map((lot) => {
      const { status, daysUntilExpiry } = this.getLotStatus(lot.expiryDate);
      return {
        id: lot.id,
        lotNumber: lot.lotNumber,
        productId: lot.productId,
        productCode: lot.product.code,
        productName: lot.product.name,
        quantityInitial: lot.quantityInitial,
        quantityRemaining: lot.quantityRemaining,
        manufactureDate: lot.manufactureDate ?? undefined,
        expiryDate: lot.expiryDate ?? undefined,
        status,
        daysUntilExpiry,
        isActive: lot.isActive,
      };
    });
  }

  /**
   * Crée un lot PF (via production)
   * DLC calculée automatiquement si non fournie (ex: +90 jours)
   */
  async createLotPf(data: {
    productId: number;
    quantity: number;
    lotNumber?: string;
    expiryDate?: Date;
    productionOrderId?: number;
    unitCost?: number;
    defaultExpiryDays?: number;
  }): Promise<LotInfo> {
    const lotNumber = data.lotNumber || (await this.generateLotNumber('PF'));
    const manufactureDate = new Date();

    // Calculer DLC si non fournie
    let expiryDate = data.expiryDate;
    if (!expiryDate && data.defaultExpiryDays) {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + data.defaultExpiryDays);
    }

    const lot = await this.prisma.lotPf.create({
      data: {
        productId: data.productId,
        lotNumber,
        quantityInitial: data.quantity,
        quantityRemaining: data.quantity,
        manufactureDate,
        expiryDate,
        productionOrderId: data.productionOrderId,
        unitCost: data.unitCost,
        isActive: true,
      },
      include: {
        product: { select: { code: true, name: true } },
      },
    });

    const { status, daysUntilExpiry } = this.getLotStatus(lot.expiryDate);
    return {
      id: lot.id,
      lotNumber: lot.lotNumber,
      productId: lot.productId,
      productCode: lot.product.code,
      productName: lot.product.name,
      quantityInitial: lot.quantityInitial,
      quantityRemaining: lot.quantityRemaining,
      manufactureDate: lot.manufactureDate ?? undefined,
      expiryDate: lot.expiryDate ?? undefined,
      status,
      daysUntilExpiry,
      isActive: lot.isActive,
    };
  }

  /**
   * Vend des PF en FIFO (pour vente)
   * @throws BadRequestException si stock insuffisant ou lots expirés
   */
  async sellPfFifo(
    productId: number,
    quantityNeeded: number,
    blockIfExpired = true,
  ): Promise<FifoConsumption[]> {
    // Récupérer les lots actifs triés FIFO
    const lots = await this.prisma.lotPf.findMany({
      where: {
        productId,
        isActive: true,
        quantityRemaining: { gt: 0 },
      },
      orderBy: [
        { expiryDate: 'asc' },
        { manufactureDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const today = new Date();
    let availableStock = 0;
    const validLots: typeof lots = [];

    for (const lot of lots) {
      const isExpired = lot.expiryDate && lot.expiryDate < today;
      
      if (blockIfExpired && isExpired) {
        continue;
      }

      validLots.push(lot);
      availableStock += lot.quantityRemaining;
    }

    if (availableStock < quantityNeeded) {
      const expiredCount = lots.length - validLots.length;
      if (expiredCount > 0 && blockIfExpired) {
        throw new BadRequestException(
          `Stock insuffisant: ${availableStock} disponible (${expiredCount} lot(s) expiré(s) non vendable(s)). ` +
          `Besoin: ${quantityNeeded}`,
        );
      }
      throw new BadRequestException(
        `Stock insuffisant: ${availableStock} disponible, ${quantityNeeded} demandé`,
      );
    }

    // Consommer FIFO
    const consumptions: FifoConsumption[] = [];
    let remaining = quantityNeeded;

    for (const lot of validLots) {
      if (remaining <= 0) break;

      const toConsume = Math.min(lot.quantityRemaining, remaining);
      const newQuantity = lot.quantityRemaining - toConsume;

      await this.prisma.lotPf.update({
        where: { id: lot.id },
        data: {
          quantityRemaining: newQuantity,
          isActive: newQuantity > 0,
        },
      });

      consumptions.push({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        quantity: toConsume,
        unitCost: lot.unitCost ?? undefined,
      });

      remaining -= toConsume;
    }

    return consumptions;
  }

  /**
   * Vérifie si on peut vendre une quantité de PF
   */
  async canSellPf(
    productId: number,
    quantityNeeded: number,
    blockIfExpired = true,
  ): Promise<{ canSell: boolean; availableStock: number; expiredLots: number; message?: string }> {
    const lots = await this.prisma.lotPf.findMany({
      where: {
        productId,
        isActive: true,
        quantityRemaining: { gt: 0 },
      },
    });

    const today = new Date();
    let availableStock = 0;
    let expiredLots = 0;

    for (const lot of lots) {
      const isExpired = lot.expiryDate && lot.expiryDate < today;
      if (isExpired) {
        expiredLots++;
        if (!blockIfExpired) {
          availableStock += lot.quantityRemaining;
        }
      } else {
        availableStock += lot.quantityRemaining;
      }
    }

    if (availableStock >= quantityNeeded) {
      return { canSell: true, availableStock, expiredLots };
    }

    return {
      canSell: false,
      availableStock,
      expiredLots,
      message: expiredLots > 0 && blockIfExpired
        ? `Vente impossible (${expiredLots} lot(s) expiré(s))`
        : `Stock insuffisant: ${availableStock} disponible`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ALERTES DLC
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Récupère les lots bientôt expirés (MP + PF)
   */
  async getExpiringLots(withinDays = EXPIRY_WARNING_DAYS): Promise<{
    mp: LotInfo[];
    pf: LotInfo[];
  }> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + withinDays);

    const [mpLots, pfLots] = await Promise.all([
      this.findLotsMp(),
      this.findLotsPf(),
    ]);

    return {
      mp: mpLots.filter((lot) => lot.status === 'SOON_EXPIRED' || lot.status === 'EXPIRED'),
      pf: pfLots.filter((lot) => lot.status === 'SOON_EXPIRED' || lot.status === 'EXPIRED'),
    };
  }

  /**
   * Récupère les lots expirés uniquement
   */
  async getExpiredLots(): Promise<{ mp: LotInfo[]; pf: LotInfo[] }> {
    const [mpLots, pfLots] = await Promise.all([
      this.findLotsMp(),
      this.findLotsPf(),
    ]);

    return {
      mp: mpLots.filter((lot) => lot.status === 'EXPIRED'),
      pf: pfLots.filter((lot) => lot.status === 'EXPIRED'),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AJUSTEMENT INVENTAIRE (pour lots)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Ajuste la quantité d'un lot MP (inventaire)
   */
  async adjustLotMp(lotId: number, newQuantity: number): Promise<LotInfo> {
    const lot = await this.prisma.lotMp.update({
      where: { id: lotId },
      data: {
        quantityRemaining: newQuantity,
        isActive: newQuantity > 0,
      },
      include: {
        product: { select: { code: true, name: true } },
      },
    });

    const { status, daysUntilExpiry } = this.getLotStatus(lot.expiryDate);
    return {
      id: lot.id,
      lotNumber: lot.lotNumber,
      productId: lot.productId,
      productCode: lot.product.code,
      productName: lot.product.name,
      quantityInitial: lot.quantityInitial,
      quantityRemaining: lot.quantityRemaining,
      manufactureDate: lot.manufactureDate ?? undefined,
      expiryDate: lot.expiryDate ?? undefined,
      status,
      daysUntilExpiry,
      isActive: lot.isActive,
    };
  }

  /**
   * Ajuste la quantité d'un lot PF (inventaire)
   */
  async adjustLotPf(lotId: number, newQuantity: number): Promise<LotInfo> {
    const lot = await this.prisma.lotPf.update({
      where: { id: lotId },
      data: {
        quantityRemaining: newQuantity,
        isActive: newQuantity > 0,
      },
      include: {
        product: { select: { code: true, name: true } },
      },
    });

    const { status, daysUntilExpiry } = this.getLotStatus(lot.expiryDate);
    return {
      id: lot.id,
      lotNumber: lot.lotNumber,
      productId: lot.productId,
      productCode: lot.product.code,
      productName: lot.product.name,
      quantityInitial: lot.quantityInitial,
      quantityRemaining: lot.quantityRemaining,
      manufactureDate: lot.manufactureDate ?? undefined,
      expiryDate: lot.expiryDate ?? undefined,
      status,
      daysUntilExpiry,
      isActive: lot.isActive,
    };
  }
}
