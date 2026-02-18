import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit';
import { LoggerService } from '../common/logger';
import { AuditAction, AuditSeverity, UserRole } from '@prisma/client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DATA RETENTION SERVICE - Legal-compliant data lifecycle management
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Manage data retention according to legal and operational requirements
 * 
 * ALGERIAN COMPLIANCE:
 *   - Financial records: 10 years (Code de Commerce Art. 12)
 *   - Stock movements: 10 years (traçabilité fiscale)
 *   - Audit logs: 10 years (piste d'audit)
 *   - Security logs: 5 years
 *   - Session data: 1 year
 * 
 * SAFETY PRINCIPLES:
 *   1. Never delete without archiving first
 *   2. Require explicit admin action for purge
 *   3. Log all retention operations
 *   4. Provide legal export before purge
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export interface RetentionPolicy {
  entityType: string;
  retentionYears: number;
  archiveRequired: boolean;
  legalBasis: string;
  canAutoPurge: boolean;
}

export const RETENTION_POLICIES: RetentionPolicy[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL & FISCAL (10 years - Algerian law)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    entityType: 'Invoice',
    retentionYears: 10,
    archiveRequired: true,
    legalBasis: 'Code de Commerce Art. 12 - Conservation documents comptables',
    canAutoPurge: false, // Requires manual admin action
  },
  {
    entityType: 'Payment',
    retentionYears: 10,
    archiveRequired: true,
    legalBasis: 'Code de Commerce Art. 12',
    canAutoPurge: false,
  },
  {
    entityType: 'StockMovement',
    retentionYears: 10,
    archiveRequired: true,
    legalBasis: 'Traçabilité fiscale - Justification TVA',
    canAutoPurge: false,
  },
  {
    entityType: 'ProductionOrder',
    retentionYears: 10,
    archiveRequired: true,
    legalBasis: 'Traçabilité production - Normes agroalimentaires',
    canAutoPurge: false,
  },
  {
    entityType: 'ReceptionNote',
    retentionYears: 10,
    archiveRequired: true,
    legalBasis: 'Traçabilité approvisionnement',
    canAutoPurge: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT & SECURITY (5-10 years)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    entityType: 'AuditLog',
    retentionYears: 10,
    archiveRequired: true,
    legalBasis: 'Piste d\'audit - Conformité fiscale',
    canAutoPurge: false,
  },
  {
    entityType: 'SecurityLog',
    retentionYears: 5,
    archiveRequired: true,
    legalBasis: 'Sécurité informatique',
    canAutoPurge: true, // Can auto-purge after archive
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OPERATIONAL (2-5 years)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    entityType: 'Delivery',
    retentionYears: 5,
    archiveRequired: true,
    legalBasis: 'Traçabilité livraison',
    canAutoPurge: true,
  },
  {
    entityType: 'LotMp',
    retentionYears: 5,
    archiveRequired: true,
    legalBasis: 'Traçabilité matières premières - FIFO',
    canAutoPurge: true,
  },
  {
    entityType: 'LotPf',
    retentionYears: 5,
    archiveRequired: true,
    legalBasis: 'Traçabilité produits finis',
    canAutoPurge: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION & TEMPORARY (1 year)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    entityType: 'RefreshToken',
    retentionYears: 1,
    archiveRequired: false,
    legalBasis: 'Données de session',
    canAutoPurge: true,
  },
  {
    entityType: 'SyncEvent',
    retentionYears: 1,
    archiveRequired: false,
    legalBasis: 'Données de synchronisation',
    canAutoPurge: true,
  },
];

