import { Injectable, ForbiddenException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit';
import { LoggerService } from '../common/logger';
import { AuditAction, AuditSeverity, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SECURITY HARDENING SERVICE - Anomaly detection & emergency controls
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Rate limiting backed by Redis for distributed deployments.
 * Falls back to in-memory Map when Redis is unavailable.
 */

export interface SecurityThresholds {
  maxLoginAttemptsPerHour: number;
  lockoutDurationMinutes: number;
  maxAdminActionsPerMinute: number;
  maxStockMovementsPerMinute: number;
  maxBulkOperationsPerHour: number;
  unusualHoursStart: number;
  unusualHoursEnd: number;
  maxValueChangePercent: number;
  securityEventsAlertThreshold: number;
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

export enum EmergencyMode {
  NORMAL = 'NORMAL',
  READ_ONLY = 'READ_ONLY',
  LOCKDOWN = 'LOCKDOWN',
  MAINTENANCE = 'MAINTENANCE',
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class SecurityHardeningService implements OnModuleInit, OnModuleDestroy {
  private thresholds: SecurityThresholds;
  private emergencyMode: EmergencyMode = EmergencyMode.NORMAL;
  private emergencyModeReason: string | null = null;
  private emergencyModeSetBy: string | null = null;
  private emergencyModeSetAt: Date | null = null;

  // Redis-backed rate limiting
  private redis: Redis | null = null;
  private useRedis = false;

  // In-memory fallback stores
  private loginAttempts = new Map<string, RateLimitEntry>();
  private adminActions = new Map<string, RateLimitEntry>();
  private stockMovements = new Map<string, RateLimitEntry>();
  private lockedUsers = new Map<string, Date>();

  // Periodic cleanup interval handle
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Maximum size for in-memory fallback maps
  private readonly MAX_MAP_SIZE = 10_000;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private logger: LoggerService,
    private configService: ConfigService,
  ) {
    this.logger.setContext('SecurityHardeningService');
    this.thresholds = this.loadThresholds();
  }

  async onModuleInit() {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    if (redisHost) {
      try {
        // Fast TCP probe to fail quickly when Redis is down
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const net = require('net');
        await new Promise<void>((resolve, reject) => {
          const sock = net.createConnection({ host: redisHost, port: redisPort, timeout: 2000 });
          sock.once('connect', () => { sock.destroy(); resolve(); });
          sock.once('timeout', () => { sock.destroy(); reject(new Error('Redis TCP timeout')); });
          sock.once('error', (err: Error) => { sock.destroy(); reject(err); });
        });

        this.redis = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          db: this.configService.get<number>('REDIS_DB', 0),
          keyPrefix: 'sec_rl:',
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          enableReadyCheck: true,
        });

        await this.redis.connect();
        this.useRedis = true;
        this.logger.log('Security rate limiter using Redis (distributed-safe)');
      } catch (err) {
        this.logger.warn(
          `Redis unavailable for security rate limiter, falling back to in-memory: ${err instanceof Error ? err.message : err}`,
        );
        this.redis = null;
        this.useRedis = false;
      }
    }

    // Periodic cleanup for in-memory stores (every 5 minutes)
    this.cleanupInterval = setInterval(() => this.cleanupExpiredEntries(), 300_000);
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // Ignore disconnect errors during shutdown
      }
    }
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.loginAttempts) {
      if (now - entry.windowStart > 3_600_000) this.loginAttempts.delete(key);
    }
    for (const [key, entry] of this.adminActions) {
      if (now - entry.windowStart > 3_600_000) this.adminActions.delete(key);
    }
    for (const [key, entry] of this.stockMovements) {
      if (now - entry.windowStart > 3_600_000) this.stockMovements.delete(key);
    }
    for (const [key, date] of this.lockedUsers) {
      if (date < new Date()) this.lockedUsers.delete(key);
    }

    // Cap map sizes to prevent unbounded growth
    this.evictOldestEntries(this.loginAttempts, this.MAX_MAP_SIZE);
    this.evictOldestEntries(this.adminActions, this.MAX_MAP_SIZE);
    this.evictOldestEntries(this.stockMovements, this.MAX_MAP_SIZE);
    this.evictOldestEntries(this.lockedUsers, this.MAX_MAP_SIZE);
  }

  private evictOldestEntries(map: Map<string, any>, maxSize: number): void {
    if (map.size <= maxSize) return;
    const entriesToRemove = map.size - maxSize;
    const iterator = map.keys();
    for (let i = 0; i < entriesToRemove; i++) {
      const key = iterator.next().value;
      if (key !== undefined) map.delete(key);
    }
  }

  private loadThresholds(): SecurityThresholds {
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
        return true;
      case EmergencyMode.LOCKDOWN:
        return userRole === UserRole.ADMIN;
      case EmergencyMode.MAINTENANCE:
        return userRole === UserRole.ADMIN;
      default:
        return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BRUTE-FORCE DETECTION (Redis-backed)
  // ═══════════════════════════════════════════════════════════════════════════

  async recordLoginAttempt(
    identifier: string,
    success: boolean,
    ipAddress?: string,
  ): Promise<{ blocked: boolean; remainingAttempts: number }> {
    if (this.useRedis && this.redis) {
      return this.recordLoginAttemptRedis(identifier, success, ipAddress);
    }
    return this.recordLoginAttemptMemory(identifier, success, ipAddress);
  }

  private async recordLoginAttemptRedis(
    identifier: string,
    success: boolean,
    ipAddress?: string,
  ): Promise<{ blocked: boolean; remainingAttempts: number }> {
    try {
      const lockKey = `lock:${identifier}`;
      const attemptKey = `login:${identifier}`;
      const windowSeconds = 3600; // 1 hour

      // Check if locked
      const lockTtl = await this.redis!.ttl(lockKey);
      if (lockTtl > 0) {
        return { blocked: true, remainingAttempts: 0 };
      }

      if (success) {
        await this.redis!.del(attemptKey);
        await this.redis!.del(lockKey);
        return { blocked: false, remainingAttempts: this.thresholds.maxLoginAttemptsPerHour };
      }

      const count = await this.redis!.incr(attemptKey);
      if (count === 1) {
        await this.redis!.expire(attemptKey, windowSeconds);
      }

      if (count >= this.thresholds.maxLoginAttemptsPerHour) {
        const lockSeconds = this.thresholds.lockoutDurationMinutes * 60;
        await this.redis!.setex(lockKey, lockSeconds, '1');

        await this.auditService.log({
          actor: { id: identifier, role: UserRole.COMMERCIAL },
          action: AuditAction.AUTH_LOGIN_FAILED,
          severity: AuditSeverity.SECURITY,
          entityType: 'User',
          entityId: identifier,
          metadata: {
            reason: 'Too many failed attempts',
            lockedForMinutes: this.thresholds.lockoutDurationMinutes,
            ipAddress,
          },
        });

        this.logger.warn(
          `User ${identifier} locked due to too many failed login attempts`,
          'SecurityHardeningService',
        );

        return { blocked: true, remainingAttempts: 0 };
      }

      return {
        blocked: false,
        remainingAttempts: Math.max(0, this.thresholds.maxLoginAttemptsPerHour - count),
      };
    } catch (err) {
      this.logger.warn(`Redis login tracking failed, using memory: ${err instanceof Error ? err.message : err}`);
      return this.recordLoginAttemptMemory(identifier, success, ipAddress);
    }
  }

  private async recordLoginAttemptMemory(
    identifier: string,
    success: boolean,
    ipAddress?: string,
  ): Promise<{ blocked: boolean; remainingAttempts: number }> {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;

    const lockUntil = this.lockedUsers.get(identifier);
    if (lockUntil && lockUntil > new Date()) {
      return { blocked: true, remainingAttempts: 0 };
    }

    let entry = this.loginAttempts.get(identifier);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now };
    }

    if (!success) {
      entry.count++;
      this.loginAttempts.set(identifier, entry);

      if (entry.count >= this.thresholds.maxLoginAttemptsPerHour) {
        const lockDate = new Date(now + this.thresholds.lockoutDurationMinutes * 60 * 1000);
        this.lockedUsers.set(identifier, lockDate);

        await this.auditService.log({
          actor: { id: identifier, role: UserRole.COMMERCIAL },
          action: AuditAction.AUTH_LOGIN_FAILED,
          severity: AuditSeverity.SECURITY,
          entityType: 'User',
          entityId: identifier,
          metadata: {
            reason: 'Too many failed attempts',
            lockedUntil: lockDate.toISOString(),
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
      this.loginAttempts.delete(identifier);
      this.lockedUsers.delete(identifier);
    }

    const remaining = this.thresholds.maxLoginAttemptsPerHour - (entry?.count || 0);
    return { blocked: false, remainingAttempts: Math.max(0, remaining) };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RATE LIMITING FOR SENSITIVE OPERATIONS (Redis-backed)
  // ═══════════════════════════════════════════════════════════════════════════

  async checkRateLimit(
    userId: string,
    operationType: 'admin' | 'stock' | 'bulk',
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    if (this.useRedis && this.redis) {
      return this.checkRateLimitRedis(userId, operationType);
    }
    return this.checkRateLimitMemory(userId, operationType);
  }

  private async checkRateLimitRedis(
    userId: string,
    operationType: 'admin' | 'stock' | 'bulk',
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    let windowSeconds: number;
    let maxCount: number;

    switch (operationType) {
      case 'admin':
        windowSeconds = 60;
        maxCount = this.thresholds.maxAdminActionsPerMinute;
        break;
      case 'stock':
        windowSeconds = 60;
        maxCount = this.thresholds.maxStockMovementsPerMinute;
        break;
      case 'bulk':
        windowSeconds = 3600;
        maxCount = this.thresholds.maxBulkOperationsPerHour;
        break;
      default:
        return { allowed: true, retryAfterSeconds: 0 };
    }

    try {
      const key = `op:${operationType}:${userId}`;
      const count = await this.redis!.incr(key);

      if (count === 1) {
        await this.redis!.expire(key, windowSeconds);
      }

      if (count > maxCount) {
        const ttl = await this.redis!.ttl(key);
        return { allowed: false, retryAfterSeconds: Math.max(ttl, 1) };
      }

      return { allowed: true, retryAfterSeconds: 0 };
    } catch (err) {
      this.logger.warn(`Redis rate limit check failed: ${err instanceof Error ? err.message : err}`);
      return this.checkRateLimitMemory(userId, operationType);
    }
  }

  private checkRateLimitMemory(
    userId: string,
    operationType: 'admin' | 'stock' | 'bulk',
  ): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    let windowMs: number;
    let maxCount: number;
    let store: Map<string, RateLimitEntry>;

    switch (operationType) {
      case 'admin':
        windowMs = 60 * 1000;
        maxCount = this.thresholds.maxAdminActionsPerMinute;
        store = this.adminActions;
        break;
      case 'stock':
        windowMs = 60 * 1000;
        maxCount = this.thresholds.maxStockMovementsPerMinute;
        store = this.stockMovements;
        break;
      case 'bulk':
        windowMs = 60 * 60 * 1000;
        maxCount = this.thresholds.maxBulkOperationsPerHour;
        store = this.adminActions;
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
      anomaliesDetected: 0,
      emergencyMode: this.emergencyMode,
    };
  }

  async shouldAlertSecurity(): Promise<{ alert: boolean; reasons: string[] }> {
    const stats = await this.getSecurityStats(1);
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
