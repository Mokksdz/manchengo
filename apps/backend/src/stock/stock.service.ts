import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, AuditContext } from '../common/audit';
import { CacheService, CacheTTL } from '../cache/cache.service';
import { MovementOrigin, MovementType, ProductType, UserRole, Prisma, AuditAction, AuditSeverity } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK SERVICE - Gestion par mouvements uniquement (ERP Industriel)
// ═══════════════════════════════════════════════════════════════════════════════
// RÈGLES MÉTIER STRICTES:
// - MP: Entrée via RECEPTION uniquement, Sortie via PRODUCTION uniquement
// - PF: Entrée via PRODUCTION uniquement, Sortie via VENTE uniquement
// - Stock = SUM(IN) - SUM(OUT) calculé dynamiquement
// - Jamais de modification directe du stock
// - Inventaire = DIFFÉRENCE (pas remplacement)
// ═══════════════════════════════════════════════════════════════════════════════

// Matrice de validation des combinaisons autorisées
const VALID_COMBINATIONS: Record<ProductType, Record<MovementOrigin, MovementType | null>> = {
  MP: {
    RECEPTION: 'IN',           // ✅ Achat fournisseur
    PRODUCTION_IN: null,       // ❌ INTERDIT
    PRODUCTION_OUT: 'OUT',     // ✅ Consommation production
    PRODUCTION_CANCEL: 'IN',   // ✅ Annulation production (reversal)
    VENTE: null,               // ❌ INTERDIT - MP ne se vend pas
    INVENTAIRE: 'IN',          // ✅ Ajustement (peut être IN ou OUT)
    RETOUR_CLIENT: null,       // ❌ INTERDIT
    PERTE: 'OUT',              // ✅ Perte/casse
  },
  PF: {
    RECEPTION: null,           // ❌ INTERDIT - PF ne s'achète pas
    PRODUCTION_IN: 'IN',       // ✅ Production
    PRODUCTION_OUT: null,      // ❌ INTERDIT
    PRODUCTION_CANCEL: null,   // ❌ INTERDIT - PF n'est pas reversé (pas encore créé)
    VENTE: 'OUT',              // ✅ Vente client
    INVENTAIRE: 'IN',          // ✅ Ajustement (peut être IN ou OUT)
    RETOUR_CLIENT: 'IN',       // ✅ Retour client (exceptionnel)
    PERTE: 'OUT',              // ✅ Perte/casse
  },
};

// Rôles autorisés par origine de mouvement
const ORIGIN_ROLES: Record<MovementOrigin, UserRole[]> = {
  RECEPTION: ['ADMIN', 'APPRO'],
  PRODUCTION_IN: ['ADMIN', 'PRODUCTION'],
  PRODUCTION_OUT: ['ADMIN', 'PRODUCTION'],
  PRODUCTION_CANCEL: ['ADMIN', 'PRODUCTION'],
  VENTE: ['ADMIN', 'COMMERCIAL'],
  INVENTAIRE: ['ADMIN'],
  RETOUR_CLIENT: ['ADMIN', 'COMMERCIAL'],
  PERTE: ['ADMIN'],
};

export interface StockLevel {
  productId: number;
  code: string;
  name: string;
  unit: string;
  minStock: number;
  priceHt?: number;
  currentStock: number;
  stockValue?: number;
  status: 'OK' | 'ALERTE' | 'RUPTURE';
  lastMovementAt?: Date;
}

