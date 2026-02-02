import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit';
import { LoggerService } from '../common/logger';
import { AuditAction, AuditSeverity, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SECURITY HARDENING SERVICE - Anomaly detection & emergency controls
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Detect and respond to security threats and anomalies
 * 
 * CAPABILITIES:
 *   1. Brute-force detection (login attempts)
 *   2. Anomaly detection (unusual patterns)
 *   3. Rate limiting for sensitive operations
 *   4. Emergency read-only mode
 *   5. Security alert thresholds
 * 
 * DEPLOYMENT CONTEXT:
 *   - Factory ERP with multiple shifts
 *   - Assume shared terminals, stress, fatigue
 *   - False positives must not block production
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY THRESHOLDS - Configurable limits
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecurityThresholds {
  // Login security
  maxLoginAttemptsPerHour: number;
  lockoutDurationMinutes: number;
  
  // Rate limiting
  maxAdminActionsPerMinute: number;
  maxStockMovementsPerMinute: number;
  maxBulkOperationsPerHour: number;
  
  // Anomaly detection
  unusualHoursStart: number; // 22:00
  unusualHoursEnd: number;   // 05:00
  maxValueChangePercent: number; // Flag if stock changes > X%
  
  // Alert thresholds
  securityEventsAlertThreshold: number; // Alert after N security events
  failedLoginsAlertThreshold: number;
}

export const DEFAULT_THRESHOLDS: SecurityThresholds = {
  maxLoginAttemptsPerHour: 10,
  lockoutDurationMinutes: 30,
  maxAdminActionsPerMinute: 20,
  maxStockMovementsPerMinute: 50,
  maxBulkOperationsPerHour: 5,
  unusualHoursStart: 22,
  unusualHoursEnd: 5,
  maxValueChangePercent: 50,
  securityEventsAlertThreshold: 5,
  failedLoginsAlertThreshold: 3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMERGENCY MODE
// ═══════════════════════════════════════════════════════════════════════════════

export enum EmergencyMode {
  NORMAL = 'NORMAL',
  READ_ONLY = 'READ_ONLY',      // No writes allowed
  LOCKDOWN = 'LOCKDOWN',        // Only admins can access
  MAINTENANCE = 'MAINTENANCE',  // Scheduled maintenance
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class SecurityHardeningService {
  private thresholds: SecurityThresholds;
  private emergencyMode: EmergencyMode = EmergencyMode.NORMAL;
  private emergencyModeReason: string | null = null;
  private emergencyModeSetBy: string | null = null;
  private emergencyModeSetAt: Date | null = null;
  
  // In-memory rate limiting (would use Redis in production)
  private loginAttempts = new Map<string, RateLimitEntry>();
  private adminActions = new Map<string, RateLimitEntry>();
  private stockMovements = new Map<string, RateLimitEntry>();
  private lockedUsers = new Map<string, Date>();

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private logger: LoggerService,
    private configService: ConfigService,
  ) {
    this.logger.setContext('SecurityHardeningService');
    this.thresholds = this.loadThresholds();
  }

  private loadThresholds(): SecurityThresholds {
    // Load from config or use defaults
    return {
      ...DEFAULT_THRESHOLDS,
      maxLoginAttemptsPerHour: this.configService.get('SECURITY_MAX_LOGIN_ATTEMPTS', 10),
      lockoutDurationMinutes: this.configService.get('SECURITY_LOCKOUT_MINUTES', 30),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMERGENCY MODE CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  getEmergencyMode(): {
    mode: EmergencyMode;
    reason: string | null;
    setBy: string | null;
    setAt: Date | null;
  } {
    return {
      mode: this.emergencyMode,
      reason: this.emergencyModeReason,
      setBy: this.emergencyModeSetBy,
      setAt: this.emergencyModeSetAt,
    };
  }

  async setEmergencyMode(
    mode: EmergencyMode,
    reason: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<void> {
    // Only ADMIN can set emergency mode
    if (actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN can set emergency mode');
    }

    const previousMode = this.emergencyMode;
    
    this.emergencyMode = mode;
    this.emergencyModeReason = reason;
    this.emergencyModeSetBy = actorId;
    this.emergencyModeSetAt = new Date();

    await this.auditService.log({
      actor: { id: actorId, role: actorRole },
      action: AuditAction.MANUAL_OVERRIDE,
      severity: AuditSeverity.CRITICAL,
      entityType: 'EmergencyMode',
      entityId: mode,
      beforeState: { mode: previousMode },
      afterState: { mode, reason },
      metadata: { reason },
    });

    this.logger.warn(
      `Emergency mode changed: ${previousMode} → ${mode}. Reason: ${reason}`,
      'SecurityHardeningService',
    );
  }

  isWriteAllowed(): boolean {
    return this.emergencyMode === EmergencyMode.NORMAL;
  }

  isAccessAllowed(userRole: UserRole): boolean {
    switch (this.emergencyMode) {
      case EmergencyMode.NORMAL:
        return true;
      case EmergencyMode.READ_ONLY:
        return true; // Read allowed for all
      case EmergencyMode.LOCKDOWN:
        return userRole === UserRole.ADMIN;
      case EmergencyMode.MAINTENANCE:
        return userRole === UserRole.ADMIN;
      default:
        return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BRUTE-FORCE DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  async recordLoginAttempt(
    identifier: string, // email or IP
    success: boolean,
    ipAddress?: string,
  ): Promise<{ blocked: boolean; remainingAttempts: number }> {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour

    // Check if user is locked
    const lockUntil = this.lockedUsers.get(identifier);
    if (lockUntil && lockUntil > new Date()) {
      return { blocked: true, remainingAttempts: 0 };
    }

    // Get or create rate limit entry
    let entry = this.loginAttempts.get(identifier);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now };
    }

    if (!success) {
      entry.count++;
      this.loginAttempts.set(identifier, entry);

      // Check if threshold exceeded
      if (entry.count >= this.thresholds.maxLoginAttemptsPerHour) {
        const lockUntil = new Date(now + this.thresholds.lockoutDurationMinutes * 60 * 1000);
        this.lockedUsers.set(identifier, lockUntil);

        await this.auditService.log({
          actor: { id: identifier, role: UserRole.COMMERCIAL }, // Default role for unknown
          action: AuditAction.AUTH_LOGIN_FAILED,
          severity: AuditSeverity.SECURITY,
          entityType: 'User',
          entityId: identifier,
          metadata: {
            reason: 'Too many failed attempts',
            lockedUntil: lockUntil.toISOString(),
            ipAddress,
          },
        });

        this.logger.warn(
          `User ${identifier} locked due to too many failed login attempts`,
          'SecurityHardeningService',
        );

        return { blocked: true, remainingAttempts: 0 };
      }
    } else {
      // Reset on successful login
      this.loginAttempts.delete(identifier);
      this.lockedUsers.delete(identifier);
    }

    const remaining = this.thresholds.maxLoginAttemptsPerHour - entry.count;
    return { blocked: false, remainingAttempts: Math.max(0, remaining) };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RATE LIMITING FOR SENSITIVE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async checkRateLimit(
    userId: string,
    operationType: 'admin' | 'stock' | 'bulk',
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const now = Date.now();
    let windowMs: number;
    let maxCount: number;
    let store: Map<string, RateLimitEntry>;

    switch (operationType) {
      case 'admin':
        windowMs = 60 * 1000; // 1 minute
        maxCount = this.thresholds.maxAdminActionsPerMinute;
        store = this.adminActions;
        break;
      case 'stock':
        windowMs = 60 * 1000;
        maxCount = this.thresholds.maxStockMovementsPerMinute;
        store = this.stockMovements;
        break;
      case 'bulk':
        windowMs = 60 * 60 * 1000; // 1 hour
        maxCount = this.thresholds.maxBulkOperationsPerHour;
        store = this.adminActions; // Reuse admin store
        break;
      default:
        return { allowed: true, retryAfterSeconds: 0 };
    }

    let entry = store.get(userId);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now };
    }

    if (entry.count >= maxCount) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      return { allowed: false, retryAfterSeconds: retryAfter };
    }

    entry.count++;
    store.set(userId, entry);

    return { allowed: true, retryAfterSeconds: 0 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANOMALY DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  isUnusualHours(): boolean {
    const hour = new Date().getHours();
    return hour >= this.thresholds.unusualHoursStart || 
           hour < this.thresholds.unusualHoursEnd;
  }

  async checkStockChangeAnomaly(
    productId: number,
    currentStock: number,
    proposedChange: number,
  ): Promise<{ isAnomaly: boolean; reason?: string }> {
    if (currentStock === 0) {
      return { isAnomaly: false };
    }

    const changePercent = Math.abs(proposedChange / currentStock) * 100;
    
    if (changePercent > this.thresholds.maxValueChangePercent) {
      return {
        isAnomaly: true,
        reason: `Stock change of ${changePercent.toFixed(1)}% exceeds threshold of ${this.thresholds.maxValueChangePercent}%`,
      };
    }

    return { isAnomaly: false };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY MONITORING
  // ═══════════════════════════════════════════════════════════════════════════

  async getSecurityStats(hours = 24): Promise<{
    failedLogins: number;
    securityEvents: number;
    lockedUsers: number;
    anomaliesDetected: number;
    emergencyMode: EmergencyMode;
  }> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const [securityLogs] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          severity: AuditSeverity.SECURITY,
          timestamp: { gte: since },
        },
      }),
    ]);

    const failedLogins = await this.prisma.auditLog.count({
      where: {
        action: AuditAction.AUTH_LOGIN_FAILED,
        timestamp: { gte: since },
      },
    });

    return {
      failedLogins,
      securityEvents: securityLogs,
      lockedUsers: this.lockedUsers.size,
      anomaliesDetected: 0, // Would track separately
      emergencyMode: this.emergencyMode,
    };
  }

  /**
   * Check if security alerts should be triggered
   */
  async shouldAlertSecurity(): Promise<{ alert: boolean; reasons: string[] }> {
    const stats = await this.getSecurityStats(1); // Last hour
    const reasons: string[] = [];

    if (stats.failedLogins >= this.thresholds.failedLoginsAlertThreshold) {
      reasons.push(`${stats.failedLogins} failed logins in last hour`);
    }

    if (stats.securityEvents >= this.thresholds.securityEventsAlertThreshold) {
      reasons.push(`${stats.securityEvents} security events in last hour`);
    }

    if (stats.lockedUsers > 0) {
      reasons.push(`${stats.lockedUsers} users currently locked`);
    }

    return {
      alert: reasons.length > 0,
      reasons,
    };
  }

  getThresholds(): SecurityThresholds {
    return { ...this.thresholds };
  }

  async updateThresholds(
    updates: Partial<SecurityThresholds>,
    actorId: string,
    actorRole: UserRole,
  ): Promise<void> {
    if (actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN can update security thresholds');
    }

    const before = { ...this.thresholds };
    this.thresholds = { ...this.thresholds, ...updates };

    await this.auditService.log({
      actor: { id: actorId, role: actorRole },
      action: AuditAction.MANUAL_OVERRIDE,
      severity: AuditSeverity.CRITICAL,
      entityType: 'SecurityThresholds',
      entityId: 'global',
      beforeState: before as unknown as Record<string, unknown>,
      afterState: this.thresholds as unknown as Record<string, unknown>,
    });
  }
}
