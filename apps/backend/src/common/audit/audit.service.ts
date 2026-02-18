import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction, AuditSeverity, UserRole, Prisma } from '@prisma/client';
import { LoggerService } from '../logger';
import * as crypto from 'crypto';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AUDIT SERVICE - Forensic-grade audit logging for ERP operations
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Create immutable audit trail for all critical business operations
 * 
 * DESIGN PRINCIPLES:
 *   1. APPEND-ONLY: No updates, no deletes (enforced at service level)
 *   2. SELF-CONTAINED: Each log entry has all context needed for investigation
 *   3. FAIL-SAFE: Audit failures should never block business operations
 *   4. EXPLICIT: Log what matters, not everything
 * 
 * AUDIT VALUE FOR ERP:
 *   - Legal proof of who did what and when
 *   - Investigation of discrepancies (stock, financial)
 *   - Compliance with regulatory requirements
 *   - Fraud detection and prevention
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export interface AuditContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditActor {
  id: string;
  role: UserRole;
  email?: string;
}

export interface AuditLogEntry {
  actor: AuditActor;
  action: AuditAction;
  severity?: AuditSeverity;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  context?: AuditContext;
}

@Injectable()
export class AuditService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('AuditService');
  }

  /**
   * Log a business action to the audit trail
   * 
   * CRITICAL: This method should NEVER throw.
   * Audit failures must not block business operations.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const now = new Date();

      // Serialize hash chain writes to prevent race conditions
      await this.prisma.$executeRaw`SELECT pg_advisory_xact_lock(42)`;

      // P1.1-F: Hash chain — retrieve previous hash for immutability chain
      const lastLog = await this.prisma.auditLog.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { hash: true },
      });
      const previousHash = lastLog?.hash || 'GENESIS';

      // Compute hash of this entry (includes previousHash for chain integrity)
      const hashPayload = JSON.stringify({
        previousHash,
        actorId: entry.actor.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: String(entry.entityId),
        timestamp: now.toISOString(),
      });
      const hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

      await this.prisma.auditLog.create({
        data: {
          // WHO
          actorId: entry.actor.id,
          actorRole: entry.actor.role,
          actorEmail: entry.actor.email,

          // WHAT
          action: entry.action,
          severity: entry.severity || AuditSeverity.INFO,

          // ON WHAT
          entityType: entry.entityType,
          entityId: String(entry.entityId),

          // CONTEXT
          requestId: entry.context?.requestId,
          ipAddress: entry.context?.ipAddress,
          userAgent: entry.context?.userAgent,

          // STATE CAPTURE
          beforeState: entry.beforeState as Prisma.InputJsonValue,
          afterState: entry.afterState as Prisma.InputJsonValue,
          metadata: entry.metadata as Prisma.InputJsonValue,

          // TIMESTAMP (consistent with hash)
          timestamp: now,

          // HASH CHAIN (P1.1-F: non-falsifiable)
          hash,
          previousHash,
        },
      });

      // Also log to structured logger for real-time monitoring
      this.logger.info(`AUDIT: ${entry.action} on ${entry.entityType}:${entry.entityId}`, 'AuditService', {
        actorId: entry.actor.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        requestId: entry.context?.requestId,
      });
    } catch (error) {
      // CRITICAL: Never throw, only log the failure
      this.logger.error(
        `Failed to write audit log: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
        'AuditService',
      );
    }
  }

  /**
   * Log a security event (access denied, role violation, etc.)
   */
  async logSecurityEvent(
    actor: AuditActor,
    action: AuditAction,
    details: {
      entityType: string;
      entityId: string;
      reason: string;
      attemptedAction?: string;
    },
    context?: AuditContext,
  ): Promise<void> {
    await this.log({
      actor,
      action,
      severity: AuditSeverity.SECURITY,
      entityType: details.entityType,
      entityId: details.entityId,
      metadata: {
        reason: details.reason,
        attemptedAction: details.attemptedAction,
      },
      context,
    });
  }

  /**
   * Log a role violation (user attempted action not allowed for their role)
   */
  async logRoleViolation(
    actor: AuditActor,
    attemptedAction: string,
    requiredRoles: UserRole[],
    context?: AuditContext,
  ): Promise<void> {
    await this.logSecurityEvent(
      actor,
      AuditAction.ROLE_VIOLATION,
      {
        entityType: 'Authorization',
        entityId: attemptedAction,
        reason: `Role ${actor.role} attempted ${attemptedAction}. Required: ${requiredRoles.join(', ')}`,
        attemptedAction,
      },
      context,
    );
  }

  /**
   * Log an access denied event
   */
  async logAccessDenied(
    actor: AuditActor,
    resource: string,
    reason: string,
    context?: AuditContext,
  ): Promise<void> {
    await this.logSecurityEvent(
      actor,
      AuditAction.ACCESS_DENIED,
      {
        entityType: 'Resource',
        entityId: resource,
        reason,
      },
      context,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY METHODS (for admin investigation)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Query audit logs with filters
   * For admin investigation endpoint
   */
  async query(filters: {
    actorId?: string;
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    severity?: AuditSeverity;
    requestId?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100); // Cap at 100

    const where: Prisma.AuditLogWhereInput = {};

    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.severity) where.severity = filters.severity;
    if (filters.requestId) where.requestId = filters.requestId;

    if (filters.from || filters.to) {
      where.timestamp = {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: filters.to }),
      };
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      logs,
    };
  }

  /**
   * Get all audit logs for a specific entity (for entity history)
   */
  async getEntityHistory(entityType: string, entityId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId: String(entityId) },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all audit logs for a specific request (for correlation)
   */
  async getByRequestId(requestId: string) {
    return this.prisma.auditLog.findMany({
      where: { requestId },
      orderBy: { timestamp: 'asc' },
    });
  }

  /**
   * Get security events for monitoring
   */
  async getSecurityEvents(hours = 24, limit = 100) {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return this.prisma.auditLog.findMany({
      where: {
        severity: AuditSeverity.SECURITY,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
