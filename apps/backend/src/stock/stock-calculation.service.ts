import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductType, Prisma } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK CALCULATION SERVICE — Source unique de vérité pour les calculs de stock
// ═══════════════════════════════════════════════════════════════════════════════
// RÈGLE: Stock = SUM(IN) - SUM(OUT) depuis stockMovement
// Ce service centralise TOUS les calculs de stock pour éviter les divergences.
// Utiliser ce service au lieu de recalculer dans chaque module.
// ═══════════════════════════════════════════════════════════════════════════════

export type StockState = 'SAIN' | 'SOUS_SEUIL' | 'A_COMMANDER' | 'RUPTURE' | 'BLOQUANT_PRODUCTION';
export type StockStatus = 'OK' | 'ALERTE' | 'RUPTURE';
export type MpCriticite = 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'BLOQUANTE';

@Injectable()
export class StockCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCUL DE BASE: Stock d'un produit unique
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcule le stock actuel d'un produit (MP ou PF) à partir des mouvements.
   * Stock = SUM(IN) - SUM(OUT) where isDeleted = false
   */
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

    return this.sumMovements(movements);
  }

  /**
   * Même calcul mais dans un contexte transactionnel (production, inventaire).
   * Utilise l'isolation Serializable pour éviter les race conditions.
   */
  async calculateStockInTransaction(
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

    return this.sumMovements(movements);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCUL BATCH: Stock de plusieurs MP en une requête
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcule le stock actuel pour une liste de MP.
   * Optimisé pour un seul appel SQL avec groupBy.
   */
  async calculateMpStocks(productMpIds: number[]): Promise<Map<number, number>> {
    if (productMpIds.length === 0) return new Map();

    const movements = await this.prisma.stockMovement.groupBy({
      by: ['productMpId', 'movementType'],
      where: {
        productMpId: { in: productMpIds },
        isDeleted: false,
      },
      _sum: { quantity: true },
    });

    const stockMap = new Map<number, number>();
    productMpIds.forEach(id => stockMap.set(id, 0));

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

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉTAT DU STOCK: Classification par seuils
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Détermine l'état simple du stock (OK / ALERTE / RUPTURE).
   */
  getStockStatus(stock: number, minStock: number): StockStatus {
    if (stock === 0) return 'RUPTURE';
    if (stock <= minStock) return 'ALERTE';
    return 'OK';
  }

  /**
   * Calcule l'état complet du stock MP avec seuils de sécurité/commande.
   * Prend en compte la criticité et l'utilisation dans les recettes.
   */
  computeStockState(
    currentStock: number,
    minStock: number,
    seuilSecurite: number | null,
    seuilCommande: number | null,
    criticite: MpCriticite,
    usedInActiveRecipe: boolean,
  ): StockState {
    const effectiveSeuilSecurite = seuilSecurite ?? minStock;
    const effectiveSeuilCommande = seuilCommande ?? Math.round(minStock * 1.5);

    if (currentStock <= 0) {
      if (usedInActiveRecipe || criticite === 'BLOQUANTE') {
        return 'BLOQUANT_PRODUCTION';
      }
      return 'RUPTURE';
    }

    if (currentStock <= effectiveSeuilCommande) {
      if (criticite === 'BLOQUANTE' && currentStock < effectiveSeuilSecurite) {
        return 'BLOQUANT_PRODUCTION';
      }
      return 'A_COMMANDER';
    }

    if (currentStock <= effectiveSeuilSecurite) {
      return 'SOUS_SEUIL';
    }

    return 'SAIN';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTRIQUES AVANCÉES: Rotation, couverture
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcule les jours de couverture du stock (stock actuel / consommation journalière).
   * Retourne null si pas de consommation dans les 30 derniers jours.
   */
  async calculateDaysCoverage(productType: ProductType, productId: number): Promise<number | null> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const outflows = await this.prisma.stockMovement.aggregate({
      where: {
        productType,
        ...(productType === 'MP' ? { productMpId: productId } : { productPfId: productId }),
        movementType: 'OUT',
        isDeleted: false,
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { quantity: true },
    });

    const totalOut = outflows._sum.quantity ?? 0;
    if (totalOut === 0) return null;

    const dailyConsumption = totalOut / 30;
    const currentStock = await this.calculateStock(productType, productId);

    return Math.round(currentStock / dailyConsumption);
  }

  /**
   * Calcule la rotation de stock en jours.
   * Rotation = stock actuel / (sorties 30 jours / 30)
   */
  async calculateStockRotation(productType: ProductType, productId: number): Promise<number> {
    const coverage = await this.calculateDaysCoverage(productType, productId);
    return coverage ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private sumMovements(
    movements: { movementType: string; _sum: { quantity: number | null } }[],
  ): number {
    let totalIn = 0;
    let totalOut = 0;

    for (const m of movements) {
      if (m.movementType === 'IN') {
        totalIn = m._sum.quantity ?? 0;
      } else {
        totalOut = m._sum.quantity ?? 0;
      }
    }

    return totalIn - totalOut;
  }
}
