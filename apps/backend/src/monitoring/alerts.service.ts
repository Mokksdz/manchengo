import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AlertType, AlertSeverity, AlertStatus, SecurityAction } from '@prisma/client';

/**
 * Alerts Service
 * 
 * Detects and manages operational alerts.
 * Runs scheduled checks and provides on-demand detection.
 * 
 * Alert Categories:
 * - Sync: Device offline, sync failures, pending events
 * - Stock: Low MP/PF, expiring stock
 * - Fiscal: High cash sales, missing stamp duty
 * - Security: Access denied spikes, failed login spikes
 * 
 * Alerts are read-only signals - no business logic modification.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  // Thresholds for alert detection
  private readonly THRESHOLDS = {
    deviceOfflineHours: 24,
    pendingEventsWarning: 50,
    pendingEventsCritical: 200,
    cashSalesPercentWarning: 80,
    accessDeniedSpikePerHour: 10,
    failedLoginSpikePerHour: 15,
    stockExpiryDays: 7,
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Scheduled job: Run all alert checks every 15 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async runScheduledChecks() {
    this.logger.log('Running scheduled alert checks...');
    
    await Promise.all([
      this.checkDeviceOffline(),
      this.checkPendingEvents(),
      this.checkLowStock(),
      this.checkSecuritySpikes(),
      this.checkFiscalIssues(),
      this.autoCloseExpiredAlerts(),
    ]);

    this.logger.log('Alert checks completed');
  }

  /**
   * Get all alerts with filtering
   */
  async getAlerts(params: {
    status?: AlertStatus;
    type?: AlertType;
    severity?: AlertSeverity;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;
    if (params.severity) where.severity = params.severity;

    const [alerts, total, openCount, criticalCount] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        orderBy: [
          { status: 'asc' },
          { severity: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          history: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.alert.count({ where }),
      this.prisma.alert.count({ where: { status: AlertStatus.OPEN } }),
      this.prisma.alert.count({ 
        where: { status: AlertStatus.OPEN, severity: AlertSeverity.CRITICAL } 
      }),
    ]);

    return { alerts, total, openCount, criticalCount };
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string, note?: string) {
    const alert = await this.prisma.alert.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        ackedBy: userId,
        ackedAt: new Date(),
      },
    });

    await this.prisma.alertHistory.create({
      data: {
        alertId,
        action: 'ACKNOWLEDGED',
        userId,
        note,
      },
    });

    return alert;
  }

  /**
   * Close an alert
   */
  async closeAlert(alertId: string, userId: string, note?: string) {
    const alert = await this.prisma.alert.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.CLOSED,
        closedBy: userId,
        closedAt: new Date(),
      },
    });

    await this.prisma.alertHistory.create({
      data: {
        alertId,
        action: 'CLOSED',
        userId,
        note,
      },
    });

    return alert;
  }

  /**
   * Create a new alert (if not already exists for same entity)
   */
  private async createAlert(params: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
    threshold?: number;
    value?: number;
    expiresAt?: Date;
  }) {
    // Check if similar open alert exists
    const existing = await this.prisma.alert.findFirst({
      where: {
        type: params.type,
        entityType: params.entityType,
        entityId: params.entityId,
        status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
      },
    });

    if (existing) {
      // Update existing alert with new value
      return this.prisma.alert.update({
        where: { id: existing.id },
        data: {
          value: params.value,
          metadata: params.metadata,
        },
      });
    }

    // Create new alert
    const alert = await this.prisma.alert.create({
      data: {
        type: params.type,
        severity: params.severity,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata,
        threshold: params.threshold,
        value: params.value,
        expiresAt: params.expiresAt,
      },
    });

    await this.prisma.alertHistory.create({
      data: {
        alertId: alert.id,
        action: 'CREATED',
      },
    });

    return alert;
  }

  /**
   * Check for offline devices
   */
  private async checkDeviceOffline() {
    const threshold = new Date(
      Date.now() - this.THRESHOLDS.deviceOfflineHours * 60 * 60 * 1000
    );

    const offlineDevices = await this.prisma.device.findMany({
      where: {
        isActive: true,
        OR: [
          { lastSyncAt: null },
          { lastSyncAt: { lt: threshold } },
        ],
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    for (const device of offlineDevices) {
      await this.createAlert({
        type: AlertType.DEVICE_OFFLINE,
        severity: AlertSeverity.WARNING,
        title: `Appareil hors ligne: ${device.name}`,
        message: `L'appareil ${device.name} (${device.user.firstName} ${device.user.lastName}) n'a pas synchronisé depuis plus de ${this.THRESHOLDS.deviceOfflineHours}h`,
        entityType: 'DEVICE',
        entityId: device.id,
        metadata: { userName: `${device.user.firstName} ${device.user.lastName}` },
        threshold: this.THRESHOLDS.deviceOfflineHours,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Auto-expire in 24h
      });
    }
  }

  /**
   * Check for pending sync events
   */
  private async checkPendingEvents() {
    const pendingCount = await this.prisma.syncEvent.count({
      where: { appliedAt: null },
    });

    if (pendingCount >= this.THRESHOLDS.pendingEventsCritical) {
      await this.createAlert({
        type: AlertType.PENDING_EVENTS,
        severity: AlertSeverity.CRITICAL,
        title: 'Événements en attente critiques',
        message: `${pendingCount} événements en attente de traitement`,
        threshold: this.THRESHOLDS.pendingEventsCritical,
        value: pendingCount,
      });
    } else if (pendingCount >= this.THRESHOLDS.pendingEventsWarning) {
      await this.createAlert({
        type: AlertType.PENDING_EVENTS,
        severity: AlertSeverity.WARNING,
        title: 'Événements en attente',
        message: `${pendingCount} événements en attente de traitement`,
        threshold: this.THRESHOLDS.pendingEventsWarning,
        value: pendingCount,
      });
    }
  }

  /**
   * Check for low stock
   */
  private async checkLowStock() {
    // Check MP
    const mpProducts = await this.prisma.productMp.findMany({
      include: { lots: { select: { quantityRemaining: true } } },
    });

    for (const product of mpProducts) {
      const qty = product.lots.reduce((sum, l) => sum + l.quantityRemaining, 0);
      if (qty <= product.minStock) {
        await this.createAlert({
          type: AlertType.LOW_STOCK_MP,
          severity: qty === 0 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          title: `Stock MP bas: ${product.name}`,
          message: `Stock actuel: ${qty} ${product.unit} (min: ${product.minStock})`,
          entityType: 'PRODUCT_MP',
          entityId: String(product.id),
          threshold: product.minStock,
          value: qty,
        });
      }
    }

    // Check PF
    const pfProducts = await this.prisma.productPf.findMany({
      include: { lots: { select: { quantityRemaining: true } } },
    });

    for (const product of pfProducts) {
      const qty = product.lots.reduce((sum, l) => sum + l.quantityRemaining, 0);
      if (qty <= product.minStock) {
        await this.createAlert({
          type: AlertType.LOW_STOCK_PF,
          severity: qty === 0 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          title: `Stock PF bas: ${product.name}`,
          message: `Stock actuel: ${qty} ${product.unit} (min: ${product.minStock})`,
          entityType: 'PRODUCT_PF',
          entityId: String(product.id),
          threshold: product.minStock,
          value: qty,
        });
      }
    }
  }

  /**
   * Check for security spikes
   */
  private async checkSecuritySpikes() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Access denied spike
    const accessDeniedCount = await this.prisma.securityLog.count({
      where: {
        action: SecurityAction.ACCESS_DENIED,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (accessDeniedCount >= this.THRESHOLDS.accessDeniedSpikePerHour) {
      await this.createAlert({
        type: AlertType.ACCESS_DENIED_SPIKE,
        severity: AlertSeverity.CRITICAL,
        title: 'Pic d\'accès refusés',
        message: `${accessDeniedCount} accès refusés dans la dernière heure`,
        threshold: this.THRESHOLDS.accessDeniedSpikePerHour,
        value: accessDeniedCount,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h expiry
      });
    }

    // Failed login spike
    const failedLoginCount = await this.prisma.securityLog.count({
      where: {
        action: SecurityAction.LOGIN_FAILURE,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (failedLoginCount >= this.THRESHOLDS.failedLoginSpikePerHour) {
      await this.createAlert({
        type: AlertType.FAILED_LOGIN_SPIKE,
        severity: AlertSeverity.CRITICAL,
        title: 'Pic d\'échecs de connexion',
        message: `${failedLoginCount} échecs de connexion dans la dernière heure`,
        threshold: this.THRESHOLDS.failedLoginSpikePerHour,
        value: failedLoginCount,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });
    }
  }

  /**
   * Check for fiscal issues
   */
  private async checkFiscalIssues() {
    // Check for cash invoices without stamp duty
    const cashWithoutStamp = await this.prisma.invoice.findMany({
      where: {
        paymentMethod: 'ESPECES',
        timbreFiscal: 0,
        totalTtc: { gt: 0 },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true, reference: true, totalTtc: true },
    });

    for (const invoice of cashWithoutStamp) {
      await this.createAlert({
        type: AlertType.MISSING_STAMP_DUTY,
        severity: AlertSeverity.WARNING,
        title: `Timbre manquant: ${invoice.reference}`,
        message: `Facture espèces ${invoice.reference} sans timbre fiscal`,
        entityType: 'INVOICE',
        entityId: String(invoice.id),
        metadata: { reference: invoice.reference, amount: invoice.totalTtc / 100 },
      });
    }

    // Check high cash sales percentage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayInvoices = await this.prisma.invoice.findMany({
      where: { createdAt: { gte: today } },
      select: { totalTtc: true, paymentMethod: true },
    });

    let totalSales = 0;
    let cashSales = 0;
    for (const inv of todayInvoices) {
      totalSales += inv.totalTtc;
      if (inv.paymentMethod === 'ESPECES') cashSales += inv.totalTtc;
    }

    const cashPercent = totalSales > 0 ? (cashSales / totalSales) * 100 : 0;
    if (cashPercent >= this.THRESHOLDS.cashSalesPercentWarning && totalSales > 1000000) {
      // Only alert if significant volume (>10,000 DA)
      await this.createAlert({
        type: AlertType.HIGH_CASH_SALES,
        severity: AlertSeverity.INFO,
        title: 'Volume espèces élevé',
        message: `${Math.round(cashPercent)}% des ventes en espèces aujourd'hui`,
        threshold: this.THRESHOLDS.cashSalesPercentWarning,
        value: cashPercent,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }
  }

  /**
   * Auto-close expired alerts
   */
  private async autoCloseExpiredAlerts() {
    const expired = await this.prisma.alert.updateMany({
      where: {
        status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
        expiresAt: { lt: new Date() },
      },
      data: {
        status: AlertStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    if (expired.count > 0) {
      this.logger.log(`Auto-closed ${expired.count} expired alerts`);
    }
  }
}
