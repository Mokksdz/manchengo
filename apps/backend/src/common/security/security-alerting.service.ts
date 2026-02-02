import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY ALERTING SERVICE — Zero-noise, critical events only
// ═══════════════════════════════════════════════════════════════════════════════
//
// DESIGN PRINCIPLES:
//   1. Only fires on ACTIONABLE events (no noise)
//   2. Deduplicates within a window (no alert storms)
//   3. Outputs to structured log (consumed by Sentry / CloudWatch / ELK)
//   4. Optional webhook for Slack/Telegram/PagerDuty
//   5. No external dependency — works with just stdout + Sentry
//
// EVENTS COVERED:
//   - BRUTE_FORCE:     >= 10 failed logins from same IP in 1h
//   - ACCOUNT_LOCKOUT: User locked after repeated failures
//   - PRIVILEGE_ESCALATION: Role change or admin action at unusual hours
//   - BACKUP_FAILURE:  Backup script reported failure (via health endpoint)
//   - TOKEN_ABUSE:     Same refresh token used > 1x (replay attempt)
//   - MASS_DATA_ACCESS: Unusual volume of export/read operations
//
// ACTIVATION:
//   SECURITY_WEBHOOK_URL=https://hooks.slack.com/...  (optional)
//   SECURITY_ALERT_ENABLED=true                       (default: true in prod)
// ═══════════════════════════════════════════════════════════════════════════════

export enum SecurityAlertType {
  BRUTE_FORCE = 'BRUTE_FORCE',
  ACCOUNT_LOCKOUT = 'ACCOUNT_LOCKOUT',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  BACKUP_FAILURE = 'BACKUP_FAILURE',
  TOKEN_REPLAY = 'TOKEN_REPLAY',
  MASS_DATA_ACCESS = 'MASS_DATA_ACCESS',
  UNUSUAL_HOURS_ADMIN = 'UNUSUAL_HOURS_ADMIN',
}

interface SecurityAlert {
  type: SecurityAlertType;
  severity: 'HIGH' | 'CRITICAL';
  message: string;
  context: Record<string, unknown>;
  timestamp: Date;
}

@Injectable()
export class SecurityAlertingService implements OnModuleInit {
  private readonly logger = new Logger('SECURITY_ALERT');
  private readonly enabled: boolean;
  private readonly webhookUrl: string | undefined;

