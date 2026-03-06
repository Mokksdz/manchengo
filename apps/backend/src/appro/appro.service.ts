/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * APPRO SERVICE - MODULE APPROVISIONNEMENT INDUSTRIEL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Service métier principal pour la gestion des approvisionnements MP.
 * Niveau industriel: prédictif, traçable, orienté continuité de production.
 * 
 * Fonctionnalités:
 * - Dashboard APPRO avec KPIs (IRS, MP critiques, jours couverture)
 * - Calcul d'état stock intelligent (computeStockState)
 * - Auto-suggestion de réquisitions
 * - Performance fournisseurs
 * - Alertes intelligentes
 * 
 * @author Manchengo ERP Team
 * @version 2.0.0 - Industrial Pro
 */

import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MpCriticite, SupplierGrade } from '@prisma/client';
import { ApproAlertService } from './appro-alert.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * État calculé du stock MP (ne jamais saisir manuellement)
 */
export enum StockState {
  SAIN = 'SAIN',                           // Stock OK
  SOUS_SEUIL = 'SOUS_SEUIL',               // Stock < seuil sécurité
  A_COMMANDER = 'A_COMMANDER',             // Stock < seuil commande
  RUPTURE = 'RUPTURE',                     // Stock = 0
  BLOQUANT_PRODUCTION = 'BLOQUANT_PRODUCTION', // Rupture + utilisé dans recette active
}

/**
 * Statut global de l'IRS (Indice de Risque Stock)
 */
export enum IrsStatus {
  SAIN = 'SAIN',             // IRS 0-30
  SURVEILLANCE = 'SURVEILLANCE', // IRS 31-60
  CRITIQUE = 'CRITIQUE',     // IRS 61-100
}

/**
 * Priorité calculée pour les suggestions de réquisition
 */
export enum SuggestionPriority {
  CRITIQUE = 'CRITIQUE',
  ELEVEE = 'ELEVEE',
  NORMALE = 'NORMALE',
}

/**
 * Interface pour une MP avec état calculé
 */
export interface StockMpWithState {
  id: number;
  code: string;
  name: string;
  unit: string;
  category: string;
  currentStock: number;
  minStock: number;
  seuilSecurite: number | null;
  seuilCommande: number | null;
  leadTimeFournisseur: number;
  consommationMoyJour: number | null;
  joursCouverture: number | null;       // null = Infinity (pas de consommation)
  criticiteParam: MpCriticite;          // Criticité paramétrable (manuelle)
  criticiteEffective: MpCriticite;      // Criticité effective (max param, recettes)
  state: StockState;
  fournisseurPrincipal: { id: number; name: string; grade: SupplierGrade } | null;
  usedInRecipes: number; // Nombre de recettes utilisant cette MP
}

/**
 * Interface pour le Dashboard APPRO
 */
export interface ApproDashboard {
  irs: {
    value: number;
    status: IrsStatus;
    details: {
      mpRupture: number;
      mpSousSeuil: number;
      mpCritiquesProduction: number;
    };
  };
  mpCritiquesProduction: StockMpWithState[];
  stockStats: {
    total: number;
    sain: number;
    sousSeuil: number;
    aCommander: number;
    rupture: number;
    bloquantProduction: number;
  };
  alertesActives: number;
  bcEnAttente: number;
}

/**
 * Interface pour une suggestion de réquisition
 */
export interface RequisitionSuggestion {
  productMpId: number;
  productMp: {
    code: string;
    name: string;
    unit: string;
  };
  currentStock: number;
  seuilCommande: number;
  quantiteRecommandee: number;
  priority: SuggestionPriority;
  fournisseurSuggere: { id: number; name: string; grade: SupplierGrade } | null;
  justification: string;
  joursCouvertureActuels: number | null;
  impactProduction: string[];
}

/**
 * Interface pour la performance fournisseur
 */
export interface SupplierPerformance {
  id: number;
  code: string;
  name: string;
  grade: SupplierGrade;
  scorePerformance: number;
  metrics: {
    delaiReelMoyen: number | null;
    leadTimeAnnonce: number;
    tauxRetard: number;
    tauxEcartQuantite: number;
    tauxRupturesCausees: number;
  };
  stats: {
    totalLivraisons: number;
    livraisonsRetard: number;
  };
  productsMpCount: number;
}

