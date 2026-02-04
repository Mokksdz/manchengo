/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRODUCTION SUPPLY RISKS SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * P0.1: Service dédié à l'agrégation des risques supply chain pour le Dashboard Production
 * 
 * PRINCIPE: ZÉRO nouvelle logique
 * - Réutilise ApproService.getCriticalMp()
 * - Réutilise PurchaseOrderService.getLatePurchaseOrders()
 * - Agrège et formate pour l'UI Production
 * 
 * @author Manchengo ERP Team
 * @version 1.0.0 - Audit P0 Correction
 */

import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApproService, StockState, StockMpWithState } from '../appro/appro.service';
import { PurchaseOrderService } from '../appro/purchase-orders/purchase-order.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES — P0.1 Supply Risks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * État de risque MP pour la Production
 */
export type MpRiskState = 'BLOQUANT_PRODUCTION' | 'RISQUE_48H' | 'RISQUE_72H' | 'SURVEILLANCE' | 'OK';

/**
 * Niveau d'impact BC
 */
export type BcImpactLevel = 'BLOQUANT' | 'MAJEUR' | 'MINEUR';

/**
 * MP critique avec contexte Production
 */
export interface MpCritiqueProduction {
  productId: number;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  state: MpRiskState;
  joursCouverture: number | null;
  isMonoSourced: boolean;
  supplierName: string | null;
  supplierId: number | null;
  usedInRecipes: number;
  justification: string;
}

/**
 * BC critique avec impact Production
 */
export interface BcCritiqueProduction {
  bcId: string;
  reference: string;
  supplierName: string;
  supplierId: number;
  daysLate: number;
  expectedDelivery: string;
  impactLevel: BcImpactLevel;
  hasCriticalMp: boolean;
  mpImpacted: { id: number; code: string; name: string }[];
  status: string;
}

/**
 * Fournisseur bloquant
 */
export interface FournisseurBloquant {
  supplierId: number;
  name: string;
  code: string;
  blockingMpCount: number;
  isMonoSourceForCriticalMp: boolean;
  mpBloquantes: { id: number; code: string; name: string }[];
  bcEnRetard: number;
}

/**
 * Réponse complète du endpoint supply-risks
 */
export interface SupplyRisksResponse {
  // Résumé global pour bannière
  summary: {
    hasBlockingRisk: boolean;
    totalMpBloquantes: number;
    totalBcCritiques: number;
    totalFournisseursBloquants: number;
    urgencyLevel: 'CRITIQUE' | 'ATTENTION' | 'OK';
  };
  
  // P0.1: MP critiques
  mpCritiques: MpCritiqueProduction[];
  
  // P0.2: BC en retard
  bcCritiques: BcCritiqueProduction[];
  
  // Fournisseurs à risque
  fournisseursBloquants: FournisseurBloquant[];
  
