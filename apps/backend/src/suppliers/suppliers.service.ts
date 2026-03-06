import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  NotImplementedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto, SupplierResponseDto } from './dto/supplier.dto';
import { PurchaseOrderStatus } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — Chaîne d'impact fournisseur
// ═══════════════════════════════════════════════════════════════════════════════

export type SupplierRiskLevel = 'CRITICAL' | 'WARNING' | 'STABLE';

export interface SupplierImpact {
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  reliabilityScore: number;
  riskLevel: SupplierRiskLevel;
  bcBlockingCount: number;
  delayedBcCount: number;
  blockedMpCount: number;
  impactedRecipesCount: number;
  lastIncidentAt: Date | null;
  isMonoSource: boolean;
  monoSourceMpCount: number;
}

export interface BlockingPurchaseOrder {
  id: string;
  reference: string;
  status: PurchaseOrderStatus;
  expectedDeliveryDate: Date | null;
  daysUntilDelivery: number | null;
  isDelayed: boolean;
  blockingMpCount: number;
}

export interface BlockedMaterial {
  id: number;
  code: string;
  name: string;
  currentStock: number;
  minStock: number;
  status: 'RUPTURE' | 'CRITICAL' | 'LOW';
  daysRemaining: number | null;
}

export interface ImpactedRecipe {
  id: number;
  name: string;
  status: 'BLOCKED' | 'AT_RISK';
}

export interface SupplierImpactChain {
  supplier: {
    id: number;
    code: string;
    name: string;
    reliabilityScore: number;
    riskLevel: SupplierRiskLevel;
    incidentsLast30Days: number;
  };
  purchaseOrders: BlockingPurchaseOrder[];
  blockedMaterials: BlockedMaterial[];
  impactedRecipes: ImpactedRecipe[];
}