@Injectable()
export class StockService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private cacheService: CacheService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION MÉTIER (CRITIQUE)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Valide qu'une combinaison productType + origin + movementType est autorisée
   * @throws BadRequestException si combinaison interdite
   */
  validateMovementCombination(
    productType: ProductType,
    origin: MovementOrigin,
    movementType: MovementType,
  ): void {
    const allowedType = VALID_COMBINATIONS[productType][origin];

    if (allowedType === null) {
      throw new BadRequestException(
        `Combinaison interdite: ${productType} + ${origin}. ` +
        `Les ${productType === 'MP' ? 'Matières Premières' : 'Produits Finis'} ` +
        `ne peuvent pas avoir de mouvement ${origin}.`,
      );
    }

    // Pour INVENTAIRE, on accepte IN ou OUT selon la différence
    if (origin === 'INVENTAIRE') {
      return; // Les deux directions sont valides
    }

    if (allowedType !== movementType) {
      throw new BadRequestException(
        `Type de mouvement invalide: ${origin} doit être ${allowedType}, pas ${movementType}.`,
      );
    }
  }

  /**
   * Vérifie que l'utilisateur a le rôle requis pour cette origine
   * @throws ForbiddenException si rôle non autorisé
   */
  validateRoleForOrigin(origin: MovementOrigin, userRole: UserRole): void {
    const allowedRoles = ORIGIN_ROLES[origin];
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Rôle ${userRole} non autorisé pour les mouvements ${origin}. ` +
        `Rôles requis: ${allowedRoles.join(', ')}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCUL STOCK (depuis mouvements uniquement)
  // ═══════════════════════════════════════════════════════════════════════════

  async calculateStock(productType: ProductType, productId: number): Promise<number> {
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

  getStockStatus(stock: number, minStock: number): 'OK' | 'ALERTE' | 'RUPTURE' {
    if (stock <= 0) return 'RUPTURE';
    if (stock <= minStock) return 'ALERTE';
    return 'OK';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRÉATION MOUVEMENT (avec validation complète)
  // ═══════════════════════════════════════════════════════════════════════════

  async createMovement(
    data: {
      productType: ProductType;
      productId: number;
      origin: MovementOrigin;
      movementType: MovementType;
      quantity: number;
      unitCost?: number;
      referenceType?: string;
      referenceId?: number;
      reference?: string;
      note?: string;
      lotId?: number;
    },
    userId: string,
    userRole: UserRole,
  ) {
    // 1. Validation combinaison métier
    this.validateMovementCombination(data.productType, data.origin, data.movementType);

    // 2. Validation rôle utilisateur
    this.validateRoleForOrigin(data.origin, userRole);

    // 3. Validation quantité positive
    if (data.quantity <= 0) {
      throw new BadRequestException('La quantité doit être strictement positive');
    }

    // 4-6. Transaction: stock check + movement creation (atomic)
    const { movement, stockBefore } = await this.prisma.$transaction(async (tx) => {
      // Vérification stock suffisant pour les sorties
      if (data.movementType === 'OUT') {
        const currentStock = await this.calculateStockInTransaction(tx, data.productType, data.productId);
        if (currentStock < data.quantity) {
          throw new BadRequestException(
            `Stock insuffisant: disponible ${currentStock}, requis ${data.quantity}`,
          );
        }
      }

      // Capture before state for audit
      const txStockBefore = await this.calculateStockInTransaction(tx, data.productType, data.productId);

      // Création du mouvement
      const txMovement = await tx.stockMovement.create({
        data: {
          movementType: data.movementType,
          productType: data.productType,
          origin: data.origin,
          productMpId: data.productType === 'MP' ? data.productId : null,
          productPfId: data.productType === 'PF' ? data.productId : null,
          lotMpId: data.productType === 'MP' ? data.lotId : null,
          lotPfId: data.productType === 'PF' ? data.lotId : null,
          quantity: data.quantity,
          unitCost: data.unitCost,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          reference: data.reference,
          note: data.note,
          userId,
        },
      });

      return { movement: txMovement, stockBefore: txStockBefore };
    });

    // 7. Audit log - CRITICAL for traceability (outside transaction is fine)
    const stockAfter = stockBefore + (data.movementType === 'IN' ? data.quantity : -data.quantity);
    await this.auditService.log({
      actor: { id: userId, role: userRole },
      action: AuditAction.STOCK_MOVEMENT_CREATED,
      severity: data.origin === 'INVENTAIRE' ? AuditSeverity.CRITICAL : AuditSeverity.INFO,
      entityType: 'StockMovement',
      entityId: String(movement.id),
      beforeState: {
        stock: stockBefore,
        productId: data.productId,
        productType: data.productType,
      },
      afterState: {
        stock: stockAfter,
        movementType: data.movementType,
        origin: data.origin,
        quantity: data.quantity,
        reference: data.reference,
      },
    });

    return movement;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RÉCEPTION MP (Achat fournisseur) - Transaction avec verrou
  // ═══════════════════════════════════════════════════════════════════════════

  async createReception(
    data: {
      supplierId: number;
      date: Date;
      blNumber?: string;
      note?: string;
      lines: Array<{
        productMpId: number;
        quantity: number;
        unitCost?: number;
        lotNumber?: string;
        expiryDate?: Date;
        tvaRate?: number; // 0, 9, ou 19 (défaut: 19)
      }>;
    },
    userId: string,
    userRole: UserRole,
  ) {
    // Validation rôle
    this.validateRoleForOrigin('RECEPTION', userRole);

    // Validation quantités strictement positives
    for (const line of data.lines) {
      if (!line.quantity || line.quantity <= 0) {
        throw new BadRequestException('La quantité de chaque ligne doit être strictement positive');
      }
    }

    // Validation TVA - taux autorisés: 0, 9, 19
    const validTvaRates = [0, 9, 19];
    for (const line of data.lines) {
      const tvaRate = line.tvaRate ?? 19;
      if (!validTvaRates.includes(tvaRate)) {
        throw new BadRequestException(`Taux TVA invalide: ${tvaRate}%. Valeurs autorisées: 0%, 9%, 19%`);
      }
    }

    // Générer référence
    const today = new Date();
    const prefix = `REC-${today.toISOString().slice(0, 10).replace(/-/g, '')}`;
    const count = await this.prisma.receptionMp.count({
      where: { reference: { startsWith: prefix } },
    });
    const reference = `${prefix}-${String(count + 1).padStart(3, '0')}`;

    // Transaction: créer réception + mouvements
    const result = await this.prisma.$transaction(async (tx) => {
      // Créer réception
      const reception = await tx.receptionMp.create({
        data: {
          reference,
          supplierId: data.supplierId,
          date: data.date,
          blNumber: data.blNumber,
          note: data.note,
          status: 'VALIDATED',
          userId,
          validatedAt: new Date(),
          validatedBy: userId,
          lines: {
            create: data.lines.map((line) => {
              const tvaRate = line.tvaRate ?? 19;
              const unitCost = line.unitCost ?? 0;
              const totalHT = line.quantity * unitCost;
              const tvaAmount = Math.round(totalHT * tvaRate / 100);
              const totalTTC = totalHT + tvaAmount;
              
              return {
                productMpId: line.productMpId,
                quantity: line.quantity,
                unitCost: line.unitCost,
                lotNumber: line.lotNumber,
                expiryDate: line.expiryDate,
                tvaRate,
                totalHT,
                tvaAmount,
                totalTTC,
              };
            }),
          },
        },
        include: { lines: true },
      });

      // Créer mouvements IN pour chaque ligne
      for (const line of reception.lines) {
        await tx.stockMovement.create({
          data: {
            movementType: 'IN',
            productType: 'MP',
            origin: 'RECEPTION',
            productMpId: line.productMpId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            referenceType: 'RECEPTION',
            referenceId: reception.id,
            reference: reception.reference,
            userId,
            note: `Réception ${reception.reference}${data.blNumber ? ` - BL: ${data.blNumber}` : ''}`,
          },
        });
      }

      return reception;
    });

    // Invalidate stock cache after reception
    await this.cacheService.invalidateStockCache();

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVENTAIRE (Ajustement par différence - ADMIN ONLY)
  // ═══════════════════════════════════════════════════════════════════════════

  async adjustInventory(
    data: {
      productType: ProductType;
      productId: number;
      physicalQuantity: number; // Stock physique compté
      reason: string;
    },
    userId: string,
    userRole: UserRole,
  ) {
    // ADMIN ONLY
    this.validateRoleForOrigin('INVENTAIRE', userRole);

    // Calcul stock théorique actuel
    const theoreticalStock = await this.calculateStock(data.productType, data.productId);

    // Calcul différence
    const difference = data.physicalQuantity - theoreticalStock;

    if (difference === 0) {
      return {
        message: 'Aucun ajustement nécessaire - stock conforme',
        theoreticalStock,
        physicalQuantity: data.physicalQuantity,
        difference: 0,
      };
    }

    // Générer référence inventaire
    const today = new Date();
    const reference = `INV-${today.toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;

    // Créer mouvement d'ajustement
    const movement = await this.prisma.stockMovement.create({
      data: {
        movementType: difference > 0 ? 'IN' : 'OUT',
        productType: data.productType,
        origin: 'INVENTAIRE',
        productMpId: data.productType === 'MP' ? data.productId : null,
        productPfId: data.productType === 'PF' ? data.productId : null,
        quantity: Math.abs(difference),
        reference,
        userId,
        note: `Inventaire: ${data.reason} | Théorique: ${theoreticalStock}, Physique: ${data.physicalQuantity}, Écart: ${difference > 0 ? '+' : ''}${difference}`,
      },
    });

    // Invalidate stock cache after inventory adjustment
    await this.cacheService.invalidateStockCache();

    return {
      message: difference > 0 ? 'Stock ajusté à la hausse' : 'Stock ajusté à la baisse',
      theoreticalStock,
      physicalQuantity: data.physicalQuantity,
      difference,
      movementId: movement.id,
      reference,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTION (Pivot central - Transaction atomique avec verrou)
  // ═══════════════════════════════════════════════════════════════════════════

  async completeProduction(
    orderId: number,
    quantityProduced: number,
    userId: string,
    userRole: UserRole,
  ) {
    this.validateRoleForOrigin('PRODUCTION_OUT', userRole);

    if (quantityProduced <= 0) {
      throw new BadRequestException('La quantité produite doit être strictement positive');
    }

    // Transaction avec isolation SERIALIZABLE pour éviter race conditions
    const result = await this.prisma.$transaction(
      async (tx) => {
        // 1. Charger ordre avec verrou (FOR UPDATE implicite dans transaction)
        const order = await tx.productionOrder.findUnique({
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

        // 2. Batch stock check + coût MP (2 queries au lieu de 2N)
        const mpIds = order.consumptions.map((c) => c.productMpId);

        const batchStocks = await tx.stockMovement.groupBy({
          by: ['productMpId', 'movementType'],
          where: { productType: 'MP', productMpId: { in: mpIds }, isDeleted: false },
          _sum: { quantity: true },
        });

        const batchStockMap = new Map<number, number>();
        for (const s of batchStocks) {
          if (!s.productMpId) continue;
          const prev = batchStockMap.get(s.productMpId) || 0;
          const qty = s._sum.quantity || 0;
          batchStockMap.set(s.productMpId, prev + (s.movementType === 'IN' ? qty : -qty));
        }

        const lastReceptions = await tx.stockMovement.findMany({
          where: { productMpId: { in: mpIds }, origin: 'RECEPTION', isDeleted: false },
          orderBy: { createdAt: 'desc' },
          distinct: ['productMpId'],
          select: { productMpId: true, unitCost: true },
        });

        const lastCostMap = new Map<number, number>();
        for (const r of lastReceptions) {
          if (r.productMpId) lastCostMap.set(r.productMpId, r.unitCost || 0);
        }

        let totalMpCost = 0;
        for (const consumption of order.consumptions) {
          const stockMp = batchStockMap.get(consumption.productMpId) || 0;

          if (stockMp < Number(consumption.quantityPlanned)) {
            throw new BadRequestException(
              `Stock MP insuffisant pour ${consumption.productMp.name}: ` +
              `disponible ${stockMp}, requis ${consumption.quantityPlanned}`,
            );
          }

          const mpUnitCost = lastCostMap.get(consumption.productMpId) || 0;
          totalMpCost += mpUnitCost * Number(consumption.quantityPlanned);
        }

        // 3. Créer mouvements OUT pour chaque MP consommée
        for (const consumption of order.consumptions) {
          await tx.stockMovement.create({
            data: {
              movementType: 'OUT',
              productType: 'MP',
              origin: 'PRODUCTION_OUT',
              productMpId: consumption.productMpId,
              quantity: Number(consumption.quantityPlanned),
              referenceType: 'PRODUCTION',
              referenceId: order.id,
              reference: order.reference,
              userId,
              note: `Production ${order.reference} - Consommation ${consumption.productMp.name}`,
            },
          });
        }

        // 4. Calculer coût de revient PF
        const pfUnitCost = quantityProduced > 0 ? Math.round(totalMpCost / quantityProduced) : 0;

        // 5. Créer mouvement IN pour PF produit
        await tx.stockMovement.create({
          data: {
            movementType: 'IN',
            productType: 'PF',
            origin: 'PRODUCTION_IN',
            productPfId: order.productPfId,
            quantity: quantityProduced,
            unitCost: pfUnitCost, // Coût de revient calculé
            referenceType: 'PRODUCTION',
            referenceId: order.id,
            reference: order.reference,
            userId,
            note: `Production ${order.reference} - ${order.productPf.name} (coût revient: ${pfUnitCost} centimes)`,
          },
        });

        // 6. Mettre à jour ordre de production
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
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable, // Évite race conditions
        timeout: 10000, // 10 secondes max
      },
    );

    // Invalidate stock cache after production
    await this.cacheService.invalidateProductionCache();
    await this.cacheService.invalidateStockCache();

    return result;
  }

  /**
   * Calcule le stock dans une transaction (pour éviter race conditions)
   */
  private async calculateStockInTransaction(
    tx: Prisma.TransactionClient,
    productType: ProductType,
    productId: number,
  ): Promise<number> {
    const movements = await tx.stockMovement.groupBy({
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

  // ═══════════════════════════════════════════════════════════════════════════
  // VENTE (Sortie PF - appelé lors création facture)
  // ═══════════════════════════════════════════════════════════════════════════

  async processSale(
    invoiceId: number,
    invoiceReference: string,
    lines: Array<{ productPfId: number; quantity: number }>,
    userId: string,
    userRole: UserRole,
    existingTx?: Prisma.TransactionClient,
  ) {
    this.validateRoleForOrigin('VENTE', userRole);

    const executeLogic = async (tx: Prisma.TransactionClient) => {
      // Vérifier stock PF disponible pour CHAQUE ligne
      for (const line of lines) {
        const stockPf = await this.calculateStockInTransaction(tx, 'PF', line.productPfId);

        if (stockPf < line.quantity) {
          const product = await tx.productPf.findUnique({
            where: { id: line.productPfId },
            select: { name: true },
          });
          throw new BadRequestException(
            `Stock PF insuffisant pour ${product?.name}: ` +
            `disponible ${stockPf}, requis ${line.quantity}`,
          );
        }
      }

      // Créer mouvements OUT pour chaque ligne
      for (const line of lines) {
        await tx.stockMovement.create({
          data: {
            movementType: 'OUT',
            productType: 'PF',
            origin: 'VENTE',
            productPfId: line.productPfId,
            quantity: line.quantity,
            referenceType: 'INVOICE',
            referenceId: invoiceId,
            reference: invoiceReference,
            userId,
            note: `Vente facture ${invoiceReference}`,
          },
        });
      }

      return { success: true, linesProcessed: lines.length };
    };

    // Si un tx externe est fourni, l'utiliser (atomicité avec l'appelant)
    // Sinon, créer notre propre transaction Serializable
    const result = existingTx
      ? await executeLogic(existingTx)
      : await this.prisma.$transaction(
          async (tx) => executeLogic(tx),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 10000,
          },
        );

    // Invalidate stock + sales cache after sale
    await this.cacheService.invalidateStockCache();
    await this.cacheService.invalidateSalesCache();

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERIES - Stock & Mouvements
  // ═══════════════════════════════════════════════════════════════════════════

  async getStockMp(): Promise<StockLevel[]> {
    const key = this.cacheService.buildStockKey('mp');
    return this.cacheService.getOrSet(key, () => this.computeStockMp(), CacheTTL.STOCK);
  }

  private async computeStockMp(): Promise<(StockLevel & { impactProduction: number })[]> {
    const products = await this.prisma.productMp.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    const productIds = products.map((p) => p.id);

    const [allStocks, lastMovements, recipeUsage] = await Promise.all([
      this.prisma.stockMovement.groupBy({
        by: ['productMpId', 'movementType'],
        where: { productType: 'MP', productMpId: { in: productIds }, isDeleted: false },
        _sum: { quantity: true },
      }),
      this.prisma.stockMovement.groupBy({
        by: ['productMpId'],
        where: { productType: 'MP', productMpId: { in: productIds }, isDeleted: false },
        _max: { createdAt: true },
      }),
      // Count how many recipes use each MP (impact production)
      this.prisma.recipeItem.groupBy({
        by: ['productMpId'],
        where: { productMpId: { in: productIds } },
        _count: true,
      }),
    ]);

    const stockMap = new Map<number, number>();
    for (const s of allStocks) {
      if (!s.productMpId) continue;
      const prev = stockMap.get(s.productMpId) || 0;
      const qty = s._sum.quantity || 0;
      stockMap.set(s.productMpId, prev + (s.movementType === 'IN' ? qty : -qty));
    }

    const lastMovementMap = new Map<number, Date>();
    for (const lm of lastMovements) {
      if (lm.productMpId && lm._max.createdAt) {
        lastMovementMap.set(lm.productMpId, lm._max.createdAt);
      }
    }

    const impactMap = new Map<number, number>();
    for (const r of recipeUsage) {
      if (r.productMpId) impactMap.set(r.productMpId, r._count);
    }

    return products.map((p) => {
      const currentStock = stockMap.get(p.id) || 0;
      return {
        productId: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        minStock: p.minStock,
        currentStock,
        status: this.getStockStatus(currentStock, p.minStock),
        lastMovementAt: lastMovementMap.get(p.id),
        impactProduction: impactMap.get(p.id) || 0,
      };
    });
  }

  async getStockPf(): Promise<StockLevel[]> {
    const key = this.cacheService.buildStockKey('pf');
    return this.cacheService.getOrSet(key, () => this.computeStockPf(), CacheTTL.STOCK);
  }

  private async computeStockPf(): Promise<StockLevel[]> {
    const products = await this.prisma.productPf.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    const productIds = products.map((p) => p.id);

    const allStocks = await this.prisma.stockMovement.groupBy({
      by: ['productPfId', 'movementType'],
      where: { productType: 'PF', productPfId: { in: productIds }, isDeleted: false },
      _sum: { quantity: true },
    });

    const lastMovements = await this.prisma.stockMovement.groupBy({
      by: ['productPfId'],
      where: { productType: 'PF', productPfId: { in: productIds }, isDeleted: false },
      _max: { createdAt: true },
    });

    const stockMap = new Map<number, number>();
    for (const s of allStocks) {
      if (!s.productPfId) continue;
      const prev = stockMap.get(s.productPfId) || 0;
      const qty = s._sum.quantity || 0;
      stockMap.set(s.productPfId, prev + (s.movementType === 'IN' ? qty : -qty));
    }

    const lastMovementMap = new Map<number, Date>();
    for (const lm of lastMovements) {
      if (lm.productPfId && lm._max.createdAt) {
        lastMovementMap.set(lm.productPfId, lm._max.createdAt);
      }
    }

    return products.map((p) => {
      const currentStock = stockMap.get(p.id) || 0;
      const stockValue = currentStock * p.priceHt;
      return {
        productId: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        minStock: p.minStock,
        priceHt: p.priceHt,
        currentStock,
        stockValue,
        status: this.getStockStatus(currentStock, p.minStock),
        lastMovementAt: lastMovementMap.get(p.id),
      };
    });
  }

  async getMovements(
    productType: ProductType,
    productId: number,
    limit = 50,
  ) {
    return this.prisma.stockMovement.findMany({
      where: {
        productType,
        ...(productType === 'MP' ? { productMpId: productId } : { productPfId: productId }),
        isDeleted: false,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getStockAlerts() {
    const stockMp = await this.getStockMp();
    const stockPf = await this.getStockPf();

    return {
      mp: {
        rupture: stockMp.filter((s) => s.status === 'RUPTURE'),
        alerte: stockMp.filter((s) => s.status === 'ALERTE'),
        total: stockMp.filter((s) => s.status !== 'OK').length,
      },
      pf: {
        rupture: stockPf.filter((s) => s.status === 'RUPTURE'),
        alerte: stockPf.filter((s) => s.status === 'ALERTE'),
        total: stockPf.filter((s) => s.status !== 'OK').length,
      },
    };
  }

  async getTotalStockValue() {
    const stockPf = await this.getStockPf();
    const pfValue = stockPf.reduce((sum, s) => sum + (s.stockValue || 0), 0);
    
    return {
      pf: pfValue,
      formattedPf: `${(pfValue / 100).toLocaleString('fr-DZ')} DA`,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * DÉCLARATION DE PERTE - ADMIN uniquement
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async declareLoss(
    data: {
      productType: ProductType;
      productId: number;
      lotId?: number;
      quantity: number;
      reason: string;
      description: string;
      evidencePhotos?: string[];
    },
    userId: string,
    userRole: UserRole,
  ) {
    // 1. Vérification rôle ADMIN
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'ADMIN_ONLY',
        message: 'Seul un ADMIN peut déclarer une perte',
      });
    }

    // 2. Valider combinaison mouvement
    this.validateMovementCombination(data.productType, 'PERTE', 'OUT');

    // 3-4. Créer mouvement de perte dans une transaction (stock check inside)
    const result = await this.prisma.$transaction(async (tx) => {
      // Vérifier stock suffisant (inside transaction to prevent race condition)
      const currentStock = await this.calculateStockInTransaction(tx, data.productType, data.productId);
      if (currentStock < data.quantity) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: `Stock insuffisant pour déclarer cette perte. Stock actuel: ${currentStock}, Quantité demandée: ${data.quantity}`,
          currentStock,
          requested: data.quantity,
        });
      }

      // Créer le mouvement OUT
      const movement = await tx.stockMovement.create({
        data: {
          movementType: 'OUT',
          productType: data.productType,
          origin: 'PERTE',
          ...(data.productType === 'MP'
            ? { productMpId: data.productId }
            : { productPfId: data.productId }),
          ...(data.lotId && data.productType === 'MP' ? { lotMpId: data.lotId } : {}),
          ...(data.lotId && data.productType === 'PF' ? { lotPfId: data.lotId } : {}),
          quantity: data.quantity,
          userId,
          note: `[${data.reason}] ${data.description}`,
          idempotencyKey: `LOSS-${data.productType}-${data.productId}-${userId}-${data.quantity}`,
        },
      });

      // Si lot spécifié, vérifier quantité restante puis mettre à jour
      if (data.lotId) {
        if (data.productType === 'MP') {
          const lot = await tx.lotMp.findUnique({ where: { id: data.lotId }, select: { quantityRemaining: true } });
          if (!lot || lot.quantityRemaining < data.quantity) {
            throw new BadRequestException('Quantité restante du lot insuffisante pour cette perte');
          }
          await tx.lotMp.update({
            where: { id: data.lotId },
            data: {
              quantityRemaining: { decrement: data.quantity },
            },
          });
        } else {
          const lot = await tx.lotPf.findUnique({ where: { id: data.lotId }, select: { quantityRemaining: true } });
          if (!lot || lot.quantityRemaining < data.quantity) {
            throw new BadRequestException('Quantité restante du lot insuffisante pour cette perte');
          }
          await tx.lotPf.update({
            where: { id: data.lotId },
            data: {
              quantityRemaining: { decrement: data.quantity },
            },
          });
        }
      }

      // Audit log
      await this.auditService.log({
        actor: { id: userId, role: userRole },
        action: 'STOCK_MOVEMENT_CREATED',
        severity: 'WARNING',
        entityType: data.productType === 'MP' ? 'ProductMp' : 'ProductPf',
        entityId: String(data.productId),
        metadata: {
          movementId: movement.id,
          origin: 'PERTE',
          reason: data.reason,
          description: data.description,
          quantity: data.quantity,
          lotId: data.lotId,
          evidencePhotos: data.evidencePhotos,
        },
      });

      return {
        success: true,
        movementId: movement.id,
        message: `Perte de ${data.quantity} unités déclarée avec succès`,
        newStock: currentStock - data.quantity,
      };
    });

    // Invalidate stock cache after loss declaration
    await this.cacheService.invalidateStockCache();

    return result;
  }
}
