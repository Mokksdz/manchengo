import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  private readonly OFFLINE_THRESHOLD_HOURS = parseInt(process.env.DEVICE_OFFLINE_THRESHOLD_HOURS || '1', 10);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * Get consistent "today at midnight" for Algeria timezone (UTC+1).
   * All "today" calculations must use this method for consistency.
   */
  private getTodayAlgiers(): Date {
    // Get current time in Algeria (UTC+1) and compute midnight in UTC
    const now = new Date();
    const utcHour = now.getUTCHours();
    const algiersHour = utcHour + 1; // UTC+1
    const algiersDate = algiersHour >= 24
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    // Midnight Algeria = 23:00 UTC previous day
    return new Date(algiersDate.getTime() - 3600000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN KPIs
  // ═══════════════════════════════════════════════════════════════════════════

  async getKpis(role?: string) {
    const key = this.cacheService.buildKpiKey(role);
    try {
      return await this.cacheService.getOrSet(key, () => this.computeKpis(), CacheTTL.KPI);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to compute KPIs: ${message}`, error instanceof Error ? error.stack : undefined);
      // Return empty KPIs instead of crashing
      return {
        stock: { mp: { total: 0, lowStock: 0 }, pf: { total: 0, lowStock: 0 } },
        sales: { todayAmount: 0, todayInvoices: 0 },
        sync: { devicesOffline: 0, pendingEvents: 0 },
        _meta: { cachedAt: new Date().toISOString(), error: message },
      };
    }
  }

  private async computeKpis() {
    const startTime = Date.now();

    const serviceNames = [
      'getTotalStockMp',
      'getTotalStockPf',
      'getTodaySalesAmount',
      'getTodayInvoicesCount',
      'getOfflineDevicesCount',
      'syncEventCount',
    ];

    const defaults = [
      { total: 0, lowStock: 0 },
      { total: 0, lowStock: 0 },
      0,
      0,
      0,
      0,
    ];

    const results = await Promise.allSettled([
      this.getTotalStockMp(),
      this.getTotalStockPf(),
      this.getTodaySalesAmount(),
      this.getTodayInvoicesCount(),
      this.getOfflineDevicesCount(),
      this.prisma.syncEvent.count({ where: { status: 'PENDING' } }),
    ]);

    const failedServices: string[] = [];
    const values = results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      const errMsg = result.reason instanceof Error ? result.reason.stack : String(result.reason);
      this.logger.error(`${serviceNames[i]} failed: ${errMsg}`);
      failedServices.push(serviceNames[i]);
      return defaults[i];
    });

    const [totalStockMp, totalStockPf, todaySales, todayInvoices, devicesOffline, pendingEvents] = values;

    return {
      stock: {
        mp: totalStockMp as { total: number; lowStock: number },
        pf: totalStockPf as { total: number; lowStock: number },
      },
      sales: {
        todayAmount: todaySales as number,
        todayInvoices: todayInvoices as number,
      },
      sync: {
        devicesOffline: devicesOffline as number,
        pendingEvents: pendingEvents as number,
      },
      _meta: {
        cachedAt: new Date().toISOString(),
        computedInMs: Date.now() - startTime,
        hasErrors: failedServices.length > 0,
        failedServices,
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

    if (productIds.length === 0) return { total: 0, lowStock: 0 };

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

    if (productIds.length === 0) return { total: 0, lowStock: 0 };

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

  // Chiffre d'affaires du jour = factures VALIDATED + PAID + PARTIALLY_PAID (exclut DRAFT et CANCELLED)
  private async getTodaySalesAmount(): Promise<number> {
    const today = this.getTodayAlgiers();

    const result = await this.prisma.invoice.aggregate({
      _sum: { netToPay: true },
      where: {
        date: { gte: today },
        status: { in: ['VALIDATED', 'PARTIALLY_PAID', 'PAID'] },
      },
    });

    return result._sum.netToPay || 0;
  }

  // V15: Only count non-cancelled invoices
  private async getTodayInvoicesCount(): Promise<number> {
    const today = this.getTodayAlgiers();

    return this.prisma.invoice.count({
      where: { date: { gte: today }, status: { not: 'CANCELLED' } },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEVICE KPIs
  // ═══════════════════════════════════════════════════════════════════════════

  private async getOfflineDevicesCount(): Promise<number> {
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - this.OFFLINE_THRESHOLD_HOURS);

    return this.prisma.device.count({
      where: {
        isActive: true,
        OR: [
          { lastSyncAt: null },
          { lastSyncAt: { lt: threshold } },
        ],
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHART DATA
  // ═══════════════════════════════════════════════════════════════════════════

  async getSalesChart(days = 7) {
    const key = this.cacheService.buildChartKey('sales', days);
    return this.cacheService.getOrSet(key, () => this.computeSalesChart(days), CacheTTL.CHART);
  }

  private async computeSalesChart(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        date: { gte: startDate },
        status: { in: ['VALIDATED', 'PARTIALLY_PAID', 'PAID'] },
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
    const key = this.cacheService.buildChartKey('production', days);
    return this.cacheService.getOrSet(key, () => this.computeProductionChart(days), CacheTTL.CHART);
  }

  private async computeProductionChart(days: number) {
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
    const key = this.cacheService.buildSyncKey('status');
    return this.cacheService.getOrSet(key, async () => {
      const devices = await this.prisma.device.findMany({
        where: { isActive: true },
        select: { id: true, name: true, lastSyncAt: true },
      });
      const threshold = new Date(Date.now() - this.OFFLINE_THRESHOLD_HOURS * 60 * 60 * 1000);
      return devices.map((d) => ({
        deviceId: d.id,
        name: d.name,
        lastSync: d.lastSyncAt?.toISOString() ?? null,
        online: d.lastSyncAt ? d.lastSyncAt > threshold : false,
      }));
    }, CacheTTL.SYNC);
  }

  async getRecentSyncEvents(limit = 20) {
    const key = `${this.cacheService.buildSyncKey('pending')}:recent:${limit}`;
    return this.cacheService.getOrSet(key, () => {
      return this.prisma.syncEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          entityType: true,
          action: true,
          status: true,
          deviceId: true,
          createdAt: true,
        },
      });
    }, CacheTTL.SYNC);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD PRODUCTION (ROLE PRODUCTION)
  // ═══════════════════════════════════════════════════════════════════════════
  // KPIs spécifiques production - AUCUNE donnée financière
  // ═══════════════════════════════════════════════════════════════════════════

  async getProductionDashboard(_userId: string) {
    const today = this.getTodayAlgiers();

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
      .map((o) => ((o.quantityProduced ?? 0) / o.targetQuantity) * 100);

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

    const alerts: { code: string; name: string; stock: number; minStock: number; joursCouverture: number; status: string }[] = [];
    let sousSeuil = 0;
    let critiques = 0;

    for (const p of products) {
      const stock = stockMap.get(p.id) || 0;

      // Enhanced alert: consider consumption rate for days of coverage
      const consommationMoyJour = Number(p.consommationMoyJour) || 0;
      const joursCouverture = consommationMoyJour > 0
        ? Math.round(stock / consommationMoyJour)
        : 999;

      let status: string;
      if (stock === 0) {
        status = 'RUPTURE';
      } else if (stock <= p.minStock || joursCouverture <= 3) {
        status = 'ALERTE';
      } else {
        status = 'OK';
      }

      if (status !== 'OK') {
        sousSeuil++;
        if (status === 'RUPTURE') critiques++;
        alerts.push({
          code: p.code,
          name: p.name,
          stock,
          minStock: p.minStock,
          joursCouverture,
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