export interface SupplierScoreBreakdown {
  score: number;
  delayPenalty: number;
  incidentPenalty: number;
  blockedMpPenalty: number;
  formula: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIERS SERVICE - Gestion des fournisseurs avec conformité fiscale algérienne
// ═══════════════════════════════════════════════════════════════════════════════
// RÈGLES MÉTIER:
// - RC, NIF, AI optionnels à la création, validés si renseignés (format algérien)
// - Unicité fiscale vérifiée uniquement si champs non vides
// - Suppression INTERDITE si réception existante
// - Désactivation via isActive uniquement
// - Code auto-généré (FOUR-XXX)
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class SuppliersService {
  // @ts-expect-error TS6133 — kept for future use
  private readonly _logger = new Logger(SuppliersService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Génère le prochain code fournisseur (FOUR-001, FOUR-002, etc.)
   */
  // @ts-expect-error TS6133 — kept for future use
  private async _generateCode(): Promise<string> {
    const lastSupplier = await this.prisma.supplier.findFirst({
      orderBy: { id: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1;
    if (lastSupplier?.code) {
      const match = lastSupplier.code.match(/FOUR-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `FOUR-${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Vérifie l'unicité des identifiants fiscaux
   * Skip la vérification si les champs sont vides (non renseignés)
   */
  private async checkFiscalUniqueness(
    rc: string,
    nif: string,
    ai?: string,
    excludeId?: number,
  ): Promise<void> {
    // Ne vérifier l'unicité que si le champ est réellement renseigné
    if (rc && rc.trim() !== '' && rc !== 'MIGRATED') {
      const existingRc = await this.prisma.supplier.findFirst({
        where: {
          rc,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });

      if (existingRc) {
        throw new ConflictException(
          `Un fournisseur avec ce RC existe déjà: ${existingRc.name} (${existingRc.code})`,
        );
      }
    }

    if (nif && nif.trim() !== '' && nif !== '000000000000000') {
      const existingNif = await this.prisma.supplier.findFirst({
        where: {
          nif,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });

      if (existingNif) {
        throw new ConflictException(
          `Un fournisseur avec ce NIF existe déjà: ${existingNif.name} (${existingNif.code})`,
        );
      }
    }

    if (ai && ai.trim() !== '') {
      const existingAi = await this.prisma.supplier.findFirst({
        where: {
          ai,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });

      if (existingAi) {
        throw new ConflictException(
          `Un fournisseur avec cet AI existe déjà: ${existingAi.name} (${existingAi.code})`,
        );
      }
    }
  }

  /**
   * Liste tous les fournisseurs (actifs par défaut)
   */
  async findAll(includeInactive = false): Promise<SupplierResponseDto[]> {
    const suppliers = await this.prisma.supplier.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { receptions: true },
        },
      },
    });

    return suppliers.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      rc: s.rc,
      nif: s.nif,
      ai: s.ai,
      nis: s.nis ?? undefined,
      phone: s.phone,
      address: s.address,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      receptionCount: s._count.receptions,
    }));
  }

  /**
   * Récupère un fournisseur par ID
   */
  async findById(id: number): Promise<SupplierResponseDto> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { receptions: true },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Fournisseur #${id} introuvable`);
    }

    return {
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      rc: supplier.rc,
      nif: supplier.nif,
      ai: supplier.ai,
      nis: supplier.nis ?? undefined,
      phone: supplier.phone,
      address: supplier.address,
      isActive: supplier.isActive,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      receptionCount: supplier._count.receptions,
    };
  }

  /**
   * Crée un nouveau fournisseur
   */
  async create(dto: CreateSupplierDto): Promise<SupplierResponseDto> {
    // Vérifier l'unicité des identifiants fiscaux (skip si vides)
    await this.checkFiscalUniqueness(dto.rc || '', dto.nif || '', dto.ai || '');

    // Retry loop for code generation with unique constraint handling
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const supplier = await this.prisma.$transaction(async (tx) => {
          // Generate code inside transaction
          const lastSupplier = await tx.supplier.findFirst({
            where: { code: { startsWith: 'FOUR-' } },
            orderBy: { code: 'desc' },
            select: { code: true },
          });

          let nextNumber = 1;
          if (lastSupplier?.code) {
            const match = lastSupplier.code.match(/FOUR-(\d+)/);
            if (match) nextNumber = parseInt(match[1], 10) + 1;
          }
          const code = `FOUR-${nextNumber.toString().padStart(3, '0')}`;

          return tx.supplier.create({
            data: {
              code,
              name: dto.name.trim(),
              rc: dto.rc?.trim().toUpperCase() || undefined,
              nif: dto.nif?.trim() || undefined,
              ai: dto.ai?.trim().toUpperCase() || undefined,
              nis: dto.nis?.trim() || null,
              phone: dto.phone.trim(),
              address: dto.address.trim(),
            },
          });
        }, {
          isolationLevel: 'Serializable',
          timeout: 10000,
        });

        return {
          id: supplier.id,
          code: supplier.code,
          name: supplier.name,
          rc: supplier.rc,
          nif: supplier.nif,
          ai: supplier.ai,
          nis: supplier.nis ?? undefined,
          phone: supplier.phone,
          address: supplier.address,
          isActive: supplier.isActive,
          createdAt: supplier.createdAt,
          updatedAt: supplier.updatedAt,
          receptionCount: 0,
        };
      } catch (error: any) {
        const isRetryable = error?.code === 'P2002' || error?.code === 'P2034' ||
          error?.message?.includes('could not serialize');
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          continue;
        }
        if (error?.code === 'P2002') {
          throw new ConflictException('Un fournisseur avec ce code existe déjà');
        }
        throw error;
      }
    }

    throw new ConflictException('Impossible de générer un code fournisseur unique après plusieurs tentatives');
  }

  /**
   * Met à jour un fournisseur
   */
  async update(id: number, dto: UpdateSupplierDto): Promise<SupplierResponseDto> {
    // Vérifier que le fournisseur existe
    const existing = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Fournisseur #${id} introuvable`);
    }

    // Si RC, NIF ou AI modifié, vérifier l'unicité
    if (dto.rc !== undefined || dto.nif !== undefined || dto.ai !== undefined) {
      await this.checkFiscalUniqueness(
        dto.rc !== undefined ? dto.rc : (existing.rc || ''),
        dto.nif !== undefined ? dto.nif : (existing.nif || ''),
        dto.ai !== undefined ? dto.ai : (existing.ai || ''),
        id,
      );
    }

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.rc !== undefined && { rc: dto.rc?.trim().toUpperCase() || '' }),
        ...(dto.nif !== undefined && { nif: dto.nif?.trim() || '' }),
        ...(dto.ai !== undefined && { ai: dto.ai?.trim().toUpperCase() || '' }),
        ...(dto.nis !== undefined && { nis: dto.nis?.trim() || null }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || '' }),
        ...(dto.address !== undefined && { address: dto.address?.trim() || '' }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        _count: {
          select: { receptions: true },
        },
      },
    });

    return {
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      rc: supplier.rc,
      nif: supplier.nif,
      ai: supplier.ai,
      nis: supplier.nis ?? undefined,
      phone: supplier.phone,
      address: supplier.address,
      isActive: supplier.isActive,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      receptionCount: supplier._count.receptions,
    };
  }

  /**
   * Désactive un fournisseur (soft delete)
   * La suppression réelle est INTERDITE si des réceptions existent
   */
  async deactivate(id: number): Promise<SupplierResponseDto> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { receptions: true },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Fournisseur #${id} introuvable`);
    }

    // Vérifier les BC actifs avant désactivation
    const activeBCs = await this.prisma.purchaseOrder.count({
      where: {
        supplierId: id,
        status: { in: ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL'] },
      },
    });
    if (activeBCs > 0) {
      throw new ConflictException(
        `Impossible de supprimer: ${activeBCs} bon(s) de commande actif(s) en cours`
      );
    }

    // Désactiver le fournisseur
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
      include: {
        _count: {
          select: { receptions: true },
        },
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      rc: updated.rc,
      nif: updated.nif,
      ai: updated.ai,
      nis: updated.nis ?? undefined,
      phone: updated.phone,
      address: updated.address,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      receptionCount: updated._count.receptions,
    };
  }

  /**
   * Vérifie si un fournisseur peut être supprimé
   * Retourne false si des réceptions existent
   */
  async canDelete(id: number): Promise<{ canDelete: boolean; reason?: string }> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { receptions: true, lots: true },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Fournisseur #${id} introuvable`);
    }

    // Vérifier les BC actifs
    const activeBCs = await this.prisma.purchaseOrder.count({
      where: {
        supplierId: id,
        status: { in: ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL'] },
      },
    });
    if (activeBCs > 0) {
      return {
        canDelete: false,
        reason: `Impossible de supprimer: ${activeBCs} bon(s) de commande actif(s) en cours`,
      };
    }

    if (supplier._count.receptions > 0) {
      return {
        canDelete: false,
        reason: `Ce fournisseur a ${supplier._count.receptions} réception(s) enregistrée(s). Désactivez-le à la place.`,
      };
    }

    if (supplier._count.lots > 0) {
      return {
        canDelete: false,
        reason: `Ce fournisseur est lié à ${supplier._count.lots} lot(s). Désactivez-le à la place.`,
      };
    }

    return { canDelete: true };
  }

  /**
   * Récupère l'historique des réceptions d'un fournisseur avec filtres temporels
   * Calculs côté serveur pour performance
   */
  async getHistory(
    supplierId: number,
    filters: {
      year?: number;
      month?: number;
      from?: Date;
      to?: Date;
      page: number;
      limit: number;
    },
  ) {
    // Vérifier que le fournisseur existe
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, code: true, name: true },
    });

    if (!supplier) {
      throw new NotFoundException(`Fournisseur #${supplierId} introuvable`);
    }

    // Construire les conditions de date
    const dateConditions: any = {};
    
    if (filters.year) {
      const startOfYear = new Date(filters.year, 0, 1);
      const endOfYear = new Date(filters.year, 11, 31, 23, 59, 59);
      dateConditions.date = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    if (filters.month && filters.year) {
      const startOfMonth = new Date(filters.year, filters.month - 1, 1);
      const endOfMonth = new Date(filters.year, filters.month, 0, 23, 59, 59);
      dateConditions.date = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    }

    if (filters.from || filters.to) {
      dateConditions.date = {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: new Date(filters.to.getTime() + 24 * 60 * 60 * 1000 - 1) }),
      };
    }

    const where = {
      supplierId,
      ...dateConditions,
    };

    // Compter le total
    const total = await this.prisma.receptionMp.count({ where });

    // Récupérer les réceptions paginées
    const receptions = await this.prisma.receptionMp.findMany({
      where,
      include: {
        lines: {
          include: {
            productMp: {
              select: { code: true, name: true, unit: true },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });

    // Calculer les totaux côté serveur
    const aggregations = await this.prisma.receptionMpLine.aggregate({
      where: {
        reception: where,
      },
      _sum: {
        quantity: true,
        unitCost: true,
      },
      _count: true,
    });

    // Calculer le montant total (quantité * coût unitaire)
    const allLines = await this.prisma.receptionMpLine.findMany({
      where: { reception: where },
      select: { quantity: true, unitCost: true },
    });

    const totalAmount = allLines.reduce(
      (sum, line) => sum + (line.quantity * (line.unitCost || 0)),
      0,
    );

    return {
      supplier,
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
        receptions: total,
        lines: aggregations._count,
        totalQuantity: aggregations._sum.quantity || 0,
        totalAmount, // En centimes
      },
      receptions: receptions.map((r) => ({
        id: r.id,
        reference: r.reference,
        date: r.date,
        blNumber: r.blNumber,
        status: r.status,
        lines: r.lines.map((l) => ({
          id: l.id,
          product: l.productMp,
          quantity: l.quantity,
          unitCost: l.unitCost,
          lineTotal: l.quantity * (l.unitCost || 0),
        })),
        total: r.lines.reduce((sum, l) => sum + l.quantity * (l.unitCost || 0), 0),
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CHAÎNE D'IMPACT FOURNISSEURS — DONNÉES RÉELLES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/suppliers/impacts
   * Retourne tous les fournisseurs avec leur impact réel sur la chaîne
   * Données 100% traçables, zéro mock
   */
  async getSupplierImpacts(): Promise<SupplierImpact[]> {
    const suppliers = await this.prisma.supplier.findMany({
      where: { isActive: true },
      include: {
        productsMpPrincipaux: {
          include: {
            recipeItems: {
              include: {
                recipe: { select: { id: true, name: true, isActive: true } },
              },
            },
          },
        },
        purchaseOrders: {
          where: {
            status: { in: ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL'] },
          },
          include: {
            items: true,
          },
        },
        receptions: {
          where: {
            date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { date: 'desc' },
        },
      },
    });

    const impacts: SupplierImpact[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Batch load all stock movements for all product IDs across all suppliers
    const allProductIds = suppliers.flatMap(s => s.productsMpPrincipaux.map(mp => mp.id));
    const allMovements = allProductIds.length > 0
      ? await this.prisma.stockMovement.groupBy({
          by: ['productMpId', 'movementType'],
          where: { productMpId: { in: allProductIds }, isDeleted: false },
          _sum: { quantity: true },
        })
      : [];

    // Build stock map: productMpId -> currentStock
    const stockMap = new Map<number, number>();
    for (const m of allMovements) {
      if (!m.productMpId) continue;
      const prev = stockMap.get(m.productMpId) || 0;
      const qty = m._sum.quantity ?? 0;
      stockMap.set(m.productMpId, prev + (m.movementType === 'IN' ? qty : -qty));
    }

    // Batch-load mono-source counts for ALL suppliers (eliminates N+1 query)
    const allSupplierIds = suppliers.map(s => s.id);
    const monoSourceCounts = await this.prisma.productMp.groupBy({
      by: ['fournisseurPrincipalId'],
      where: {
        fournisseurPrincipalId: { in: allSupplierIds },
        isActive: true,
      },
      _count: true,
    });
    const monoSourceMap = new Map<number, number>();
    for (const entry of monoSourceCounts) {
      if (entry.fournisseurPrincipalId != null) {
        monoSourceMap.set(entry.fournisseurPrincipalId, entry._count);
      }
    }

    for (const supplier of suppliers) {
      // Calculer BC bloquants (non reçus avec MP en rupture)
      const bcBlocking = supplier.purchaseOrders.filter(bc => {
        if (bc.status === 'RECEIVED' || bc.status === 'CANCELLED') return false;
        return bc.items.some(item => item.productMpId !== null);
      });

      // Calculer BC en retard
      const delayedBcs = bcBlocking.filter(bc => {
        if (!bc.expectedDelivery) return false;
        const expected = new Date(bc.expectedDelivery);
        expected.setHours(0, 0, 0, 0);
        return expected < today;
      });

      // MP fournies par ce fournisseur en rupture/critique
      const blockedMpIds = new Set<number>();
      const impactedRecipeIds = new Set<number>();

      for (const mp of supplier.productsMpPrincipaux) {
        const currentStock = stockMap.get(mp.id) || 0;

        if (currentStock <= 0 || currentStock < mp.minStock) {
          blockedMpIds.add(mp.id);
          // Recettes impactées
          for (const ri of mp.recipeItems) {
            if (ri.recipe?.isActive) {
              impactedRecipeIds.add(ri.recipe.id);
            }
          }
        }
      }

      // Dernier incident (réception avec problème ou retard)
      const lastIncident = delayedBcs.length > 0
        ? delayedBcs[0].expectedDelivery
        : null;

      // Détection mono-sourcing (batch-loaded above, no per-supplier query)
      const monoSourceMps = monoSourceMap.get(supplier.id) ?? 0;

      // Calcul score réel
      const scoreData = this.calculateSupplierScore(
        Number(supplier.tauxRetard ?? 0),
        delayedBcs.length,
        blockedMpIds.size,
      );

      // Déterminer niveau de risque
      const riskLevel = this.determineRiskLevel(
        scoreData.score,
        blockedMpIds.size,
        impactedRecipeIds.size,
      );

      impacts.push({
        supplierId: supplier.id,
        supplierCode: supplier.code,
        supplierName: supplier.name,
        reliabilityScore: scoreData.score,
        riskLevel,
        bcBlockingCount: bcBlocking.length,
        delayedBcCount: delayedBcs.length,
        blockedMpCount: blockedMpIds.size,
        impactedRecipesCount: impactedRecipeIds.size,
        lastIncidentAt: lastIncident,
        isMonoSource: monoSourceMps > 0,
        monoSourceMpCount: monoSourceMps,
      });
    }

    // Trier: CRITICAL d'abord, puis WARNING, puis STABLE
    return impacts.sort((a, b) => {
      const order = { CRITICAL: 0, WARNING: 1, STABLE: 2 };
      return order[a.riskLevel] - order[b.riskLevel];
    });
  }

  /**
   * GET /api/suppliers/:id/impact-chain
   * Retourne la chaîne d'impact complète d'un fournisseur
   */
  async getSupplierImpactChain(supplierId: number): Promise<SupplierImpactChain> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        productsMpPrincipaux: {
          include: {
            recipeItems: {
              include: {
                recipe: {
                  include: {
                    productPf: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        purchaseOrders: {
          where: {
            status: { in: ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL'] },
          },
          include: {
            items: {
              include: {
                productMp: { select: { id: true, code: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Fournisseur #${supplierId} introuvable`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Bons de commande bloquants
    const purchaseOrders: BlockingPurchaseOrder[] = [];
    for (const bc of supplier.purchaseOrders) {
      const expectedDate = bc.expectedDelivery ? new Date(bc.expectedDelivery) : null;
      let daysUntilDelivery: number | null = null;
      let isDelayed = false;

      if (expectedDate) {
        expectedDate.setHours(0, 0, 0, 0);
        daysUntilDelivery = Math.ceil((expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        isDelayed = daysUntilDelivery < 0;
      }

      purchaseOrders.push({
        id: bc.id,
        reference: bc.reference,
        status: bc.status,
        expectedDeliveryDate: bc.expectedDelivery,
        daysUntilDelivery,
        isDelayed,
        blockingMpCount: bc.items.filter(i => i.productMpId !== null).length,
      });
    }

    // Batch load all stock movements for this supplier's products
    const supplierProductIds = supplier.productsMpPrincipaux.map(mp => mp.id);
    const batchedMovements = supplierProductIds.length > 0
      ? await this.prisma.stockMovement.groupBy({
          by: ['productMpId', 'movementType'],
          where: { productMpId: { in: supplierProductIds }, isDeleted: false },
          _sum: { quantity: true },
        })
      : [];

    const supplierStockMap = new Map<number, number>();
    for (const m of batchedMovements) {
      if (!m.productMpId) continue;
      const prev = supplierStockMap.get(m.productMpId) || 0;
      const qty = m._sum.quantity ?? 0;
      supplierStockMap.set(m.productMpId, prev + (m.movementType === 'IN' ? qty : -qty));
    }

    // MP bloquées
    const blockedMaterials: BlockedMaterial[] = [];
    for (const mp of supplier.productsMpPrincipaux) {
      const currentStock = supplierStockMap.get(mp.id) || 0;

      // Jours restants basé sur consommation
      const daysRemaining = mp.consommationMoyJour && Number(mp.consommationMoyJour) > 0
        ? Math.floor(currentStock / Number(mp.consommationMoyJour))
        : null;

      // Déterminer statut
      let status: 'RUPTURE' | 'CRITICAL' | 'LOW';
      if (currentStock <= 0) {
        status = 'RUPTURE';
      } else if (currentStock < mp.minStock) {
        status = 'CRITICAL';
      } else if (daysRemaining !== null && daysRemaining < 7) {
        status = 'LOW';
      } else {
        continue; // MP saine, ne pas inclure
      }

      blockedMaterials.push({
        id: mp.id,
        code: mp.code,
        name: mp.name,
        currentStock,
        minStock: mp.minStock,
        status,
        daysRemaining,
      });
    }

    // Recettes impactées
    const impactedRecipes: ImpactedRecipe[] = [];
    const seenRecipeIds = new Set<number>();
    
    for (const mp of supplier.productsMpPrincipaux) {
      const blockedMp = blockedMaterials.find(m => m.id === mp.id);
      if (!blockedMp) continue;

      for (const ri of mp.recipeItems) {
        if (!ri.recipe?.isActive) continue;
        if (seenRecipeIds.has(ri.recipe.id)) continue;
        seenRecipeIds.add(ri.recipe.id);

        impactedRecipes.push({
          id: ri.recipe.id,
          name: ri.recipe.productPf?.name ?? ri.recipe.name,
          status: blockedMp.status === 'RUPTURE' ? 'BLOCKED' : 'AT_RISK',
        });
      }
    }

    // Compter incidents 30 derniers jours
    const incidentsLast30Days = purchaseOrders.filter(bc => bc.isDelayed).length;

    // Calcul score
    const scoreData = this.calculateSupplierScore(
      Number(supplier.tauxRetard ?? 0),
      incidentsLast30Days,
      blockedMaterials.length,
    );

    const riskLevel = this.determineRiskLevel(
      scoreData.score,
      blockedMaterials.length,
      impactedRecipes.length,
    );

    return {
      supplier: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        reliabilityScore: scoreData.score,
        riskLevel,
        incidentsLast30Days,
      },
      purchaseOrders,
      blockedMaterials,
      impactedRecipes,
    };
  }

  /**
   * Calcul RÉEL du score fournisseur
   * Formule documentée: score = 100 - (delayRate * 40) - (incidentCount * 15) - (blockedMpCount * 10)
   */
  calculateSupplierScore(
    delayRate: number,
    incidentCount30d: number,
    blockedMpCount: number,
  ): SupplierScoreBreakdown {
    const delayPenalty = Math.round(delayRate * 40);
    const incidentPenalty = Math.min(incidentCount30d * 15, 30); // Cap à 30
    const blockedMpPenalty = Math.min(blockedMpCount * 10, 20); // Cap à 20

    const score = Math.max(0, Math.min(100, 100 - delayPenalty - incidentPenalty - blockedMpPenalty));

    return {
      score,
      delayPenalty,
      incidentPenalty,
      blockedMpPenalty,
      formula: `100 - (${delayRate.toFixed(2)} × 40) - (${incidentCount30d} × 15) - (${blockedMpCount} × 10)`,
    };
  }

  /**
   * Détermine le niveau de risque basé sur des critères réels
   */
  private determineRiskLevel(
    score: number,
    blockedMpCount: number,
    impactedRecipesCount: number,
  ): SupplierRiskLevel {
    // CRITICAL: bloque la production
    if (blockedMpCount > 0 && impactedRecipesCount > 0) return 'CRITICAL';
    if (score < 50) return 'CRITICAL';
    
    // WARNING: risques potentiels
    if (blockedMpCount > 0 || score < 70) return 'WARNING';
    
    return 'STABLE';
  }

  /**
   * Compte les MP dont ce fournisseur est la source unique
   */
  // @ts-expect-error TS6133 — kept for future use
  private async _getMonoSourceMpCount(supplierId: number): Promise<number> {
    // Trouver les MP où ce fournisseur est principal
    const mpsWithThisSupplier = await this.prisma.productMp.findMany({
      where: { fournisseurPrincipalId: supplierId, isActive: true },
      select: { id: true },
    });

    if (mpsWithThisSupplier.length === 0) return 0;

    // Pour chaque MP, vérifier s'il existe d'autres fournisseurs
    // Note: Dans le modèle actuel, on utilise fournisseurPrincipalId
    // Une MP est mono-source si seul ce fournisseur la fournit
    // Simplifié: toutes les MP avec ce fournisseur principal sont mono-source
    // TODO: Améliorer avec une relation many-to-many Supplier ↔ ProductMp
    return mpsWithThisSupplier.length;
  }

  /**
   * PUT /api/suppliers/:id/block
   * Bloque temporairement un fournisseur avec motif obligatoire
   * NOTE: Schema updated - run `npx prisma migrate dev` to activate
   */
  async blockSupplier(
    id: number,
    dto: { reason: string; blockedUntil?: Date },
    _userId: number,
  ): Promise<SupplierResponseDto> {
    const supplier = await this.prisma.supplier.findUnique({ 
      where: { id },
      include: { _count: { select: { receptions: true } } },
    });
    if (!supplier) {
      throw new NotFoundException(`Fournisseur #${id} introuvable`);
    }

    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException('Motif obligatoire (min 10 caractères)');
    }

    throw new NotImplementedException('Feature pending migration');
  }

  /**
   * PUT /api/suppliers/:id/surveillance
   * Met un fournisseur sous surveillance
   * TODO: Ajouter champs surveillance au schema Prisma
   */
  async setSupplierSurveillance(
    id: number,
    dto: { reason: string; surveillanceUntil?: Date },
    _userId: string,
  ): Promise<SupplierResponseDto> {
    const supplier = await this.prisma.supplier.findUnique({ 
      where: { id },
      include: { _count: { select: { receptions: true } } },
    });
    if (!supplier) {
      throw new NotFoundException(`Fournisseur #${id} introuvable`);
    }

    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException('Motif obligatoire (min 10 caractères)');
    }

    throw new NotImplementedException('Feature pending migration');
  }
}