@Injectable()
export class ApproService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ApproAlertService))
    private approAlertService: ApproAlertService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // DASHBOARD APPRO - MODE PILOTAGE
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Retourne le dashboard complet du module APPRO
   * Inclut: IRS, MP critiques, stats stock, alertes
   */
  async getDashboard(): Promise<ApproDashboard> {
    // Récupérer toutes les MP avec état calculé
    const stockMp = await this.getStockMpWithState();
    
    // Calculer les stats par état
    const stockStats = {
      total: stockMp.length,
      sain: stockMp.filter(mp => mp.state === StockState.SAIN).length,
      sousSeuil: stockMp.filter(mp => mp.state === StockState.SOUS_SEUIL).length,
      aCommander: stockMp.filter(mp => mp.state === StockState.A_COMMANDER).length,
      rupture: stockMp.filter(mp => mp.state === StockState.RUPTURE).length,
      bloquantProduction: stockMp.filter(mp => mp.state === StockState.BLOQUANT_PRODUCTION).length,
    };

    // Calculer l'IRS (Indice de Risque Stock)
    const irs = this.calculateIRS(stockMp, stockStats);

    // MP critiques pour la production (top 5)
    const mpCritiquesProduction = stockMp
      .filter(mp => mp.state === StockState.BLOQUANT_PRODUCTION || 
                    (mp.state === StockState.RUPTURE && mp.usedInRecipes > 0) ||
                    (mp.criticiteEffective === MpCriticite.BLOQUANTE && mp.state !== StockState.SAIN))
      .sort((a, b) => {
        // Trier par criticité puis par jours de couverture
        if (a.state === StockState.BLOQUANT_PRODUCTION && b.state !== StockState.BLOQUANT_PRODUCTION) return -1;
        if (b.state === StockState.BLOQUANT_PRODUCTION && a.state !== StockState.BLOQUANT_PRODUCTION) return 1;
        return (a.joursCouverture ?? 0) - (b.joursCouverture ?? 0);
      })
      .slice(0, 5);

    // Compter les alertes actives
    const alertesActives = await this.prisma.alert.count({
      where: {
        status: 'OPEN',
        type: { in: ['LOW_STOCK_MP', 'STOCK_EXPIRING'] },
      },
    });

    // Compter les BC en attente (DRAFT ou SENT)
    const bcEnAttente = await this.prisma.purchaseOrder.count({
      where: { status: { in: ['DRAFT', 'SENT'] } },
    });

    return {
      irs,
      mpCritiquesProduction,
      stockStats,
      alertesActives,
      bcEnAttente,
    };
  }

  /**
   * Calcule l'Indice de Risque Stock (IRS) - Formule PRO
   * 
   * IRS = (nbBloquantes * 30) + (nbRuptures * 20) + (nbSousSeuil * 10)
   * Clamp 0-100
   * 
   * Pourquoi cette formule:
   * - Une seule MP bloquante doit faire très mal au score
   * - C'est un outil de pilotage, pas un indicateur marketing
   */
  private calculateIRS(
    _stockMp: StockMpWithState[],
    stats: { rupture: number; sousSeuil: number; bloquantProduction: number; total: number }
  ): { value: number; status: IrsStatus; details: { mpRupture: number; mpSousSeuil: number; mpCritiquesProduction: number } } {
    if (stats.total === 0) {
      return { value: 0, status: IrsStatus.SAIN, details: { mpRupture: 0, mpSousSeuil: 0, mpCritiquesProduction: 0 } };
    }

    // Formule PRO pondérée par impact production
    const scoreBloquantes = stats.bloquantProduction * 30;  // Une bloquante = +30 points
    const scoreRuptures = stats.rupture * 20;               // Une rupture = +20 points
    const scoreSousSeuil = stats.sousSeuil * 10;            // Sous seuil = +10 points

    // Clamp 0-100
    const irsValue = Math.min(100, Math.max(0, scoreBloquantes + scoreRuptures + scoreSousSeuil));

    // Déterminer le statut
    let status: IrsStatus;
    if (irsValue <= 30) {
      status = IrsStatus.SAIN;
    } else if (irsValue <= 60) {
      status = IrsStatus.SURVEILLANCE;
    } else {
      status = IrsStatus.CRITIQUE;
    }

    return {
      value: irsValue,
      status,
      details: {
        mpRupture: stats.rupture,
        mpSousSeuil: stats.sousSeuil,
        mpCritiquesProduction: stats.bloquantProduction,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STOCK MP - NIVEAU INDUSTRIEL
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Retourne toutes les MP avec leur état calculé
   */
  async getStockMpWithState(): Promise<StockMpWithState[]> {
    // Récupérer toutes les MP actives avec leurs relations
    const products = await this.prisma.productMp.findMany({
      where: { isActive: true, isStockTracked: true },
      include: {
        fournisseurPrincipal: {
          select: { id: true, name: true, grade: true },
        },
        recipeItems: {
          include: {
            recipe: { select: { isActive: true } },
          },
        },
      },
    });

    // Calculer le stock actuel pour chaque MP
    const stockMap = await this.calculateCurrentStocks(products.map(p => p.id));

    return products.map(product => {
      const currentStock = stockMap.get(product.id) ?? 0;
      const usedInRecipes = product.recipeItems.filter(ri => ri.recipe?.isActive).length;
      
      // Criticité effective = max(criticité param, criticité recettes actives)
      // Si utilisé dans ≥2 recettes actives → au moins HAUTE
      // Si utilisé dans ≥1 recette active avec état critique → BLOQUANTE
      const criticiteEffective = this.computeCriticiteEffective(
        product.criticite,
        usedInRecipes,
      );
      
      const state = this.computeStockState(
        currentStock,
        product.minStock,
        product.seuilSecurite,
        product.seuilCommande,
        criticiteEffective, // Utiliser criticité effective
        usedInRecipes > 0,
      );

      // Jours de couverture: null si consommation = 0 (représente Infinity côté UI)
      // Use null coalescing instead of Number() to safely handle Decimal/null fields
      const consommation = product.consommationMoyJour ?? 0;
      const consommationNum = typeof consommation === 'number' ? consommation : Number(consommation);
      const joursCouverture = consommationNum > 0
        ? currentStock / consommationNum
        : null; // null = Infinity (pas de consommation)

      return {
        id: product.id,
        code: product.code,
        name: product.name,
        unit: product.unit,
        category: product.category,
        currentStock,
        minStock: product.minStock,
        seuilSecurite: product.seuilSecurite,
        seuilCommande: product.seuilCommande,
        leadTimeFournisseur: product.leadTimeFournisseur,
        consommationMoyJour: product.consommationMoyJour != null ? Number(product.consommationMoyJour) : null,
        joursCouverture, // Calculé dynamiquement
        criticiteParam: product.criticite,
        criticiteEffective,
        state,
        fournisseurPrincipal: product.fournisseurPrincipal,
        usedInRecipes,
      };
    });
  }

  /**
   * Retourne uniquement les MP critiques (à risque pour la production)
   */
  async getCriticalMp(): Promise<StockMpWithState[]> {
    const allMp = await this.getStockMpWithState();
    return allMp.filter(mp => 
      mp.state === StockState.BLOQUANT_PRODUCTION ||
      mp.state === StockState.RUPTURE ||
      mp.state === StockState.A_COMMANDER ||
      mp.criticiteEffective === MpCriticite.BLOQUANTE
    );
  }

  /**
   * Calcule la criticité effective d'une MP
   * 
   * Règle: criticiteEffective = max(criticiteParam, criticiteRecettes)
   * - Si utilisé dans ≥2 recettes actives → au moins HAUTE
   * - Si criticité param = BLOQUANTE → toujours BLOQUANTE
   * 
   * Évite 80% des erreurs humaines de classification
   */
  private computeCriticiteEffective(
    criticiteParam: MpCriticite,
    usedInRecipesCount: number,
  ): MpCriticite {
    // Ordre de criticité (index = poids)
    const criticiteOrder: MpCriticite[] = [
      MpCriticite.FAIBLE,
      MpCriticite.MOYENNE,
      MpCriticite.HAUTE,
      MpCriticite.BLOQUANTE,
    ];

    // Criticité basée sur les recettes
    let criticiteRecettes: MpCriticite = MpCriticite.FAIBLE;
    if (usedInRecipesCount >= 3) {
      criticiteRecettes = MpCriticite.BLOQUANTE;
    } else if (usedInRecipesCount >= 2) {
      criticiteRecettes = MpCriticite.HAUTE;
    } else if (usedInRecipesCount >= 1) {
      criticiteRecettes = MpCriticite.MOYENNE;
    }

    // Prendre le max
    const indexParam = criticiteOrder.indexOf(criticiteParam);
    const indexRecettes = criticiteOrder.indexOf(criticiteRecettes);
    
    return criticiteOrder[Math.max(indexParam, indexRecettes)];
  }

  /**
   * Met à jour les paramètres APPRO d'une MP avec validation métier
   * 
   * Validation: seuilCommande doit être > seuilSecurite
   */
  async updateProductMpAppro(id: number, dto: {
    seuilSecurite?: number;
    seuilCommande?: number;
    quantiteCommande?: number;
    leadTimeFournisseur?: number;
    criticite?: MpCriticite;
    fournisseurPrincipalId?: number;
  }) {
    // Récupérer la MP actuelle
    const current = await this.prisma.productMp.findUnique({ where: { id } });
    if (!current) {
      throw new BadRequestException(`MP avec id ${id} introuvable`);
    }

    // Validation: seuilCommande doit être > seuilSecurite
    const newSeuilSecurite = dto.seuilSecurite ?? current.seuilSecurite ?? current.minStock;
    const newSeuilCommande = dto.seuilCommande ?? current.seuilCommande;

    if (newSeuilCommande !== null && newSeuilCommande !== undefined && 
        newSeuilSecurite !== null && newSeuilSecurite !== undefined) {
      if (newSeuilCommande <= newSeuilSecurite) {
        throw new BadRequestException(
          `seuilCommande (${newSeuilCommande}) doit être supérieur au seuilSecurite (${newSeuilSecurite})`
        );
      }
    }

    // Mettre à jour
    return this.prisma.productMp.update({
      where: { id },
      data: {
        seuilSecurite: dto.seuilSecurite,
        seuilCommande: dto.seuilCommande,
        quantiteCommande: dto.quantiteCommande,
        leadTimeFournisseur: dto.leadTimeFournisseur,
        criticite: dto.criticite,
        fournisseurPrincipalId: dto.fournisseurPrincipalId,
      },
    });
  }

  /**
   * Calcule l'état du stock pour une MP donnée
   * FONCTION CLÉ - Logique métier centralisée
   */
  computeStockState(
    currentStock: number,
    minStock: number,
    seuilSecurite: number | null,
    seuilCommande: number | null,
    criticite: MpCriticite,
    usedInActiveRecipe: boolean,
  ): StockState {
    // Seuils effectifs
    const effectiveSeuilSecurite = seuilSecurite ?? minStock;
    const effectiveSeuilCommande = seuilCommande ?? Math.round(minStock * 1.5);

    // Rupture totale
    if (currentStock <= 0) {
      // Si utilisé dans une recette active, c'est bloquant
      if (usedInActiveRecipe || criticite === MpCriticite.BLOQUANTE) {
        return StockState.BLOQUANT_PRODUCTION;
      }
      return StockState.RUPTURE;
    }

    // Stock sous seuil de sécurité (plus critique, vérifier en premier)
    if (currentStock <= effectiveSeuilSecurite) {
      if (criticite === MpCriticite.BLOQUANTE) {
        return StockState.BLOQUANT_PRODUCTION;
      }
      return StockState.SOUS_SEUIL;
    }

    // Stock sous seuil de commande
    if (currentStock <= effectiveSeuilCommande) {
      return StockState.A_COMMANDER;
    }

    return StockState.SAIN;
  }

  /**
   * Calcule le stock actuel pour une liste de MP
   * Basé sur les mouvements de stock (IN - OUT)
   */
  async calculateCurrentStocks(productMpIds: number[]): Promise<Map<number, number>> {
    const movements = await this.prisma.stockMovement.groupBy({
      by: ['productMpId', 'movementType'],
      where: {
        productMpId: { in: productMpIds },
        isDeleted: false,
      },
      _sum: { quantity: true },
    });

    const stockMap = new Map<number, number>();
    
    // Initialiser à 0
    productMpIds.forEach(id => stockMap.set(id, 0));

    // Calculer IN - OUT
    movements.forEach(m => {
      if (m.productMpId) {
        const current = stockMap.get(m.productMpId) ?? 0;
        const qty = m._sum.quantity ?? 0;
        if (m.movementType === 'IN') {
          stockMap.set(m.productMpId, current + qty);
        } else {
          stockMap.set(m.productMpId, current - qty);
        }
      }
    });

    return stockMap;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTO-SUGGESTION DE RÉQUISITIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Génère des suggestions automatiques de réquisitions
   * Basé sur: état stock, jours de couverture, lead time, criticité
   */
  async generateSuggestedRequisitions(): Promise<RequisitionSuggestion[]> {
    const stockMp = await this.getStockMpWithState();
    const suggestions: RequisitionSuggestion[] = [];

    for (const mp of stockMp) {
      // Ne suggérer que les MP qui nécessitent une action
      if (mp.state === StockState.SAIN) continue;

      // Calculer la quantité recommandée
      const quantiteRecommandee = this.calculateRecommendedQuantity(mp);
      
      // Déterminer la priorité
      const priority = this.calculateSuggestionPriority(mp);
      
      // Générer la justification
      const justification = this.generateJustification(mp);
      
      // Trouver les recettes impactées
      const impactProduction = await this.getImpactedRecipes(mp.id);

      suggestions.push({
        productMpId: mp.id,
        productMp: {
          code: mp.code,
          name: mp.name,
          unit: mp.unit,
        },
        currentStock: mp.currentStock,
        seuilCommande: mp.seuilCommande ?? mp.minStock,
        quantiteRecommandee,
        priority,
        fournisseurSuggere: mp.fournisseurPrincipal,
        justification,
        joursCouvertureActuels: mp.joursCouverture,
        impactProduction,
      });
    }

    // Trier par priorité
    return suggestions.sort((a, b) => {
      const priorityOrder = { CRITIQUE: 0, ELEVEE: 1, NORMALE: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Calcule la quantité recommandée pour une MP
   */
  private calculateRecommendedQuantity(mp: StockMpWithState): number {
    // Si quantité de commande définie, l'utiliser
    if (mp.seuilCommande !== null && mp.seuilCommande !== undefined) {
      const deficit = mp.seuilCommande - mp.currentStock;
      return Math.max(deficit, 0);
    }

    // Sinon, calculer basé sur consommation et lead time
    if (mp.consommationMoyJour && mp.consommationMoyJour > 0) {
      // Couvrir lead time + 7 jours de sécurité
      const joursACovrir = mp.leadTimeFournisseur + 7;
      const besoin = Math.ceil(mp.consommationMoyJour * joursACovrir);
      return Math.max(besoin - mp.currentStock, 0);
    }

    // Fallback: ramener au seuil minimum x 2
    return Math.max((mp.minStock * 2) - mp.currentStock, 0);
  }

  /**
   * Calcule la priorité d'une suggestion
   */
  private calculateSuggestionPriority(mp: StockMpWithState): SuggestionPriority {
    // CRITIQUE: rupture ou bloquant production
    if (mp.state === StockState.BLOQUANT_PRODUCTION || 
        mp.state === StockState.RUPTURE ||
        mp.criticiteEffective === MpCriticite.BLOQUANTE) {
      return SuggestionPriority.CRITIQUE;
    }

    // ELEVEE: jours de couverture < lead time ou A_COMMANDER avec criticité haute
    if (mp.joursCouverture !== null && mp.joursCouverture < mp.leadTimeFournisseur) {
      return SuggestionPriority.ELEVEE;
    }

    if (mp.state === StockState.A_COMMANDER || mp.criticiteEffective === MpCriticite.HAUTE) {
      return SuggestionPriority.ELEVEE;
    }

    return SuggestionPriority.NORMALE;
  }

  /**
   * Génère une justification lisible pour la suggestion
   */
  private generateJustification(mp: StockMpWithState): string {
    const reasons: string[] = [];

    if (mp.state === StockState.BLOQUANT_PRODUCTION) {
      reasons.push('⛔ Bloque la production');
    }
    if (mp.state === StockState.RUPTURE) {
      reasons.push('🔴 Rupture de stock');
    }
    if (mp.state === StockState.A_COMMANDER) {
      reasons.push('🟠 Stock sous seuil de commande');
    }
    if (mp.joursCouverture !== null && mp.joursCouverture < mp.leadTimeFournisseur) {
      reasons.push(`⚠️ Couverture ${Math.round(mp.joursCouverture)}j < Lead time ${mp.leadTimeFournisseur}j`);
    }
    if (mp.usedInRecipes > 0) {
      reasons.push(`📦 Utilisé dans ${mp.usedInRecipes} recette(s) active(s)`);
    }

    return reasons.join(' | ') || 'Réapprovisionnement recommandé';
  }

  /**
   * Retourne les recettes impactées par une MP
   */
  private async getImpactedRecipes(productMpId: number): Promise<string[]> {
    const recipeItems = await this.prisma.recipeItem.findMany({
      where: { productMpId },
      include: {
        recipe: {
          include: { productPf: { select: { name: true } } },
        },
      },
    });

    return recipeItems
      .filter(ri => ri.recipe.isActive)
      .map(ri => ri.recipe.productPf.name);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PERFORMANCE FOURNISSEURS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Retourne la performance de tous les fournisseurs
   */
  async getSuppliersPerformance(): Promise<SupplierPerformance[]> {
    const suppliers = await this.prisma.supplier.findMany({
      where: { isActive: true },
      include: {
        productsMpPrincipaux: { select: { id: true } },
      },
    });

    return suppliers.map(supplier => ({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      grade: supplier.grade,
      scorePerformance: Number(supplier.scorePerformance ?? 0),
      metrics: {
        delaiReelMoyen: supplier.delaiReelMoyen !== null ? Number(supplier.delaiReelMoyen) : null,
        leadTimeAnnonce: supplier.leadTimeJours,
        tauxRetard: Number(supplier.tauxRetard ?? 0),
        tauxEcartQuantite: Number(supplier.tauxEcartQuantite ?? 0),
        tauxRupturesCausees: Number(supplier.tauxRupturesCausees ?? 0),
      },
      stats: {
        totalLivraisons: supplier.totalLivraisons,
        livraisonsRetard: supplier.livraisonsRetard,
      },
      productsMpCount: supplier.productsMpPrincipaux.length,
    }));
  }

  /**
   * Recalcule les métriques de performance d'un fournisseur
   * À appeler après chaque réception validée
   */
  async updateSupplierPerformance(supplierId: number): Promise<void> {
    // Récupérer les BC reçus avec items pour calcul conformité quantité
    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: {
        supplierId,
        status: { in: ['RECEIVED', 'PARTIAL'] },
        receivedAt: { not: null },
      },
      select: {
        expectedDelivery: true,
        receivedAt: true,
        items: {
          select: { quantity: true, quantityReceived: true },
        },
      },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });

    if (purchaseOrders.length === 0) return;

    const totalLivraisons = purchaseOrders.length;
    let onTimeCount = 0;
    let scorableDeliveries = 0;
    let totalQuantityScore = 0;

    for (const po of purchaseOrders) {
      // Score ponctualité (50% du score total)
      // À l'heure si receivedAt <= expectedDelivery + 1 jour de tolérance
      if (po.expectedDelivery && po.receivedAt) {
        scorableDeliveries++;
        const expected = new Date(po.expectedDelivery).getTime();
        const received = new Date(po.receivedAt).getTime();
        if (received <= expected + 86400000) {
          onTimeCount++;
        }
      }

      // Score conformité quantité (50% du score total)
      // Ratio quantité reçue / quantité commandée, plafonné à 1
      const totalOrdered = po.items.reduce((sum, l) => sum + Number(l.quantity), 0);
      const totalReceived = po.items.reduce((sum, l) => sum + Number(l.quantityReceived), 0);
      if (totalOrdered > 0) {
        totalQuantityScore += Math.min(totalReceived / totalOrdered, 1);
      }
    }

    // Score final (0-100): 50% ponctualité + 50% conformité quantité
    const onTimeRate = scorableDeliveries > 0 ? (onTimeCount / scorableDeliveries) : 0.75;
    const quantityRate = totalLivraisons > 0 ? (totalQuantityScore / totalLivraisons) : 0.75;
    const scorePerformance = Math.round((onTimeRate * 50) + (quantityRate * 50));

    const grade = scorePerformance >= 90 ? SupplierGrade.A :
                  scorePerformance >= 70 ? SupplierGrade.B : SupplierGrade.C;

    const lateCount = scorableDeliveries - onTimeCount;

    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        totalLivraisons,
        livraisonsRetard: lateCount,
        tauxRetard: scorableDeliveries > 0 ? (1 - onTimeRate) : null,
        scorePerformance,
        grade,
        lastPerformanceUpdate: new Date(),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MÉTRIQUES MP - BATCH UPDATE
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Met à jour les métriques de consommation pour toutes les MP
   * À exécuter en batch (cron job quotidien)
   */
  async updateAllMpMetrics(): Promise<{ updated: number }> {
    const products = await this.prisma.productMp.findMany({
      where: { isActive: true, isStockTracked: true },
      select: { id: true },
    });

    let updated = 0;

    for (const product of products) {
      await this.updateMpMetrics(product.id);
      updated++;
    }

    return { updated };
  }

  /**
   * Met à jour les métriques d'une MP spécifique
   */
  async updateMpMetrics(productMpId: number): Promise<void> {
    // Calculer la consommation moyenne sur 30 jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const consumption = await this.prisma.stockMovement.aggregate({
      where: {
        productMpId,
        movementType: 'OUT',
        isDeleted: false,
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { quantity: true },
    });

    const totalConsumption = consumption._sum.quantity ?? 0;
    const consommationMoyJour = totalConsumption / 30;

    // Calculer le stock actuel
    const stockMap = await this.calculateCurrentStocks([productMpId]);
    const currentStock = stockMap.get(productMpId) ?? 0;

    // Calculer les jours de couverture
    const joursCouverture = consommationMoyJour > 0 
      ? currentStock / consommationMoyJour 
      : null;

    await this.prisma.productMp.update({
      where: { id: productMpId },
      data: {
        consommationMoyJour,
        joursCouverture,
        lastMetricsUpdate: new Date(),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RÈGLES MÉTIER BLOQUANTES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Vérifie si une production peut être lancée
   * RÈGLE: Impossible si MP bloquante absente
   */
  async canStartProduction(recipeId: number, batchCount: number): Promise<{
    canStart: boolean;
    reason?: string;
    blockers: { productMpId: number; name: string; required: number; available: number; shortage: number }[];
  }> {
    // Vérifier les alertes critiques non accusées avant tout
    const hasCriticalAlerts = await this.approAlertService.hasCriticalUnacknowledgedAlerts();
    if (hasCriticalAlerts) {
      return {
        canStart: false,
        reason: 'Des alertes critiques non traitées bloquent le démarrage de la production',
        blockers: [],
      };
    }

    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        items: {
          include: { productMp: true },
        },
      },
    });

    if (!recipe) {
      throw new BadRequestException('Recette introuvable');
    }

    const blockers: { productMpId: number; name: string; required: number; available: number; shortage: number }[] = [];

    // OPTIMISATION: Batch toutes les requêtes stock en une seule (évite N+1)
    const mpIdsToCheck = recipe.items
      .filter(item => item.productMpId && item.affectsStock)
      .map(item => item.productMpId as number);

    // Une seule requête pour tous les stocks
    const stockMap = mpIdsToCheck.length > 0
      ? await this.calculateCurrentStocks(mpIdsToCheck)
      : new Map<number, number>();

    // Vérifier chaque ingrédient avec le cache local
    for (const item of recipe.items) {
      if (!item.productMpId || !item.affectsStock) continue;

      const required = Math.ceil(Number(item.quantity) * batchCount);
      const available = stockMap.get(item.productMpId) ?? 0;

      if (available < required) {
        blockers.push({
          productMpId: item.productMpId,
          name: item.productMp?.name ?? item.name ?? 'Inconnu',
          required,
          available,
          shortage: required - available,
        });
      }
    }

    // RÈGLE MÉTIER V1.2: Toute production bloquée DOIT créer une alerte
    if (blockers.length > 0) {
      await this.approAlertService.createProductionBloqueeAlert(
        recipeId,
        recipe.name,
        blockers.map(b => ({
          id: b.productMpId,
          name: b.name,
          code: '', // Code non disponible ici
          required: b.required,
          available: b.available,
        })),
      );
    }

    return {
      canStart: blockers.length === 0,
      blockers,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ALERTES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Récupère les alertes APPRO actives
   */
  async getActiveAlerts() {
    return this.prisma.alert.findMany({
      where: {
        status: 'OPEN',
        type: { in: ['LOW_STOCK_MP', 'LOW_STOCK_PF', 'STOCK_EXPIRING'] },
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }
}