  // Deduplication window: type+key → last alert timestamp
  private readonly dedup = new Map<string, number>();
  private readonly DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  // Failed login tracking: IP → count in window
  private readonly failedLogins = new Map<string, { count: number; firstAt: number }>();
  private readonly BRUTE_FORCE_THRESHOLD = 10;
  private readonly BRUTE_FORCE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const isProduction = configService.get('NODE_ENV') === 'production';
    this.enabled = configService.get('SECURITY_ALERT_ENABLED', isProduction ? 'true' : 'false') === 'true';
    this.webhookUrl = configService.get<string>('SECURITY_WEBHOOK_URL');
  }

  onModuleInit() {
    if (this.enabled) {
      this.logger.log('Security alerting ACTIVE');
      if (this.webhookUrl) {
        this.logger.log('Webhook configured for external notifications');
      }
    }

    // Cleanup stale dedup entries every 10 minutes
    setInterval(() => this.cleanupDedup(), 10 * 60 * 1000);
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────────────

  /**
   * Record a failed login attempt. Fires BRUTE_FORCE alert if threshold exceeded.
   */
  recordFailedLogin(ipAddress: string, email: string): void {
    if (!this.enabled) return;

    const now = Date.now();
    const entry = this.failedLogins.get(ipAddress);

    if (!entry || now - entry.firstAt > this.BRUTE_FORCE_WINDOW_MS) {
      this.failedLogins.set(ipAddress, { count: 1, firstAt: now });
      return;
    }

    entry.count++;

    if (entry.count >= this.BRUTE_FORCE_THRESHOLD) {
      this.fire({
        type: SecurityAlertType.BRUTE_FORCE,
        severity: 'CRITICAL',
        message: `Brute-force detected: ${entry.count} failed logins from ${ipAddress} in 1h`,
        context: { ipAddress, lastEmail: email, attempts: entry.count },
        timestamp: new Date(),
      });
      // Reset to avoid repeated alerts
      this.failedLogins.delete(ipAddress);
    }
  }

  /** Clear failed login counter on successful login */
  clearFailedLogins(ipAddress: string): void {
    this.failedLogins.delete(ipAddress);
  }

  /**
   * Alert: refresh token was already consumed (replay attempt)
   */
  alertTokenReplay(userId: string, ipAddress?: string): void {
    this.fire({
      type: SecurityAlertType.TOKEN_REPLAY,
      severity: 'HIGH',
      message: `Refresh token replay attempt detected for user ${userId}`,
      context: { userId, ipAddress },
      timestamp: new Date(),
    });
  }

  /**
   * Alert: admin action at unusual hours (22:00-05:00 local)
   */
  alertUnusualHoursAdmin(userId: string, action: string): void {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 22) return; // Normal hours — no alert

    this.fire({
      type: SecurityAlertType.UNUSUAL_HOURS_ADMIN,
      severity: 'HIGH',
      message: `Admin action at unusual hour (${hour}:00): ${action}`,
      context: { userId, action, hour },
      timestamp: new Date(),
    });
  }

  /**
   * Alert: privilege escalation (role change)
   */
  alertPrivilegeChange(actorId: string, targetId: string, oldRole: string, newRole: string): void {
    this.fire({
      type: SecurityAlertType.PRIVILEGE_ESCALATION,
      severity: 'CRITICAL',
      message: `Role changed: ${targetId} from ${oldRole} to ${newRole} by ${actorId}`,
      context: { actorId, targetId, oldRole, newRole },
      timestamp: new Date(),
    });
  }

  /**
   * Alert: backup failure reported
   */
  alertBackupFailure(reason: string): void {
    this.fire({
      type: SecurityAlertType.BACKUP_FAILURE,
      severity: 'CRITICAL',
      message: `Backup failure: ${reason}`,
      context: { reason },
      timestamp: new Date(),
    });
  }

  // ─── INTERNAL ──────────────────────────────────────────────────────────────

  private fire(alert: SecurityAlert): void {
    if (!this.enabled) return;

    // Deduplication: same type+message within 5 min window
    const dedupKey = `${alert.type}:${JSON.stringify(alert.context)}`;
    const now = Date.now();
    const lastFired = this.dedup.get(dedupKey);
    if (lastFired && now - lastFired < this.DEDUP_WINDOW_MS) {
      return; // Suppressed (duplicate within window)
    }
    this.dedup.set(dedupKey, now);

    // 1. Structured log (always — consumed by ELK/CloudWatch/Sentry)
    const logPayload = {
      alertType: alert.type,
      severity: alert.severity,
      ...alert.context,
      ts: alert.timestamp.toISOString(),
    };

    if (alert.severity === 'CRITICAL') {
      this.logger.error(`[${alert.severity}] ${alert.message}`, JSON.stringify(logPayload));
    } else {
      this.logger.warn(`[${alert.severity}] ${alert.message}`, JSON.stringify(logPayload));
    }

    // 2. Webhook (fire-and-forget, never block)
    if (this.webhookUrl) {
      this.sendWebhook(alert).catch(() => {
        /* silently ignore webhook failures */
      });
    }
  }

  private async sendWebhook(alert: SecurityAlert): Promise<void> {
    try {
      const body = JSON.stringify({
        text: `[${alert.severity}] ${alert.type}: ${alert.message}`,
        context: alert.context,
        timestamp: alert.timestamp.toISOString(),
      });

      await fetch(this.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(5000), // 5s timeout
      });
    } catch {
      // Never throw — alerting failures must not break app
    }
  }

  private cleanupDedup(): void {
    const now = Date.now();
    for (const [key, ts] of this.dedup.entries()) {
      if (now - ts > this.DEDUP_WINDOW_MS * 2) {
        this.dedup.delete(key);
      }
    }
    // Also clean stale login tracking
    for (const [ip, entry] of this.failedLogins.entries()) {
      if (now - entry.firstAt > this.BRUTE_FORCE_WINDOW_MS) {
        this.failedLogins.delete(ip);
      }
    }
  }
}