  // Timestamp
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// A1: Productions at Risk Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Raison de risque pour une production
 */
export interface ProductionRiskReason {
  type: 'MP' | 'BC';
  label: string;
  code?: string;
  daysCover?: number;
  daysLate?: number;
  supplierName?: string;
}

/**
 * Production à risque
 */
export interface ProductionAtRisk {
  orderId: number;
  reference: string;
  productName: string;
  productCode: string;
  plannedDate: string;
  riskLevel: 'CRITICAL' | 'WARNING';
  reasons: ProductionRiskReason[];
  canStart: boolean;
  batchCount: number;
  targetQuantity: number;
}

/**
 * Réponse du endpoint at-risk
 */
export interface ProductionsAtRiskResponse {
  productions: ProductionAtRisk[];
  summary: {
    totalAtRisk: number;
    critical: number;
    warning: number;
  };
  generatedAt: string;
}

@Injectable()
export class ProductionSupplyRisksService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ApproService))
    private approService: ApproService,
    @Inject(forwardRef(() => PurchaseOrderService))
    private poService: PurchaseOrderService,
  ) {}

  /**
   * GET /production/dashboard/supply-risks
   * 
   * Endpoint unique agrégé pour le Dashboard Production
   * ZÉRO nouvelle logique - Réutilisation pure
   */
  async getSupplyRisks(): Promise<SupplyRisksResponse> {
    // 1. Récupérer les MP critiques via ApproService (déjà existe)
    const criticalMp = await this.approService.getCriticalMp();
    
    // 2. Récupérer les BC en retard via PurchaseOrderService (déjà existe)
    const latePOs = await this.poService.getLatePurchaseOrders(3);
    
    // 3. Transformer pour l'UI Production
    const mpCritiques = this.transformMpCritiques(criticalMp);
    const bcCritiques = this.transformBcCritiques(latePOs);
    const fournisseursBloquants = await this.aggregateFournisseursBloquants(criticalMp, latePOs);
    
    // 4. Calculer le résumé
    const mpBloquantes = mpCritiques.filter(mp => mp.state === 'BLOQUANT_PRODUCTION');
    const bcBloquants = bcCritiques.filter(bc => bc.impactLevel === 'BLOQUANT');
    
    const hasBlockingRisk = mpBloquantes.length > 0 || bcBloquants.length > 0;
    
    let urgencyLevel: 'CRITIQUE' | 'ATTENTION' | 'OK' = 'OK';
    if (hasBlockingRisk) {
      urgencyLevel = 'CRITIQUE';
    } else if (mpCritiques.length > 0 || bcCritiques.length > 0) {
      urgencyLevel = 'ATTENTION';
    }

    return {
      summary: {
        hasBlockingRisk,
        totalMpBloquantes: mpBloquantes.length,
        totalBcCritiques: bcBloquants.length,
        totalFournisseursBloquants: fournisseursBloquants.filter(f => f.isMonoSourceForCriticalMp).length,
        urgencyLevel,
      },
      mpCritiques,
      bcCritiques,
      fournisseursBloquants,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Transforme les MP critiques pour l'UI Production
   * Ajoute: état de risque simplifié, mono-sourcing, justification
   */
  private transformMpCritiques(criticalMp: StockMpWithState[]): MpCritiqueProduction[] {
    return criticalMp.map(mp => {
      // Déterminer l'état de risque Production
      let state: MpRiskState = 'OK';
      let justification = '';
      
      if (mp.state === StockState.BLOQUANT_PRODUCTION) {
        state = 'BLOQUANT_PRODUCTION';
        justification = '⛔ Bloque la production - Stock insuffisant pour recettes actives';
      } else if (mp.state === StockState.RUPTURE) {
        state = 'BLOQUANT_PRODUCTION';
        justification = '🔴 Rupture totale de stock';
      } else if (mp.joursCouverture !== null && mp.joursCouverture < 2) {
        state = 'RISQUE_48H';
        justification = `⚠️ Stock critique: ${mp.joursCouverture.toFixed(1)} jours de couverture`;
      } else if (mp.joursCouverture !== null && mp.joursCouverture < 3) {
        state = 'RISQUE_72H';
        justification = `🟠 Stock bas: ${mp.joursCouverture.toFixed(1)} jours de couverture`;
      } else if (mp.state === StockState.A_COMMANDER) {
        state = 'SURVEILLANCE';
        justification = '📦 Stock sous seuil de commande';
      }

      // Vérifier mono-sourcing
      const isMonoSourced = mp.fournisseurPrincipal !== null;

      return {
        productId: mp.id,
        code: mp.code,
        name: mp.name,
        unit: mp.unit,
        currentStock: mp.currentStock,
        state,
        joursCouverture: mp.joursCouverture,
        isMonoSourced,
        supplierName: mp.fournisseurPrincipal?.name ?? null,
        supplierId: mp.fournisseurPrincipal?.id ?? null,
        usedInRecipes: mp.usedInRecipes,
        justification,
      };
    }).sort((a, b) => {
      // Trier: BLOQUANT > RISQUE_48H > RISQUE_72H > SURVEILLANCE > OK
      const stateOrder: Record<MpRiskState, number> = {
        'BLOQUANT_PRODUCTION': 0,
        'RISQUE_48H': 1,
        'RISQUE_72H': 2,
        'SURVEILLANCE': 3,
        'OK': 4,
      };
      return stateOrder[a.state] - stateOrder[b.state];
    });
  }

  /**
   * Transforme les BC en retard pour l'UI Production
   */
  private transformBcCritiques(latePOs: any[]): BcCritiqueProduction[] {
    return latePOs.map(po => ({
      bcId: po.id,
      reference: po.reference,
      supplierName: po.supplier?.name ?? 'Inconnu',
      supplierId: po.supplier?.id ?? 0,
      daysLate: po.daysLate,
      expectedDelivery: po.expectedDelivery,
      impactLevel: po.impactLevel as BcImpactLevel,
      hasCriticalMp: po.hasCriticalMp,
      mpImpacted: po.items?.map((item: any) => ({
        id: item.productMp?.id,
        code: item.productMp?.code,
        name: item.productMp?.name,
      })).filter((mp: any) => mp.id) ?? [],
      status: po.status,
    })).sort((a, b) => {
      // Trier par impact puis par jours de retard
      const impactOrder: Record<BcImpactLevel, number> = {
        'BLOQUANT': 0,
        'MAJEUR': 1,
        'MINEUR': 2,
      };
      if (impactOrder[a.impactLevel] !== impactOrder[b.impactLevel]) {
        return impactOrder[a.impactLevel] - impactOrder[b.impactLevel];
      }
      return b.daysLate - a.daysLate;
    });
  }

  /**
   * Agrège les fournisseurs bloquants
   */
  private async aggregateFournisseursBloquants(
    criticalMp: StockMpWithState[],
    latePOs: any[],
  ): Promise<FournisseurBloquant[]> {
    // Map fournisseur -> MP bloquantes
    const supplierMap = new Map<number, {
      supplier: { id: number; name: string; code: string };
      mpBloquantes: { id: number; code: string; name: string }[];
      bcEnRetard: number;
    }>();

    // Ajouter les MP critiques par fournisseur
    for (const mp of criticalMp) {
      if (!mp.fournisseurPrincipal) continue;
      
      const supplierId = mp.fournisseurPrincipal.id;
      const existing = supplierMap.get(supplierId);
      
      if (existing) {
        if (mp.state === StockState.BLOQUANT_PRODUCTION || mp.state === StockState.RUPTURE) {
          existing.mpBloquantes.push({ id: mp.id, code: mp.code, name: mp.name });
        }
      } else {
        // Récupérer le code fournisseur
        const supplier = await this.prisma.supplier.findUnique({
          where: { id: supplierId },
          select: { id: true, name: true, code: true },
        });
        
        if (supplier) {
          supplierMap.set(supplierId, {
            supplier,
            mpBloquantes: (mp.state === StockState.BLOQUANT_PRODUCTION || mp.state === StockState.RUPTURE)
              ? [{ id: mp.id, code: mp.code, name: mp.name }]
              : [],
            bcEnRetard: 0,
          });
        }
      }
    }

    // Compter les BC en retard par fournisseur
    for (const po of latePOs) {
      const supplierId = po.supplier?.id;
      if (!supplierId) continue;
      
      const existing = supplierMap.get(supplierId);
      if (existing) {
        existing.bcEnRetard++;
      } else {
        supplierMap.set(supplierId, {
          supplier: { id: supplierId, name: po.supplier.name, code: po.supplier.code || '' },
          mpBloquantes: [],
          bcEnRetard: 1,
        });
      }
    }

    // Transformer en array
    return Array.from(supplierMap.values())
      .map(entry => ({
        supplierId: entry.supplier.id,
        name: entry.supplier.name,
        code: entry.supplier.code,
        blockingMpCount: entry.mpBloquantes.length,
        isMonoSourceForCriticalMp: entry.mpBloquantes.length > 0, // Simplifié: mono si MP bloquante
        mpBloquantes: entry.mpBloquantes,
        bcEnRetard: entry.bcEnRetard,
      }))
      .filter(f => f.blockingMpCount > 0 || f.bcEnRetard > 0)
      .sort((a, b) => {
        // Trier par MP bloquantes puis BC en retard
        if (a.blockingMpCount !== b.blockingMpCount) {
          return b.blockingMpCount - a.blockingMpCount;
        }
        return b.bcEnRetard - a.bcEnRetard;
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // A1: GET /production/dashboard/at-risk
  // Productions planifiées à risque supply chain
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * A1: Récupère les productions à risque
   * 
   * Question métier: "Quelles productions prévues vont échouer si je ne fais rien ?"
   * 
   * Sources:
   * - Production orders PENDING/IN_PROGRESS
   * - ApproService.getCriticalMp() pour les MP critiques
   * - PurchaseOrderService.getLatePurchaseOrders() pour les BC en retard
   */
  async getProductionsAtRisk(): Promise<ProductionsAtRiskResponse> {
    // 1. Récupérer les ordres de production actifs (PENDING, IN_PROGRESS)
    const activeOrders = await this.prisma.productionOrder.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: {
        productPf: {
          select: { id: true, code: true, name: true, unit: true },
        },
        recipe: {
          include: {
            items: {
              where: { affectsStock: true },
              include: {
                productMp: {
                  select: { id: true, code: true, name: true, unit: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (activeOrders.length === 0) {
      return {
        productions: [],
        summary: { totalAtRisk: 0, critical: 0, warning: 0 },
        generatedAt: new Date().toISOString(),
      };
    }

    // 2. Récupérer les données supply chain en une seule fois
    const [criticalMp, latePOs] = await Promise.all([
      this.approService.getCriticalMp(),
      this.poService.getLatePurchaseOrders(3),
    ]);

    // Créer des maps pour lookup rapide
    const criticalMpMap = new Map(criticalMp.map(mp => [mp.id, mp]));
    const latePOsMpIds = new Set<number>();
    const latePOsMap = new Map<number, any[]>(); // mpId -> BC info

    for (const po of latePOs) {
      for (const item of po.items || []) {
        if (item.productMp?.id) {
          latePOsMpIds.add(item.productMp.id);
          if (!latePOsMap.has(item.productMp.id)) {
            latePOsMap.set(item.productMp.id, []);
          }
          latePOsMap.get(item.productMp.id)!.push({
            bcId: po.id,
            reference: po.reference,
            daysLate: po.daysLate,
            supplierName: po.supplier?.name,
            isCritical: po.isCritical,
          });
        }
      }
    }

    // 3. Analyser chaque ordre de production
    const productionsAtRisk: ProductionAtRisk[] = [];

    for (const order of activeOrders) {
      const reasons: ProductionRiskReason[] = [];
      let hasBlocking = false;
      let hasWarning = false;

      // Vérifier chaque MP de la recette
      if (order.recipe?.items) {
        for (const item of order.recipe.items) {
          if (!item.productMp) continue;

          const mpId = item.productMp.id;
          const requiredQty = Number(item.quantity) * order.batchCount;

          // Vérifier si cette MP est critique
          const critMp = criticalMpMap.get(mpId);
          if (critMp) {
            // Vérifier stock disponible
            const totalStock = await this.getAvailableStock(mpId);
            const canCover = totalStock >= requiredQty;

            if (critMp.state === StockState.BLOQUANT_PRODUCTION || critMp.state === StockState.RUPTURE) {
              hasBlocking = true;
              reasons.push({
                type: 'MP',
                label: `${item.productMp.name} : stock insuffisant (${totalStock.toFixed(1)} ${item.productMp.unit} / ${requiredQty.toFixed(1)} requis)`,
                code: item.productMp.code,
                daysCover: critMp.joursCouverture ?? 0,
              });
            } else if (critMp.joursCouverture !== null && critMp.joursCouverture < 2) {
              hasWarning = true;
              reasons.push({
                type: 'MP',
                label: `${item.productMp.name} : couverture ${critMp.joursCouverture.toFixed(1)} jour (seuil min: 2j)`,
                code: item.productMp.code,
                daysCover: critMp.joursCouverture,
              });
            } else if (critMp.joursCouverture !== null && critMp.joursCouverture < 3 && !canCover) {
              hasWarning = true;
              reasons.push({
                type: 'MP',
                label: `${item.productMp.name} : couverture ${critMp.joursCouverture.toFixed(1)} jours`,
                code: item.productMp.code,
                daysCover: critMp.joursCouverture,
              });
            }
          }

          // Vérifier si un BC en retard impacte cette MP
          const bcInfos = latePOsMap.get(mpId);
          if (bcInfos && bcInfos.length > 0) {
            for (const bc of bcInfos) {
              if (bc.isCritical) {
                hasBlocking = true;
                reasons.push({
                  type: 'BC',
                  label: `BC ${bc.reference} en retard (+${bc.daysLate}j)`,
                  code: bc.reference,
                  daysLate: bc.daysLate,
                  supplierName: bc.supplierName,
                });
              } else if (bc.daysLate > 0) {
                hasWarning = true;
                reasons.push({
                  type: 'BC',
                  label: `BC ${bc.reference} retardé (+${bc.daysLate}j) - ${bc.supplierName}`,
                  code: bc.reference,
                  daysLate: bc.daysLate,
                  supplierName: bc.supplierName,
                });
              }
            }
          }
        }
      }

      // Ajouter à la liste si risque détecté
      if (reasons.length > 0) {
        // Dédupliquer les raisons
        const uniqueReasons = this.deduplicateReasons(reasons);

        productionsAtRisk.push({
          orderId: order.id,
          reference: order.reference,
          productName: order.productPf.name,
          productCode: order.productPf.code,
          plannedDate: order.createdAt.toISOString(),
          riskLevel: hasBlocking ? 'CRITICAL' : 'WARNING',
          reasons: uniqueReasons,
          canStart: !hasBlocking,
          batchCount: order.batchCount,
          targetQuantity: order.targetQuantity,
        });
      }
    }

    // Trier: CRITICAL d'abord, puis WARNING
    productionsAtRisk.sort((a, b) => {
      if (a.riskLevel === 'CRITICAL' && b.riskLevel !== 'CRITICAL') return -1;
      if (a.riskLevel !== 'CRITICAL' && b.riskLevel === 'CRITICAL') return 1;
      return 0;
    });

    const critical = productionsAtRisk.filter(p => p.riskLevel === 'CRITICAL').length;
    const warning = productionsAtRisk.filter(p => p.riskLevel === 'WARNING').length;

    return {
      productions: productionsAtRisk.slice(0, 10), // Max 10 pour la perf
      summary: {
        totalAtRisk: productionsAtRisk.length,
        critical,
        warning,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Helper: Récupère le stock disponible pour une MP (lots non expirés)
   */
  private async getAvailableStock(productMpId: number): Promise<number> {
    const lots = await this.prisma.lotMp.findMany({
      where: {
        productId: productMpId,
        OR: [
          { expiryDate: null },
          { expiryDate: { gt: new Date() } },
        ],
      },
      select: { quantityRemaining: true },
    });
    return lots.reduce((sum, l) => sum + l.quantityRemaining, 0);
  }

  /**
   * Helper: Déduplique les raisons (même code = même raison)
   */
  private deduplicateReasons(reasons: ProductionRiskReason[]): ProductionRiskReason[] {
    const seen = new Set<string>();
    return reasons.filter(r => {
      const key = `${r.type}-${r.code || r.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