@Injectable()
export class RetentionService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('RetentionService');
  }

  /**
   * Get retention policy for an entity type
   */
  getPolicy(entityType: string): RetentionPolicy | undefined {
    return RETENTION_POLICIES.find(p => p.entityType === entityType);
  }

  /**
   * Get all retention policies
   */
  getAllPolicies(): RetentionPolicy[] {
    return RETENTION_POLICIES;
  }

  /**
   * Calculate retention status for all entity types
   */
  async getRetentionStatus(): Promise<Array<{
    entityType: string;
    policy: RetentionPolicy;
    totalRecords: number;
    eligibleForPurge: number;
    oldestRecord: Date | null;
  }>> {
    const results = [];

    for (const policy of RETENTION_POLICIES) {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - policy.retentionYears);

      const stats = await this.getEntityStats(policy.entityType, cutoffDate);
      
      results.push({
        entityType: policy.entityType,
        policy,
        ...stats,
      });
    }

    return results;
  }

  private async getEntityStats(entityType: string, cutoffDate: Date) {
    // Map entity types to Prisma models
    const modelMap: Record<string, string> = {
      'Invoice': 'invoice',
      'Payment': 'payment',
      'StockMovement': 'stockMovement',
      'ProductionOrder': 'productionOrder',
      'ReceptionNote': 'receptionNote',
      'AuditLog': 'auditLog',
      'SecurityLog': 'securityLog',
      'Delivery': 'delivery',
      'LotMp': 'lotMp',
      'LotPf': 'lotPf',
      'RefreshToken': 'refreshToken',
      'SyncEvent': 'syncEvent',
    };

    const model = modelMap[entityType];
    if (!model || !(this.prisma as any)[model]) {
      return { totalRecords: 0, eligibleForPurge: 0, oldestRecord: null };
    }

    try {
      const [total, eligible, oldest] = await Promise.all([
        (this.prisma as any)[model].count(),
        (this.prisma as any)[model].count({
          where: { createdAt: { lt: cutoffDate } },
        }),
        (this.prisma as any)[model].findFirst({
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
      ]);

      return {
        totalRecords: total,
        eligibleForPurge: eligible,
        oldestRecord: oldest?.createdAt || null,
      };
    } catch {
      return { totalRecords: 0, eligibleForPurge: 0, oldestRecord: null };
    }
  }

  /**
   * Schedule automatic purge for eligible entities (runs weekly)
   * Only purges entities with canAutoPurge = true AND after archiving
   */
  /**
   * Cleanup expired idempotency keys daily (prevents unbounded table growth)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupIdempotencyKeys(): Promise<void> {
    try {
      const result = await this.prisma.idempotencyKey.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        this.logger.info(
          `Cleaned up ${result.count} expired idempotency keys`,
          'RetentionService',
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup idempotency keys: ${error}`,
        error instanceof Error ? error.stack : undefined,
        'RetentionService',
      );
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async runScheduledPurge(): Promise<void> {
    this.logger.info('Starting scheduled retention purge', 'RetentionService');

    const autoPurgePolicies = RETENTION_POLICIES.filter(p => p.canAutoPurge);

    for (const policy of autoPurgePolicies) {
      try {
        await this.purgeEntity(policy.entityType, 'SYSTEM', UserRole.ADMIN);
      } catch (error) {
        this.logger.error(
          `Failed to purge ${policy.entityType}: ${error}`,
          error instanceof Error ? error.stack : undefined,
          'RetentionService',
        );
      }
    }
  }

  /**
   * Purge records older than retention period
   * SAFETY: Archives before purging, logs everything
   */
  async purgeEntity(
    entityType: string,
    actorId: string,
    actorRole: UserRole,
    dryRun = false,
  ): Promise<{ purged: number; archived: number; entityType?: string; error?: string }> {
    const policy = this.getPolicy(entityType);
    if (!policy) {
      throw new Error(`No retention policy for ${entityType}`);
    }

    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - policy.retentionYears);

    // Step 1: Archive if required (implementation would export to cold storage)
    let archived = 0;
    if (policy.archiveRequired && !dryRun) {
      archived = await this.archiveRecords(entityType, cutoffDate);
    }

    // Block purge if archive was required but returned 0 records
    if (policy.archiveRequired && archived === 0 && !dryRun) {
      this.logger.warn(
        `Purge bloquée: archivage obligatoire mais 0 enregistrements archivés pour ${entityType}`,
        'RetentionService',
      );
      return { entityType, archived: 0, purged: 0, error: 'Archive required but returned 0' };
    }

    // Step 2: Purge
    let purged = 0;
    if (!dryRun) {
      purged = await this.deleteRecords(entityType, cutoffDate);
    } else {
      // Dry run - just count
      const stats = await this.getEntityStats(entityType, cutoffDate);
      purged = stats.eligibleForPurge;
    }

    // Step 3: Audit log
    await this.auditService.log({
      actor: { id: actorId, role: actorRole },
      action: AuditAction.MANUAL_OVERRIDE, // Using override for retention actions
      severity: AuditSeverity.CRITICAL,
      entityType: 'RetentionPurge',
      entityId: entityType,
      beforeState: { cutoffDate: cutoffDate.toISOString() },
      afterState: { purged, archived, dryRun },
      metadata: { policy },
    });

    this.logger.info(
      `Retention purge for ${entityType}: ${purged} purged, ${archived} archived`,
      'RetentionService',
    );

    return { purged, archived };
  }

  private async archiveRecords(entityType: string, cutoffDate: Date): Promise<number> {
    // In production, this would:
    // 1. Export to cold storage (S3, Azure Blob, etc.)
    // 2. Generate legal-compliant archive files
    // 3. Store archive metadata
    
    // For now, we log the intent
    this.logger.info(
      `Archiving ${entityType} records before ${cutoffDate.toISOString()}`,
      'RetentionService',
    );
    
    return 0; // Would return actual count
  }

  private async deleteRecords(entityType: string, cutoffDate: Date): Promise<number> {
    const modelMap: Record<string, string> = {
      'RefreshToken': 'refreshToken',
      'SyncEvent': 'syncEvent',
      'SecurityLog': 'securityLog',
    };

    const model = modelMap[entityType];
    if (!model || !(this.prisma as any)[model]) {
      return 0;
    }

    // Only delete entities marked as canAutoPurge
    const policy = this.getPolicy(entityType);
    if (!policy?.canAutoPurge) {
      this.logger.warn(
        `Attempted to purge ${entityType} but canAutoPurge is false`,
        'RetentionService',
      );
      return 0;
    }

    const result = await (this.prisma as any)[model].deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    return result.count;
  }
}
