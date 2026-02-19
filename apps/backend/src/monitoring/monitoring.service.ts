import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityAction } from '@prisma/client';

/**
 * Monitoring Service
 * 
 * Computes real-time KPIs from PostgreSQL data.
 * All metrics are read-only snapshots - no business logic modification.
 * 
 * KPI Categories:
 * - Sync: Active devices, sync health, pending events
 * - Stock: MP/PF levels, low stock counts
 * - Fiscal: Today's sales, cash vs other, VAT totals
 * - Security: Access denied, failed logins, active users
 */
@Injectable()
export class MonitoringService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all system KPIs
   * Called by admin dashboard for overview
   */
  async getKpis() {
    const [
      syncKpis,
      stockKpis,
      fiscalKpis,
      securityKpis,
    ] = await Promise.all([
      this.getSyncKpis(),
      this.getStockKpis(),
      this.getFiscalKpis(),
      this.getSecurityKpis(),
    ]);

    return {
      sync: syncKpis,
      stock: stockKpis,
      fiscal: fiscalKpis,
      security: securityKpis,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Sync-related KPIs
   */
  private async getSyncKpis() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Device stats
    const [totalDevices, activeDevices, offlineDevices] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.device.count({
        where: { isActive: true, lastSyncAt: { gte: oneDayAgo } },
      }),
      this.prisma.device.count({
        where: {
          isActive: true,
          OR: [
            { lastSyncAt: null },
            { lastSyncAt: { lt: oneDayAgo } },
          ],
        },
      }),
    ]);

    // Sync events stats
    const [syncEventsToday, pendingEvents, recentSyncFailures] = await Promise.all([
      this.prisma.syncEvent.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.syncEvent.count({
        where: { appliedAt: null },
      }),
      this.prisma.securityLog.count({
        where: {
          action: SecurityAction.SYNC_PUSH,
          success: false,
          createdAt: { gte: oneHourAgo },
        },
      }),
    ]);

    return {
      totalDevices,
      activeDevices,
      offlineDevices,
      syncEventsToday,
      pendingEvents,
      recentSyncFailures,
      syncHealthPercent: totalDevices > 0 
        ? Math.round((activeDevices / totalDevices) * 100) 
        : 100,
    };
  }

  /**
   * Stock-related KPIs
   */
  private async getStockKpis() {
    // MP stock
    const mpProducts = await this.prisma.productMp.findMany({
      include: { lots: { select: { quantityRemaining: true } } },
    });

    const totalMpProducts = mpProducts.length;
    let lowStockMp = 0;
    let totalMpQuantity = 0;

    for (const product of mpProducts) {
      const qty = product.lots.reduce((sum, l) => sum + l.quantityRemaining, 0);
      totalMpQuantity += qty;
      if (qty <= product.minStock) lowStockMp++;
    }

    // PF stock
    const pfProducts = await this.prisma.productPf.findMany({
      include: { lots: { select: { quantityRemaining: true } } },
    });

    const totalPfProducts = pfProducts.length;
    let lowStockPf = 0;
    let totalPfQuantity = 0;

    for (const product of pfProducts) {
      const qty = product.lots.reduce((sum, l) => sum + l.quantityRemaining, 0);
      totalPfQuantity += qty;
      if (qty <= product.minStock) lowStockPf++;
    }

    // Expiring stock (next 7 days)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const expiringLots = await this.prisma.lotPf.count({
      where: {
        quantityRemaining: { gt: 0 },
        expiryDate: { lte: sevenDaysFromNow },
      },
    });

    return {
      totalMpProducts,
      totalPfProducts,
      totalMpQuantity,
      totalPfQuantity,
      lowStockMp,
      lowStockPf,
      expiringLots,
      stockHealthPercent: (totalMpProducts + totalPfProducts) > 0
        ? Math.round(100 - ((lowStockMp + lowStockPf) / (totalMpProducts + totalPfProducts)) * 100)
        : 100,
    };
  }

  /**
   * Fiscal-related KPIs
   */
  private async getFiscalKpis() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Today's invoices
    const todayInvoices = await this.prisma.invoice.findMany({
      where: { createdAt: { gte: today, lt: tomorrow } },
      select: {
        totalHt: true,
        totalTva: true,
        totalTtc: true,
        timbreFiscal: true,
        paymentMethod: true,
      },
    });

    let todaySalesHt = 0;
    let todaySalesTtc = 0;
    let todayTva = 0;
    let todayTimbre = 0;
    let todayCashSales = 0;
    const todayInvoiceCount = todayInvoices.length;

    for (const inv of todayInvoices) {
      todaySalesHt += inv.totalHt;
      todaySalesTtc += inv.totalTtc;
      todayTva += inv.totalTva;
      todayTimbre += inv.timbreFiscal;
      if (inv.paymentMethod === 'ESPECES') {
        todayCashSales += inv.totalTtc;
      }
    }

    // Month totals
    const monthInvoices = await this.prisma.invoice.aggregate({
      where: { createdAt: { gte: thisMonthStart } },
      _sum: { totalHt: true, totalTva: true, totalTtc: true, timbreFiscal: true },
      _count: true,
    });

    // Cash invoices without stamp duty (potential issue)
    const cashWithoutStamp = await this.prisma.invoice.count({
      where: {
        paymentMethod: 'ESPECES',
        timbreFiscal: 0,
        totalTtc: { gt: 0 },
      },
    });

    return {
      todayInvoiceCount,
      todaySalesHt: todaySalesHt / 100, // Convert centimes to DA
      todaySalesTtc: todaySalesTtc / 100,
      todayTva: todayTva / 100,
      todayTimbre: todayTimbre / 100,
      todayCashSales: todayCashSales / 100,
      cashPercent: todaySalesTtc > 0 
        ? Math.round((todayCashSales / todaySalesTtc) * 100) 
        : 0,
      monthInvoiceCount: monthInvoices._count,
      monthSalesHt: (monthInvoices._sum.totalHt || 0) / 100,
      monthTva: (monthInvoices._sum.totalTva || 0) / 100,
      cashWithoutStamp,
    };
  }

  /**
   * Security-related KPIs
   */
  private async getSecurityKpis() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      activeUsers,
      blockedUsers,
      revokedDevices,
      accessDeniedToday,
      failedLoginsToday,
      successfulLoginsToday,
      accessDeniedLastHour,
      failedLoginsLastHour,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.device.count({ where: { isActive: false } }),
      this.prisma.securityLog.count({
        where: { action: SecurityAction.ACCESS_DENIED, createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.securityLog.count({
        where: { action: SecurityAction.LOGIN_FAILURE, createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.securityLog.count({
        where: { action: SecurityAction.LOGIN_SUCCESS, createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.securityLog.count({
        where: { action: SecurityAction.ACCESS_DENIED, createdAt: { gte: oneHourAgo } },
      }),
      this.prisma.securityLog.count({
        where: { action: SecurityAction.LOGIN_FAILURE, createdAt: { gte: oneHourAgo } },
      }),
    ]);

    return {
      activeUsers,
      blockedUsers,
      revokedDevices,
      accessDeniedToday,
      failedLoginsToday,
      successfulLoginsToday,
      accessDeniedLastHour,
      failedLoginsLastHour,
      securityHealthPercent: accessDeniedLastHour > 5 || failedLoginsLastHour > 10 
        ? 50 
        : 100,
    };
  }
}
