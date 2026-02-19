import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeService } from './recipe.service';
import { LotConsumptionService } from '../stock/lot-consumption.service';
import { LoggerService } from '../common/logger/logger.service';
import { AuditService } from '../common/audit/audit.service';
import { CacheService } from '../cache/cache.service';
import PdfPrinter from 'pdfmake';
import * as path from 'path';
import * as fs from 'fs';

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION SERVICE - Gestion des ordres de production avec FIFO
// ═══════════════════════════════════════════════════════════════════════════════

interface CreateProductionOrderDto {
  productPfId: number;
  batchCount: number;
  notes?: string;
  scheduledDate?: string; // Date ISO planifiée
}

interface CompleteProductionDto {
  quantityProduced: number;
  batchWeightReal?: number;
  qualityNotes?: string;
  qualityStatus?: string;
}

@Injectable()
export class ProductionService {
  constructor(
    private prisma: PrismaService,
    private recipeService: RecipeService,
    private lotConsumption: LotConsumptionService,
    private logger: LoggerService,
    private audit: AuditService,
    private cacheService: CacheService,
  ) {
    this.logger.setContext('ProductionService');
  }

  /**
   * Générer une référence unique pour l'ordre de production
   */
  private async generateReference(maxRetries = 3): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '');

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const lastOrder = await this.prisma.productionOrder.findFirst({
        where: {
          reference: { startsWith: `OP-${dateStr}` },
        },
        orderBy: { reference: 'desc' },
      });

      let sequence = 1;
      if (lastOrder) {
        const part = lastOrder.reference.split('-')[2];
        const lastSeq = part ? parseInt(part, 10) : 0;
        sequence = isNaN(lastSeq) ? 1 : lastSeq + 1;
      }

      const reference = `OP-${dateStr}-${sequence.toString().padStart(3, '0')}`;

      // Verify uniqueness before returning
      const exists = await this.prisma.productionOrder.findFirst({
        where: { reference },
      });

      if (!exists) return reference;

      // Race condition: another order took this reference, retry
      this.logger.warn(
        `Reference collision for ${reference}, retry ${attempt + 1}/${maxRetries}`,
        'ProductionService',
      );
    }

    // Fallback: use timestamp-based suffix for near-guaranteed uniqueness
    const ts = Date.now().toString(36).slice(-6);
    const fallbackRef = `OP-${dateStr}-${ts}`;
    this.logger.warn(`Using fallback reference: ${fallbackRef}`, 'ProductionService');
    return fallbackRef;
  }

  /**
   * Générer un numéro de lot pour le PF produit
   * Inclut un mécanisme de retry pour garantir l'unicité en cas de concurrence
   */
  private async generateLotNumber(productCode: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `${productCode}-${dateStr}`;

    const lastLot = await this.prisma.lotPf.findFirst({
      where: {
        lotNumber: { startsWith: prefix },
      },
      orderBy: { lotNumber: 'desc' },
    });

    let sequence = 1;
    if (lastLot) {
      const parts = lastLot.lotNumber.split('-');
      const lastPart = parts[parts.length - 1];
      const lastSeq = lastPart ? parseInt(lastPart, 10) : 0;
      sequence = isNaN(lastSeq) ? 1 : lastSeq + 1;
    }

    let lotNumber = `${prefix}-${sequence.toString().padStart(3, '0')}`;

    // Vérification unicité avec retry (protection race condition)
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await this.prisma.lotPf.findFirst({
        where: { lotNumber },
        select: { id: true },
      });
      if (!existing) return lotNumber;

      // Collision détectée — incrémenter et réessayer
      sequence++;
      lotNumber = `${prefix}-${sequence.toString().padStart(3, '0')}`;
      this.logger.warn(`Lot number collision, retry #${attempt + 1}: ${lotNumber}`, 'ProductionService');
    }

    // Fallback ultime avec timestamp
    const ts = Date.now().toString(36).slice(-6);
    const fallbackLot = `${prefix}-${ts}`;
    this.logger.warn(`Using fallback lot number: ${fallbackLot}`, 'ProductionService');
    return fallbackLot;
  }

  /**
   * Liste tous les ordres de production
   */
  async findAll(filters?: { status?: string; productPfId?: number; limit?: number }) {
    const where: any = {};
    
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.productPfId) {
      where.productPfId = filters.productPfId;
    }

    const orders = await this.prisma.productionOrder.findMany({
      where,
      include: {
        productPf: {
          select: { id: true, code: true, name: true, unit: true },
        },
        recipe: {
          select: { id: true, name: true, batchWeight: true, outputQuantity: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { consumptions: true, lots: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
    });

    return orders;
  }

  /**
   * Récupérer un ordre de production par ID
   */
  async findById(id: number) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        productPf: {
          select: { id: true, code: true, name: true, unit: true, priceHt: true },
        },
        recipe: {
          include: {
            items: {
              include: {
                productMp: {
                  select: { id: true, code: true, name: true, unit: true },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        consumptions: {
          include: {
            productMp: {
              select: { id: true, code: true, name: true, unit: true },
            },
            lotMp: {
              select: { id: true, lotNumber: true, expiryDate: true },
            },
          },
        },
        lots: {
          select: {
            id: true,
            lotNumber: true,
            quantityInitial: true,
            quantityRemaining: true,
            manufactureDate: true,
            expiryDate: true,
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Ordre de production #${id} introuvable`);
    }

    return order;
  }

  /**
   * Créer un nouvel ordre de production
   */
  async create(dto: CreateProductionOrderDto, userId: string) {
    // Vérifier que le produit PF existe
    const productPf = await this.prisma.productPf.findUnique({
      where: { id: dto.productPfId },
      include: { recipe: { include: { items: true } } },
    });

    if (!productPf) {
      throw new NotFoundException(`Produit fini #${dto.productPfId} introuvable`);
    }

    // Vérifier qu'une recette existe
    if (!productPf.recipe) {
      throw new BadRequestException(
        `Aucune recette définie pour le produit ${productPf.code}. Créez d'abord une recette.`
      );
    }

    const recipe = productPf.recipe;

    // Vérifier la complétude de la recette (aligné avec les checks frontend)
    if (!recipe.items || recipe.items.length === 0) {
      throw new BadRequestException(
        `La recette "${recipe.name}" n'a aucun ingrédient. Ajoutez au moins une matière première.`
      );
    }
    if (!recipe.batchWeight || Number(recipe.batchWeight) <= 0) {
      throw new BadRequestException(
        `La recette "${recipe.name}" n'a pas de poids de batch défini (batchWeight doit être > 0).`
      );
    }
    if (!recipe.outputQuantity || Number(recipe.outputQuantity) <= 0) {
      throw new BadRequestException(
        `La recette "${recipe.name}" n'a pas de quantité de sortie définie (outputQuantity doit être > 0).`
      );
    }

    // Vérifier la disponibilité des stocks
    const stockCheck = await this.recipeService.checkStockAvailability(
      recipe.id,
      dto.batchCount
    );

    if (!stockCheck.canProduce) {
      const shortages = stockCheck.availability
        .filter((a: any) => !a.isAvailable && a.isMandatory)
        .map((a: any) => `${a.productMp.code}: manque ${a.shortage} ${a.productMp.unit}`)
        .join(', ');
      
      throw new BadRequestException(
        `Stock insuffisant pour la production: ${shortages}`
      );
    }

    // Générer la référence
    const reference = await this.generateReference();

    // Calculer la quantité cible
    const targetQuantity = recipe.outputQuantity * dto.batchCount;

    // Créer l'ordre de production
    const order = await this.prisma.productionOrder.create({
      data: {
        reference,
        productPfId: dto.productPfId,
        recipeId: recipe.id,
        batchCount: dto.batchCount,
        targetQuantity,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
        status: 'PENDING',
        userId,
      },
      include: {
        productPf: {
          select: { id: true, code: true, name: true, unit: true },
        },
        recipe: {
          select: { id: true, name: true, batchWeight: true, outputQuantity: true },
        },
      },
    });

    return order;
  }

  /**
   * Démarrer une production - Consomme les MP en FIFO via LotConsumptionService
   * 
   * RÈGLE MÉTIER:
   *   - Consommation FIFO stricte via service dédié
   *   - Lots BLOCKED interdits de consommation
   *   - Transaction atomique avec SELECT FOR UPDATE
   */
  async start(id: number, userId: string) {
    const order = await this.findById(id);

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        `Impossible de démarrer: statut actuel = ${order.status}`
      );
    }

    if (!order.recipe) {
      throw new BadRequestException('Aucune recette associée à cet ordre');
    }

    // 1. Prévisualiser les consommations FIFO pour chaque MP
    const consumptionPreviews: Array<{
      item: any;
      preview: any;
    }> = [];

    for (const item of order.recipe.items) {
      if (!item.productMpId || !item.affectsStock) continue;

      const qtyPerBatch = Number(item.quantity);
      const requiredQty = Math.round(qtyPerBatch * order.batchCount * 100) / 100;
      const preview = await this.lotConsumption.previewFIFO(
        item.productMpId,
        requiredQty,
      );

      if (!preview.sufficient && item.isMandatory) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: `Stock insuffisant pour ${item.productMp?.code || 'MP#' + item.productMpId}: besoin ${requiredQty}, disponible ${preview.availableStock}`,
          productMpId: item.productMpId,
          required: requiredQty,
          available: preview.availableStock,
        });
      }

      consumptionPreviews.push({ item, preview });
    }

    // 2. Consommer en FIFO via le service (chaque appel est une transaction Serializable)
    //    Note: chaque consumeFIFO est atomique individuellement. Les consommations
    //    détaillées sont créées en batch après toutes les consommations FIFO.
    const consumptionResults: Array<{
      productMpId: number;
      requiredQty: number;
      result: any;
    }> = [];

    try {
      for (const { item, preview } of consumptionPreviews) {
        if (!preview.sufficient && !item.isMandatory) {
          // Skip optional items with insufficient stock
          continue;
        }

        const requiredQty = Math.round(Number(item.quantity) * order.batchCount * 100) / 100;
        const idempotencyKey = `PROD-${order.id}-${item.productMpId}`;

        const result = await this.lotConsumption.consumeFIFO(
          item.productMpId,
          requiredQty,
          'PRODUCTION_OUT',
          userId,
          {
            referenceType: 'PRODUCTION',
            referenceId: order.id,
            reference: order.reference,
            idempotencyKey,
          },
        );

        consumptionResults.push({
          productMpId: item.productMpId,
          requiredQty,
          result,
        });
      }

      // P5: Fetch unitCost for all consumed lots in a single batch query
      const allConsumedLotIds = consumptionResults.flatMap(
        (cr) => cr.result.consumptions.map((c: any) => c.lotId),
      );
      const lotCosts = allConsumedLotIds.length > 0
        ? await this.prisma.lotMp.findMany({
            where: { id: { in: allConsumedLotIds } },
            select: { id: true, unitCost: true },
          })
        : [];
      const lotCostMap = new Map(lotCosts.map((l) => [l.id, l.unitCost || 0]));

      // Create detailed consumption records in a single transaction
      await this.prisma.$transaction(
        consumptionResults.flatMap(({ productMpId, requiredQty: _requiredQty, result }) =>
          result.consumptions.map((consumption: any) =>
            this.prisma.productionConsumption.create({
              data: {
                productionOrderId: order.id,
                productMpId,
                lotMpId: consumption.lotId,
                quantityPlanned: consumption.quantity,
                quantityConsumed: consumption.quantity,
                unitCost: lotCostMap.get(consumption.lotId) ?? null,
              },
            }),
          ),
        ),
      );
    } catch (error) {
      // Log l'erreur et la remonter
      this.logger.error(
        `Échec consommation FIFO pour production ${order.reference}`,
        error instanceof Error ? error.stack : String(error),
        'ProductionService',
      );

      // Bug #2: Compensate already-committed FIFO consumptions
      for (const { productMpId, result } of consumptionResults) {
        try {
          for (const c of result.consumptions) {
            await this.prisma.lotMp.update({
              where: { id: c.lotId },
              data: {
                quantityRemaining: { increment: c.quantity },
                status: 'AVAILABLE',
                consumedAt: null,
              },
            });
            await this.prisma.stockMovement.create({
              data: {
                movementType: 'IN',
                productType: 'MP',
                origin: 'PRODUCTION_CANCEL',
                productMpId,
                lotMpId: c.lotId,
                quantity: c.quantity,
                userId,
                reference: `ROLLBACK-${order.reference}`,
              },
            });
          }
        } catch (reverseErr) {
          // Log but don't mask the original error
        }
      }

      throw error;
    }

    // 3. Mettre à jour le statut de l'ordre
    const updated = await this.prisma.productionOrder.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        startedBy: userId,
      },
      include: {
        productPf: {
          select: { id: true, code: true, name: true, unit: true },
        },
        consumptions: {
          include: {
            productMp: {
              select: { id: true, code: true, name: true, unit: true },
            },
            lotMp: {
              select: { id: true, lotNumber: true, expiryDate: true },
            },
          },
        },
      },
    });

    // 4. Audit
    await this.audit.log({
      actor: { id: userId, role: 'PRODUCTION' as any },
      action: 'PRODUCTION_ORDER_STARTED' as any,
      entityType: 'ProductionOrder',
      entityId: String(order.id),
      metadata: {
        reference: order.reference,
        productPfId: order.productPfId,
        batchCount: order.batchCount,
        consumptionsCount: consumptionResults.length,
        totalLotsUsed: consumptionResults.reduce(
          (sum, c) => sum + c.result.lotsUsed,
          0,
        ),
      },
    });

    // P17: Invalidate cache after production start (stock changed)
    await this.cacheService.invalidateStockCache();
    await this.cacheService.invalidateProductionCache();

    return updated;
  }

  /**
   * Terminer une production - Crée le lot PF
   */
  async complete(id: number, dto: CompleteProductionDto, userId: string) {
    // Bug #38b: Validate quantityProduced
    if (dto.quantityProduced <= 0) {
      throw new BadRequestException('La quantité produite doit être strictement positive');
    }

    const order = await this.findById(id);

    if (order.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Impossible de terminer: statut actuel = ${order.status}`
      );
    }

    // Calculer le rendement (guard division par zéro)
    const yieldPercentage = order.targetQuantity > 0
      ? (dto.quantityProduced / order.targetQuantity) * 100
      : 0;

    // Vérifier la tolérance de perte
    if (order.recipe) {
      const minAcceptable = order.targetQuantity * (1 - Number(order.recipe.lossTolerance));
      if (dto.quantityProduced < minAcceptable) {
        // Juste un warning, on ne bloque pas
        this.logger.businessWarn(
          'PRODUCTION_LOW_YIELD',
          `Rendement ${yieldPercentage.toFixed(1)}% inférieur à la tolérance`,
          {
            entityType: 'PRODUCTION',
            entityId: order.id,
            metadata: { reference: order.reference, yieldPercentage, minAcceptable },
          },
        );
      }
    }

    // Générer le numéro de lot
    const lotNumber = await this.generateLotNumber(order.productPf.code);

    // Calculer la DLC
    const manufactureDate = new Date();
    let expiryDate: Date | null = null;
    if (order.recipe?.shelfLifeDays) {
      expiryDate = new Date(manufactureDate);
      expiryDate.setDate(expiryDate.getDate() + order.recipe.shelfLifeDays);
    }

    // Calculer le coût de revient (somme des consommations)
    const totalCost = order.consumptions.reduce((sum, c) => {
      return sum + (Number(c.quantityConsumed) * (c.unitCost || 0));
    }, 0);
    const unitCost = dto.quantityProduced > 0 
      ? Math.round(totalCost / dto.quantityProduced) 
      : 0;

    // Transaction atomique : lot PF + mouvement stock + mise à jour ordre
    const { updated, lot } = await this.prisma.$transaction(async (tx) => {
      // Créer le lot PF avec status AVAILABLE
      const createdLot = await tx.lotPf.create({
        data: {
          productId: order.productPfId,
          lotNumber,
          quantityInitial: dto.quantityProduced,
          quantityRemaining: dto.quantityProduced,
          manufactureDate,
          expiryDate,
          productionOrderId: order.id,
          unitCost,
          isActive: true,
          status: 'AVAILABLE',
        },
      });

      // Créer le mouvement de stock
      await tx.stockMovement.create({
        data: {
          movementType: 'IN',
          productType: 'PF',
          origin: 'PRODUCTION_IN',
          productPfId: order.productPfId,
          lotPfId: createdLot.id,
          quantity: dto.quantityProduced,
          unitCost,
          referenceType: 'PRODUCTION',
          referenceId: order.id,
          reference: order.reference,
          userId,
        },
      });

      // Mettre à jour l'ordre
      const updatedOrder = await tx.productionOrder.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          quantityProduced: dto.quantityProduced,
          batchWeightReal: dto.batchWeightReal,
          yieldPercentage,
          qualityNotes: dto.qualityNotes,
          qualityStatus: dto.qualityStatus || 'OK',
          completedAt: new Date(),
          completedBy: userId,
        },
        include: {
          productPf: {
            select: { id: true, code: true, name: true, unit: true },
          },
          lots: {
            select: {
              id: true,
              lotNumber: true,
              quantityInitial: true,
              manufactureDate: true,
              expiryDate: true,
              unitCost: true,
            },
          },
        },
      });

      return { updated: updatedOrder, lot: createdLot };
    });

    // P17: Invalidate cache after production complete
    await this.cacheService.invalidateStockCache();
    await this.cacheService.invalidateProductionCache();

    return {
      ...updated,
      createdLot: lot,
    };
  }

  /**
   * Annuler une production
   */
  async cancel(id: number, userId: string, reason?: string) {
    const order = await this.findById(id);

    if (order.status === 'COMPLETED') {
      throw new BadRequestException(
        'Impossible d\'annuler une production terminée'
      );
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Cet ordre de production est déjà annulé');
    }

    // Si la production était en cours, on doit reverser les consommations
    if (order.status === 'IN_PROGRESS') {
      // P10: Reverse consumptions in a transaction for atomicity
      await this.prisma.$transaction(async (tx) => {
        for (const consumption of order.consumptions) {
          if (!consumption.lotMpId) continue;

          // Fetch current lot state to determine correct status after reversal
          const lot = await tx.lotMp.findUnique({
            where: { id: consumption.lotMpId },
            select: { quantityRemaining: true, status: true },
          });

          if (!lot) continue;

          const restoredQty = Number(consumption.quantityConsumed);
          const newQty = Number(lot.quantityRemaining || 0) + restoredQty;

          // Déterminer le nouveau statut du lot après restauration:
          // - CONSUMED → AVAILABLE (le lot était entièrement consommé par cette production)
          // - BLOCKED → reste BLOCKED mais quantité restaurée pour traçabilité
          //   NOTE: Ne pas restaurer la quantité d'un lot BLOCKED (expiré/qualité),
          //   car ce stock n'est pas utilisable. On crée le mouvement de retour
          //   pour la traçabilité mais on ne rend pas le stock disponible.
          const isBlocked = lot.status === 'BLOCKED';

          await tx.lotMp.update({
            where: { id: consumption.lotMpId },
            data: {
              // Si le lot est BLOCKED, on restaure quand même la quantité pour cohérence comptable
              // mais le stock reste inutilisable (status BLOCKED)
              quantityRemaining: newQty,
              isActive: true,
              status: lot.status === 'CONSUMED' ? 'AVAILABLE' : lot.status,
              consumedAt: lot.status === 'CONSUMED' ? null : undefined,
            },
          });

          // Créer un mouvement de retour avec origin correct
          await tx.stockMovement.create({
            data: {
              movementType: 'IN',
              productType: 'MP',
              origin: 'PRODUCTION_CANCEL',
              productMpId: consumption.productMpId,
              lotMpId: consumption.lotMpId,
              quantity: restoredQty,
              referenceType: 'PRODUCTION',
              referenceId: order.id,
              reference: `ANNUL-${order.reference}`,
              userId,
              note: isBlocked
                ? `[LOT BLOQUÉ] ${reason || 'Annulation production'} — Lot ${consumption.lotMpId} bloqué, stock non disponible`
                : (reason || 'Annulation production'),
            },
          });
        }

        // Marquer les consommations comme annulées (traçabilité — ne PAS supprimer)
        await tx.productionConsumption.updateMany({
          where: { productionOrderId: id, isReversed: false },
          data: { isReversed: true, reversedAt: new Date() },
        });
      });

      // Audit de l'annulation
      await this.audit.log({
        actor: { id: userId, role: 'PRODUCTION' as any },
        action: 'PRODUCTION_ORDER_CANCELLED' as any,
        severity: 'WARNING' as any,
        entityType: 'ProductionOrder',
        entityId: String(order.id),
        metadata: {
          reference: order.reference,
          reason,
          consumptionsReversed: order.consumptions.length,
        },
      });
    }

    // Mettre à jour le statut
    const updated = await this.prisma.productionOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        qualityNotes: reason,
      },
    });

    // P17: Invalidate cache after cancellation (stock may have changed)
    await this.cacheService.invalidateStockCache();
    await this.cacheService.invalidateProductionCache();

    return updated;
  }

  /**
   * Dashboard KPIs - Production metrics
   */
  async getDashboardKpis() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const blockedThreshold = new Date();
    blockedThreshold.setHours(blockedThreshold.getHours() - 24);

    // P15: Use count/aggregate instead of findMany+reduce (6 parallel queries)
    const [
      todayCounts,
      todayProduced,
      weekStats,
      lowYieldCount,
      monthStats,
      activeOrders,
      blockedOrders,
    ] = await Promise.all([
      // Today's counts by status
      this.prisma.productionOrder.groupBy({
        by: ['status'],
        where: { createdAt: { gte: today, lt: tomorrow } },
        _count: true,
      }),
      // Today's total produced
      this.prisma.productionOrder.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow }, status: 'COMPLETED' },
        _sum: { quantityProduced: true },
      }),
      // Weekly aggregate
      this.prisma.productionOrder.aggregate({
        where: { completedAt: { gte: weekAgo }, status: 'COMPLETED' },
        _sum: { quantityProduced: true },
        _avg: { yieldPercentage: true },
        _count: true,
      }),
      // Low yield count this week
      this.prisma.productionOrder.count({
        where: { completedAt: { gte: weekAgo }, status: 'COMPLETED', yieldPercentage: { lt: 90 } },
      }),
      // Monthly aggregate
      this.prisma.productionOrder.aggregate({
        where: { completedAt: { gte: monthAgo }, status: 'COMPLETED' },
        _sum: { quantityProduced: true },
        _count: true,
      }),
      // Active orders
      this.prisma.productionOrder.count({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      // Blocked orders
      this.prisma.productionOrder.count({
        where: { status: 'PENDING', createdAt: { lt: blockedThreshold } },
      }),
    ]);

    const todayByStatus = new Map(todayCounts.map((c) => [c.status, c._count]));

    return {
      today: {
        completed: todayByStatus.get('COMPLETED') || 0,
        inProgress: todayByStatus.get('IN_PROGRESS') || 0,
        pending: todayByStatus.get('PENDING') || 0,
        totalProduced: todayProduced._sum.quantityProduced || 0,
      },
      week: {
        completed: weekStats._count,
        totalProduced: weekStats._sum.quantityProduced || 0,
        avgYield: Math.round((Number(weekStats._avg.yieldPercentage) || 0) * 10) / 10,
        lowYieldCount,
      },
      month: {
        completed: monthStats._count,
        totalProduced: monthStats._sum.quantityProduced || 0,
      },
      activeOrders,
      blockedOrders,
    };
  }

  /**
   * Production Alerts
   */
  async getAlerts() {
    const alerts: Array<{
      id: string;
      type: 'DLC_PROCHE' | 'RENDEMENT_FAIBLE' | 'ORDRE_BLOQUE' | 'STOCK_PF_BAS';
      severity: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      link?: string;
      data?: any;
      createdAt: Date;
    }> = [];

    // 1. DLC proches (PF expirant dans 7 jours)
    const dlcThreshold = new Date();
    dlcThreshold.setDate(dlcThreshold.getDate() + 7);
    
    const expiringLots = await this.prisma.lotPf.findMany({
      where: {
        isActive: true,
        quantityRemaining: { gt: 0 },
        expiryDate: { lte: dlcThreshold, gt: new Date() },
      },
      include: {
        product: { select: { id: true, code: true, name: true, unit: true } },
      },
      orderBy: { expiryDate: 'asc' },
      take: 10,
    });

    for (const lot of expiringLots) {
      if (!lot.expiryDate) continue; // Sécurité: filtré par la query mais TypeScript ne le sait pas
      const daysLeft = Math.ceil((lot.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: `dlc-${lot.id}`,
        type: 'DLC_PROCHE',
        severity: daysLeft <= 3 ? 'critical' : 'warning',
        title: `DLC proche: ${lot.product.name}`,
        description: `Lot ${lot.lotNumber} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} (${lot.quantityRemaining} ${lot.product.unit} restants)`,
        link: `/dashboard/stock/pf/${lot.product.id}`,
        data: { lotId: lot.id, productId: lot.product.id, daysLeft },
        createdAt: lot.expiryDate!,
      });
    }

    // 2. Rendements faibles (< 90%) des 7 derniers jours
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const lowYieldOrders = await this.prisma.productionOrder.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: weekAgo },
        yieldPercentage: { lt: 90 },
      },
      include: {
        productPf: { select: { id: true, code: true, name: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
    });

    for (const order of lowYieldOrders) {
      alerts.push({
        id: `yield-${order.id}`,
        type: 'RENDEMENT_FAIBLE',
        severity: (Number(order.yieldPercentage) || 0) < 80 ? 'critical' : 'warning',
        title: `Rendement faible: ${order.reference}`,
        description: `${order.productPf.name} - Rendement ${(Number(order.yieldPercentage) || 0).toFixed(1)}% (cible: 100%)`,
        link: `/dashboard/production/order/${order.id}`,
        data: { orderId: order.id, yield: order.yieldPercentage },
        createdAt: order.completedAt!,
      });
    }

    // 3. Ordres bloqués (PENDING > 24h)
    const blockedThreshold = new Date();
    blockedThreshold.setHours(blockedThreshold.getHours() - 24);

    const blockedOrders = await this.prisma.productionOrder.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: blockedThreshold },
      },
      include: {
        productPf: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });

    for (const order of blockedOrders) {
      const hoursBlocked = Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60));
      alerts.push({
        id: `blocked-${order.id}`,
        type: 'ORDRE_BLOQUE',
        severity: hoursBlocked > 48 ? 'critical' : 'warning',
        title: `Ordre bloqué: ${order.reference}`,
        description: `${order.productPf.name} - En attente depuis ${hoursBlocked}h`,
        link: `/dashboard/production/order/${order.id}`,
        data: { orderId: order.id, hoursBlocked },
        createdAt: order.createdAt,
      });
    }

    // 4. Stock PF bas (P6: batch query instead of N+1)
    const pfProducts = await this.prisma.productPf.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, unit: true, minStock: true },
    });

    const pfProductIds = pfProducts.map((p) => p.id);
    const pfStockAgg = pfProductIds.length > 0
      ? await this.prisma.lotPf.groupBy({
          by: ['productId'],
          where: { productId: { in: pfProductIds }, isActive: true },
          _sum: { quantityRemaining: true },
        })
      : [];
    const pfStockMap = new Map(pfStockAgg.map((s) => [s.productId, s._sum.quantityRemaining || 0]));

    for (const pf of pfProducts) {
      const currentStock = pfStockMap.get(pf.id) || 0;
      if (currentStock < pf.minStock) {
        const ratio = pf.minStock > 0 ? currentStock / pf.minStock : 0;
        alerts.push({
          id: `stock-${pf.id}`,
          type: 'STOCK_PF_BAS',
          severity: ratio < 0.25 ? 'critical' : 'warning',
          title: `Stock bas: ${pf.name}`,
          description: `${currentStock} ${pf.unit} (minimum: ${pf.minStock} ${pf.unit})`,
          link: `/dashboard/stock/pf/${pf.id}`,
          data: { productId: pf.id, currentStock, minStock: pf.minStock },
          createdAt: new Date(),
        });
      }
    }

    // Sort by severity then by date
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      alerts,
    };
  }

  /**
   * Stock PF summary for dashboard
   */
  async getStockPfSummary() {
    const products = await this.prisma.productPf.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        minStock: true,
        priceHt: true,
        recipe: { select: { id: true, name: true, outputQuantity: true } },
      },
    });

    // P7: Batch stock query instead of N+1
    const productIds = products.map((p) => p.id);
    const stockAgg = productIds.length > 0
      ? await this.prisma.lotPf.groupBy({
          by: ['productId'],
          where: { productId: { in: productIds }, isActive: true },
          _sum: { quantityRemaining: true },
        })
      : [];
    const stockMap = new Map(stockAgg.map((s) => [s.productId, s._sum.quantityRemaining || 0]));

    const result = products.map((pf) => {
      const currentStock = stockMap.get(pf.id) || 0;
      const status = currentStock === 0 ? 'rupture' : currentStock < pf.minStock ? 'bas' : 'ok';
      return {
        ...pf,
        currentStock,
        status,
        coverage: pf.minStock > 0 ? Math.round((currentStock / pf.minStock) * 100) : 100,
      };
    });

    // Sort: rupture first, then bas, then ok
    const statusOrder: Record<string, number> = { rupture: 0, bas: 1, ok: 2 };
    result.sort((a, b) => (statusOrder[a.status] || 2) - (statusOrder[b.status] || 2));

    return result;
  }

  /**
   * Production calendar - next 7 days planning
   */
  async getCalendar(days: number = 7) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    // P30: Filter by date range to avoid loading all historical orders
    const orders = await this.prisma.productionOrder.findMany({
      where: {
        OR: [
          { status: { in: ['PENDING', 'IN_PROGRESS'] }, createdAt: { lte: endDate } },
          {
            status: 'COMPLETED',
            completedAt: { gte: today, lte: endDate },
          },
        ],
      },
      include: {
        productPf: { select: { id: true, code: true, name: true, unit: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const calendar: Record<string, any[]> = {};
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      calendar[dateStr] = [];
    }

    for (const order of orders) {
      const orderDate = order.startedAt || order.createdAt;
      const dateStr = orderDate.toISOString().split('T')[0];
      if (calendar[dateStr]) {
        calendar[dateStr].push(order);
      }
    }

    return {
      startDate: today.toISOString(),
      endDate: endDate.toISOString(),
      days: Object.entries(calendar).map(([date, orders]) => ({
        date,
        dayName: new Date(date).toLocaleDateString('fr-FR', { weekday: 'short' }),
        orders,
        totalOrders: orders.length,
        pending: orders.filter((o: any) => o.status === 'PENDING').length,
        inProgress: orders.filter((o: any) => o.status === 'IN_PROGRESS').length,
        completed: orders.filter((o: any) => o.status === 'COMPLETED').length,
      })),
    };
  }

  /**
   * Lot traceability - search by lot number
   */
  async searchLots(query: string, type?: 'MP' | 'PF') {
    const results: any[] = [];

    if (!type || type === 'PF') {
      const lotsPf = await this.prisma.lotPf.findMany({
        where: {
          lotNumber: { contains: query, mode: 'insensitive' },
        },
        include: {
          product: { select: { id: true, code: true, name: true, unit: true } },
          productionOrder: {
            select: {
              id: true,
              reference: true,
              createdAt: true,
              consumptions: {
                include: {
                  productMp: { select: { code: true, name: true } },
                  lotMp: { select: { lotNumber: true } },
                },
              },
            },
          },
        },
        take: 20,
      });

      for (const lot of lotsPf) {
        results.push({
          type: 'PF',
          lot: {
            id: lot.id,
            lotNumber: lot.lotNumber,
            product: lot.product,
            quantityInitial: lot.quantityInitial,
            quantityRemaining: lot.quantityRemaining,
            manufactureDate: lot.manufactureDate,
            expiryDate: lot.expiryDate,
          },
          traceability: lot.productionOrder ? {
            productionOrder: {
              id: lot.productionOrder.id,
              reference: lot.productionOrder.reference,
              date: lot.productionOrder.createdAt,
            },
            mpConsumed: lot.productionOrder.consumptions.map(c => ({
              mp: c.productMp,
              lotNumber: c.lotMp?.lotNumber,
              quantity: c.quantityConsumed,
            })),
          } : null,
        });
      }
    }

    if (!type || type === 'MP') {
      const lotsMp = await this.prisma.lotMp.findMany({
        where: {
          lotNumber: { contains: query, mode: 'insensitive' },
        },
        include: {
          product: { select: { id: true, code: true, name: true, unit: true } },
          supplier: { select: { id: true, code: true, name: true } },
          productionConsumptions: {
            where: { isReversed: false },
            include: {
              productionOrder: {
                select: {
                  id: true,
                  reference: true,
                  productPf: { select: { code: true, name: true } },
                  lots: { select: { lotNumber: true } },
                },
              },
            },
          },
        },
        take: 20,
      });

      for (const lot of lotsMp) {
        results.push({
          type: 'MP',
          lot: {
            id: lot.id,
            lotNumber: lot.lotNumber,
            product: lot.product,
            supplier: lot.supplier,
            quantityInitial: lot.quantityInitial,
            quantityRemaining: lot.quantityRemaining,
            receptionDate: lot.createdAt,
            expiryDate: lot.expiryDate,
          },
          traceability: {
            usedIn: lot.productionConsumptions.map(c => ({
              productionOrder: {
                id: c.productionOrder.id,
                reference: c.productionOrder.reference,
              },
              productPf: c.productionOrder.productPf,
              lotsPfProduced: c.productionOrder.lots.map(l => l.lotNumber),
              quantityConsumed: c.quantityConsumed,
            })),
          },
        });
      }
    }

    return {
      query,
      total: results.length,
      results,
    };
  }

  /**
   * Analytics - production trends
   */
  async getAnalytics(period: 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;
    let groupBy: 'day' | 'week' | 'month';

    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        groupBy = 'day';
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        groupBy = 'day';
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        groupBy = 'month';
        break;
    }

    // Get all completed orders in period
    const orders = await this.prisma.productionOrder.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: startDate },
      },
      include: {
        productPf: { select: { id: true, code: true, name: true } },
      },
      orderBy: { completedAt: 'asc' },
    });

    // Group by date
    const productionByDate: Record<string, { date: string; quantity: number; orders: number; avgYield: number; yields: number[] }> = {};
    const productionByProduct: Record<number, { product: any; quantity: number; orders: number; avgYield: number }> = {};

    for (const order of orders) {
      if (!order.completedAt) continue; // Sécurité: filtré par query mais TypeScript ne le sait pas
      const dateKey = groupBy === 'month'
        ? order.completedAt.toISOString().slice(0, 7)
        : order.completedAt.toISOString().slice(0, 10);

      if (!productionByDate[dateKey]) {
        productionByDate[dateKey] = { date: dateKey, quantity: 0, orders: 0, avgYield: 0, yields: [] };
      }
      productionByDate[dateKey].quantity += order.quantityProduced || 0;
      productionByDate[dateKey].orders += 1;
      if (order.yieldPercentage) {
        productionByDate[dateKey].yields.push(Number(order.yieldPercentage));
      }

      if (!productionByProduct[order.productPfId]) {
        productionByProduct[order.productPfId] = { product: order.productPf, quantity: 0, orders: 0, avgYield: 0 };
      }
      productionByProduct[order.productPfId].quantity += order.quantityProduced || 0;
      productionByProduct[order.productPfId].orders += 1;
    }

    // Calculate averages
    for (const key of Object.keys(productionByDate)) {
      const d = productionByDate[key];
      d.avgYield = d.yields.length > 0 ? d.yields.reduce((a, b) => a + b, 0) / d.yields.length : 0;
    }

    // Top products
    const topProducts = Object.values(productionByProduct)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Totals
    const totalProduced = orders.reduce((sum, o) => sum + (o.quantityProduced || 0), 0);
    const avgYield = orders.length > 0
      ? orders.reduce((sum, o) => sum + (Number(o.yieldPercentage) || 0), 0) / orders.length
      : 0;

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      summary: {
        totalOrders: orders.length,
        totalProduced,
        avgYield: Math.round(avgYield * 10) / 10,
      },
      trend: Object.values(productionByDate).map(d => ({
        date: d.date,
        quantity: d.quantity,
        orders: d.orders,
        avgYield: Math.round(d.avgYield * 10) / 10,
      })),
      topProducts,
    };
  }

  /**
   * Historique de production d'un produit PF
   */
  async getProductHistory(productPfId: number, filters?: {
    year?: number;
    month?: number;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const where: any = { productPfId };

    // Filtres temporels
    if (filters?.year) {
      const startOfYear = new Date(filters.year, 0, 1);
      const endOfYear = new Date(filters.year, 11, 31, 23, 59, 59);
      where.createdAt = { gte: startOfYear, lte: endOfYear };
    }

    if (filters?.month && filters?.year) {
      const startOfMonth = new Date(filters.year, filters.month - 1, 1);
      const endOfMonth = new Date(filters.year, filters.month, 0, 23, 59, 59);
      where.createdAt = { gte: startOfMonth, lte: endOfMonth };
    }

    if (filters?.from || filters?.to) {
      where.createdAt = {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: filters.to }),
      };
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const [total, orders] = await Promise.all([
      this.prisma.productionOrder.count({ where }),
      this.prisma.productionOrder.findMany({
        where,
        include: {
          recipe: {
            select: { name: true, batchWeight: true },
          },
          user: {
            select: { firstName: true, lastName: true },
          },
          lots: {
            select: { id: true, lotNumber: true, quantityInitial: true },
          },
          _count: {
            select: { consumptions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Calculer les totaux
    const totals = await this.prisma.productionOrder.aggregate({
      where: { ...where, status: 'COMPLETED' },
      _sum: { quantityProduced: true },
      _count: true,
      _avg: { yieldPercentage: true },
    });

    return {
      productPfId,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      totals: {
        completedOrders: totals._count,
        totalProduced: totals._sum.quantityProduced || 0,
        avgYield: totals._avg.yieldPercentage || 0,
      },
      orders,
    };
  }

  /**
   * Generate PDF for production order
   */
  async generatePdf(id: number): Promise<Buffer> {
    const order = await this.findById(id);

    // Load logo
    const logoPath = path.join(process.cwd(), 'src/assets/logo_manchengo.svg');
    const distLogoPath = path.join(process.cwd(), 'dist/assets/logo_manchengo.svg');
    let logoSvg = '';
    if (fs.existsSync(distLogoPath)) {
      logoSvg = fs.readFileSync(distLogoPath, 'utf8');
    } else if (fs.existsSync(logoPath)) {
      logoSvg = fs.readFileSync(logoPath, 'utf8');
    }

    const formatDate = (date: Date | string | null) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const statusLabels: Record<string, string> = {
      PENDING: 'En attente',
      IN_PROGRESS: 'En cours',
      COMPLETED: 'Terminée',
      CANCELLED: 'Annulée',
    };

    // Build consumptions table
    const consumptionsTable = order.consumptions.length > 0 ? [
      {
        table: {
          headerRows: 1,
          widths: ['*', 80, 80, 80],
          body: [
            [
              { text: 'Matière Première', style: 'tableHeader' },
              { text: 'Lot', style: 'tableHeader' },
              { text: 'Prévu', style: 'tableHeader', alignment: 'right' },
              { text: 'Consommé', style: 'tableHeader', alignment: 'right' },
            ],
            ...order.consumptions.map((c) => [
              { text: `${c.productMp?.code} - ${c.productMp?.name}`, style: 'tableCell' },
              { text: c.lotMp?.lotNumber || '-', style: 'tableCell' },
              { text: c.quantityPlanned.toString(), style: 'tableCell', alignment: 'right' },
              { text: c.quantityConsumed.toString(), style: 'tableCell', alignment: 'right' },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 10, 0, 20],
      },
    ] : [];

    // Build lots table
    const lotsTable = order.lots.length > 0 ? [
      { text: 'Lots Produits', style: 'sectionTitle', margin: [0, 10, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 80, 100, 100],
          body: [
            [
              { text: 'N° Lot', style: 'tableHeader' },
              { text: 'Quantité', style: 'tableHeader', alignment: 'right' },
              { text: 'Date Fabrication', style: 'tableHeader' },
              { text: 'DLC', style: 'tableHeader' },
            ],
            ...order.lots.map((lot) => [
              { text: lot.lotNumber, style: 'tableCell', bold: true },
              { text: `${lot.quantityInitial} ${order.productPf.unit}`, style: 'tableCell', alignment: 'right' },
              { text: formatDate(lot.manufactureDate), style: 'tableCell' },
              { text: lot.expiryDate ? formatDate(lot.expiryDate) : '-', style: 'tableCell' },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 5, 0, 20],
      },
    ] : [];

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: [
        // Header
        {
          columns: [
            logoSvg ? { svg: logoSvg, width: 80 } : { text: '', width: 80 },
            {
              width: '*',
              stack: [
                { text: 'EURL MANCHENGO', style: 'companyName', alignment: 'right' },
                { text: 'Lot 05, grp propriété 342, local n° 01, Ouled Chbel - Alger', style: 'companyInfo', alignment: 'right' },
                { text: 'RC: 25 B 1204921 16/00 | NIF: 002516120492183', style: 'companyInfo', alignment: 'right' },
                { text: 'Tél: 0661 54 29 14 / 020 089 633', style: 'companyInfo', alignment: 'right' },
              ],
            },
          ],
        },
        { text: '', margin: [0, 20] },

        // Title
        { text: 'FICHE DE PRODUCTION', style: 'title', alignment: 'center' },
        { text: order.reference, style: 'reference', alignment: 'center' },
        { text: '', margin: [0, 15] },

        // Info Grid
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'INFORMATIONS', style: 'sectionTitle' },
                { text: `Produit: ${order.productPf.name}`, style: 'infoText' },
                { text: `Code: ${order.productPf.code}`, style: 'infoText' },
                { text: `Recette: ${order.recipe?.name || '-'}`, style: 'infoText' },
                { text: `Créé par: ${order.user.firstName} ${order.user.lastName}`, style: 'infoText' },
              ],
            },
            {
              width: '50%',
              stack: [
                { text: 'STATUT', style: 'sectionTitle' },
                { text: `Statut: ${statusLabels[order.status] || order.status}`, style: 'infoText', bold: true },
                { text: `Batchs: ${order.batchCount}`, style: 'infoText' },
                { text: `Quantité cible: ${order.targetQuantity} ${order.productPf.unit}`, style: 'infoText' },
                { text: `Quantité produite: ${order.quantityProduced} ${order.productPf.unit}`, style: 'infoText' },
                order.yieldPercentage ? { text: `Rendement: ${order.yieldPercentage.toFixed(1)}%`, style: 'infoText' } : {},
              ],
            },
          ],
        },
        { text: '', margin: [0, 10] },

        // Dates
        {
          columns: [
            { text: `Créé le: ${formatDate(order.createdAt)}`, style: 'dateText' },
            order.startedAt ? { text: `Démarré le: ${formatDate(order.startedAt)}`, style: 'dateText' } : {},
            order.completedAt ? { text: `Terminé le: ${formatDate(order.completedAt)}`, style: 'dateText' } : {},
          ],
        },
        { text: '', margin: [0, 15] },

        // Consumptions
        order.consumptions.length > 0 ? { text: 'Consommations MP', style: 'sectionTitle' } : {},
        ...consumptionsTable,

        // Lots produced
        ...lotsTable,

        // Quality notes
        order.qualityNotes ? [
          { text: 'Notes Qualité', style: 'sectionTitle', margin: [0, 10, 0, 5] },
          { text: `Statut: ${order.qualityStatus || '-'}`, style: 'infoText' },
          { text: order.qualityNotes, style: 'infoText', margin: [0, 5, 0, 0] },
        ] : [],
      ],
      styles: {
        companyName: { fontSize: 14, bold: true, color: '#4A1D91' },
        companyInfo: { fontSize: 8, color: '#666666' },
        title: { fontSize: 18, bold: true, color: '#1a1a1a', margin: [0, 0, 0, 5] },
        reference: { fontSize: 14, color: '#4A1D91', bold: true },
        sectionTitle: { fontSize: 11, bold: true, color: '#4A1D91', margin: [0, 10, 0, 5] },
        infoText: { fontSize: 10, margin: [0, 2, 0, 2] },
        dateText: { fontSize: 9, color: '#666666' },
        tableHeader: { fontSize: 9, bold: true, fillColor: '#f3f4f6', color: '#374151' },
        tableCell: { fontSize: 9 },
      },
      defaultStyle: {
        font: 'Roboto',
      },
    };

    // Use built-in fonts
    const printer = new PdfPrinter({
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    });

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PLANIFICATION HEBDOMADAIRE
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Obtenir le planning de production pour une semaine
   */
  async getWeeklyPlan(startDate: Date) {
    // Normaliser à minuit
    const weekStart = new Date(startDate);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Récupérer les ordres planifiés pour cette semaine + les non planifiés en PENDING
    const orders = await this.prisma.productionOrder.findMany({
      where: {
        OR: [
          // Ordres planifiés dans cette semaine
          { scheduledDate: { gte: weekStart, lt: weekEnd } },
          // Ordres PENDING non planifiés (pour section "non planifiés")
          { scheduledDate: null, status: 'PENDING' },
        ],
      },
      include: {
        productPf: { select: { id: true, code: true, name: true, unit: true } },
        recipe: { select: { id: true, name: true, outputQuantity: true, batchWeight: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
    });

    // Construire les 7 jours de la semaine
    const days: Array<{
      date: string;
      dayName: string;
      dayNumber: number;
      isToday: boolean;
      orders: typeof orders;
    }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      days.push({
        date: dateStr,
        dayName: date.toLocaleDateString('fr-FR', { weekday: 'long' }),
        dayNumber: date.getDate(),
        isToday: date.getTime() === today.getTime(),
        orders: orders.filter(o =>
          o.scheduledDate && o.scheduledDate.toISOString().split('T')[0] === dateStr
        ),
      });
    }

    // Ordres non planifiés
    const unscheduled = orders.filter(o => !o.scheduledDate);

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      days,
      unscheduled,
      stats: {
        totalPlanned: orders.length - unscheduled.length,
        totalUnscheduled: unscheduled.length,
        pending: orders.filter(o => o.status === 'PENDING').length,
        inProgress: orders.filter(o => o.status === 'IN_PROGRESS').length,
        completed: orders.filter(o => o.status === 'COMPLETED').length,
      },
    };
  }

  /**
   * Mettre à jour la date planifiée d'un ordre de production
   */
  async updateScheduledDate(id: number, scheduledDate: string | null, _userId: string) {
    const order = await this.findById(id);

    // Seuls les ordres PENDING peuvent être replanifiés
    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        `Seuls les ordres en attente peuvent être replanifiés (statut actuel: ${order.status})`
      );
    }

    const updated = await this.prisma.productionOrder.update({
      where: { id },
      data: {
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      },
      include: {
        productPf: { select: { id: true, code: true, name: true, unit: true } },
        recipe: { select: { id: true, name: true, outputQuantity: true } },
      },
    });

    this.logger.log(
      `Ordre ${order.reference} replanifié: ${scheduledDate || 'non planifié'}`,
      'ProductionService',
    );

    return updated;
  }

  /**
   * Vérifier la disponibilité du stock pour le planning
   */
  async checkPlanningStockAvailability(items: Array<{ recipeId: number; batchCount: number }>) {
    const results = await Promise.all(
      items.map(async (item) => {
        try {
          const check = await this.recipeService.checkStockAvailability(item.recipeId, item.batchCount);
          return {
            recipeId: item.recipeId,
            batchCount: item.batchCount,
            canProduce: check.canProduce,
            status: check.canProduce ? 'available' : 'shortage',
            shortages: check.availability
              .filter((a: any) => !a.isAvailable && a.isMandatory)
              .map((a: any) => ({
                productMpId: a.productMp.id,
                code: a.productMp.code,
                name: a.productMp.name,
                required: a.required,
                available: a.available,
                shortage: a.shortage,
              })),
          };
        } catch (error) {
          return {
            recipeId: item.recipeId,
            batchCount: item.batchCount,
            canProduce: false,
            status: 'error',
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          };
        }
      })
    );

    return results;
  }
}
