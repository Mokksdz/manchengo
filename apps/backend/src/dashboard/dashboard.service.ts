import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from '../sync/sync.service';
import { CacheService, CacheTTL } from '../cache/cache.service';

/**
 * Dashboard Service
 * 
 * Provides KPIs and aggregated data for admin dashboard.
 * All data is shaped for frontend charts.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private prisma: PrismaService,
    private syncService: SyncService,
    private cacheService: CacheService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN KPIs
  // ═══════════════════════════════════════════════════════════════════════════

  async getKpis(role?: string) {
    const key = this.cacheService.buildKpiKey(role);
    try {
      return await this.cacheService.getOrSet(key, () => this.computeKpis(), CacheTTL.KPI);
    } catch (error) {
      this.logger.error(`Failed to compute KPIs: ${error.message}`, error.stack);
      // Return empty KPIs instead of crashing
      return {
        stock: { mp: { total: 0, lowStock: 0 }, pf: { total: 0, lowStock: 0 } },
        sales: { todayAmount: 0, todayInvoices: 0 },
        sync: { devicesOffline: 0, pendingEvents: 0 },
        _meta: { cachedAt: new Date().toISOString(), error: error.message },
      };
    }
  }

  private async computeKpis() {
    const startTime = Date.now();

    const [
      totalStockMp,
      totalStockPf,
      todaySales,
      todayInvoices,
      devicesOffline,
      pendingEvents,
    ] = await Promise.all([
      this.getTotalStockMp().catch(() => ({ total: 0, lowStock: 0 })),
      this.getTotalStockPf().catch(() => ({ total: 0, lowStock: 0 })),
      this.getTodaySalesAmount().catch(() => 0),
      this.getTodayInvoicesCount().catch(() => 0),
      this.getOfflineDevicesCount().catch(() => 0),
      this.syncService.getPendingEventsCount().catch(() => 0),
    ]);

    return {
      stock: {
        mp: totalStockMp,
        pf: totalStockPf,
      },
      sales: {
        todayAmount: todaySales,
        todayInvoices: todayInvoices,
      },
      sync: {
        devicesOffline,
        pendingEvents,
      },
      _meta: {
        cachedAt: new Date().toISOString(),
        computedInMs: Date.now() - startTime,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK KPIs
  // ═══════════════════════════════════════════════════════════════════════════

  private async getTotalStockMp(): Promise<{ total: number; lowStock: number }> {
    // Batch: aggregate stock movements per product (consistent with StockService)
    const products = await this.prisma.productMp.findMany({
      where: { isActive: true },
      select: { id: true, minStock: true },
    });

    const productIds = products.map((p) => p.id);

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

    let total = 0;
    let lowStock = 0;
    for (const p of products) {
      const stock = stockMap.get(p.id) || 0;
      total += stock;
      if (stock < p.minStock) lowStock++;
    }

    return { total, lowStock };
  }

  private async getTotalStockPf(): Promise<{ total: number; lowStock: number }> {
    // Batch: aggregate stock movements per product (consistent with StockService)
    const products = await this.prisma.productPf.findMany({
      where: { isActive: true },
      select: { id: true, minStock: true },
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

    let total = 0;
    let lowStock = 0;
    for (const p of products) {
      const stock = stockMap.get(p.id) || 0;
      total += stock;
      if (stock < p.minStock) lowStock++;
    }

    return { total, lowStock };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SALES KPIs
  // ═══════════════════════════════════════════════════════════════════════════

  private async getTodaySalesAmount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.invoice.aggregate({
      _sum: { netToPay: true },
      where: {
        date: { gte: today },
        status: 'PAID',
      },
    });

    return result._sum.netToPay || 0;
  }

  // V15: Only count non-cancelled invoices
  private async getTodayInvoicesCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.invoice.count({
      where: { date: { gte: today }, status: { not: 'CANCELLED' } },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEVICE KPIs
  // ═══════════════════════════════════════════════════════════════════════════

  private async getOfflineDevicesCount(): Promise<number> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    return this.prisma.device.count({
      where: {
        isActive: true,
        OR: [
          { lastSyncAt: null },
          { lastSyncAt: { lt: oneHourAgo } },
        ],
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHART DATA
  // ═══════════════════════════════════════════════════════════════════════════

  async getSalesChart(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        date: { gte: startDate },
        status: 'PAID',
      },
      select: {
        date: true,
        netToPay: true,
      },
      orderBy: { date: 'asc' },
    });

    // Group by day
    const dailySales: Record<string, number> = {};
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dailySales[date.toISOString().split('T')[0]] = 0;
    }

    for (const inv of invoices) {
      const day = inv.date.toISOString().split('T')[0];
      dailySales[day] = (dailySales[day] || 0) + inv.netToPay;
    }

    return Object.entries(dailySales).map(([date, amount]) => ({
      date,
      amount,
    }));
  }

  async getProductionChart(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const orders = await this.prisma.productionOrder.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        status: true,
        targetQuantity: true,
        quantityProduced: true, // P14: use actual produced quantity
      },
    });

    // Group by day
    const dailyProduction: Record<string, { planned: number; completed: number }> = {};
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dailyProduction[date.toISOString().split('T')[0]] = { planned: 0, completed: 0 };
    }

    for (const order of orders) {
      const day = order.createdAt.toISOString().split('T')[0];
      if (dailyProduction[day]) {
        dailyProduction[day].planned += order.targetQuantity;
        if (order.status === 'COMPLETED') {
          // P14: Use quantityProduced (actual) instead of targetQuantity
          dailyProduction[day].completed += order.quantityProduced || order.targetQuantity;
        }
      }
    }

    return Object.entries(dailyProduction).map(([date, data]) => ({
      date,
      ...data,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  async getSyncStatus() {
    return this.syncService.getDeviceSyncStatus();
  }

  async getRecentSyncEvents(limit = 20) {
    return this.syncService.getRecentEvents(limit);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD PRODUCTION (ROLE PRODUCTION)
  // ═══════════════════════════════════════════════════════════════════════════
  // KPIs spécifiques production - AUCUNE donnée financière
  // ═══════════════════════════════════════════════════════════════════════════

  async getProductionDashboard(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      ordersToday,
      ordersPending,
      ordersInProgress,
      ordersCompleted,
      productionStats,
      mpAlerts,
      recettesNonConfigurees,
      demandesEnvoyees,
      demandesEnAttente,
    ] = await Promise.all([
      // Ordres aujourd'hui
      this.prisma.productionOrder.count({
        where: { createdAt: { gte: today } },
      }),
      // Ordres en attente
      this.prisma.productionOrder.count({
        where: { status: 'PENDING' },
      }),
      // Ordres en cours
      this.prisma.productionOrder.count({
        where: { status: 'IN_PROGRESS' },
      }),
      // Ordres terminés (7 derniers jours)
      this.prisma.productionOrder.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      // Stats production (quantité produite, rendement)
      this.getProductionStats(),
      // Alertes MP (sous seuil)
      this.getMpAlerts(),
      // Recettes non configurées
      this.getRecettesNonConfigurees(),
      // Demandes appro envoyées (SENT status)
      this.prisma.purchaseOrder.count({
        where: { status: 'SENT' },
      }).catch(() => 0),
      // Demandes appro en attente (DRAFT status)
      this.prisma.purchaseOrder.count({
        where: { status: 'DRAFT' },
      }).catch(() => 0),
    ]);

    return {
      production: {
        ordersToday,
        ordersPending,
        ordersInProgress,
        ordersCompleted,
        quantiteProduite: productionStats.quantiteProduite,
        rendementMoyen: productionStats.rendementMoyen,
      },
      approvisionnement: {
        mpSousSeuil: mpAlerts.sousSeuil,
        mpCritiques: mpAlerts.critiques,
        demandesEnvoyees,
        demandesEnAttente,
      },
      alertes: {
        recettesNonConfigurees,
        mpAlertList: mpAlerts.list,
      },
      _meta: {
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private async getProductionStats() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const completedOrders = await this.prisma.productionOrder.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: sevenDaysAgo },
      },
      select: {
        targetQuantity: true,
        quantityProduced: true,
      },
    });

    const quantiteProduite = completedOrders.reduce(
      (sum, o) => sum + (o.quantityProduced || 0),
      0,
    );

    const rendements = completedOrders
      .filter((o) => o.targetQuantity > 0 && o.quantityProduced)
      .map((o) => (o.quantityProduced! / o.targetQuantity) * 100);

    const rendementMoyen =
      rendements.length > 0
        ? Math.round(rendements.reduce((a, b) => a + b, 0) / rendements.length)
        : 0;

    return { quantiteProduite, rendementMoyen };
  }

  private async getMpAlerts() {
    const products = await this.prisma.productMp.findMany({
      where: { isActive: true, isStockTracked: true },
    });

    const productIds = products.map((p) => p.id);

    // Batch: 1 query instead of N
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

    const alerts: { code: string; name: string; stock: number; minStock: number; status: string }[] = [];
    let sousSeuil = 0;
    let critiques = 0;

    for (const p of products) {
      const stock = stockMap.get(p.id) || 0;

      if (stock <= p.minStock) {
        sousSeuil++;
        const status = stock === 0 ? 'RUPTURE' : 'ALERTE';
        if (stock === 0) critiques++;
        alerts.push({
          code: p.code,
          name: p.name,
          stock,
          minStock: p.minStock,
          status,
        });
      }
    }

    return { sousSeuil, critiques, list: alerts.slice(0, 10) };
  }

  private async getRecettesNonConfigurees() {
    // Produits PF sans recette configurée
    const produitsAvecRecette = await this.prisma.recipe.findMany({
      select: { productPfId: true },
      distinct: ['productPfId'],
    });

    const idsAvecRecette = produitsAvecRecette.map((r) => r.productPfId);

    return this.prisma.productPf.count({
      where: {
        isActive: true,
        id: { notIn: idsAvecRecette },
      },
    });
  }

}
