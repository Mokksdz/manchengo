import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit';
import { LoggerService } from '../common/logger';
import { AuditAction, AuditSeverity, UserRole } from '@prisma/client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FEATURE FLAGS SERVICE - Controlled rollout & emergency kill switches
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Control feature availability without deployments
 * 
 * USE CASES:
 *   1. Gradual rollout of risky features
 *   2. Emergency kill switches for problematic features
 *   3. A/B testing (future)
 *   4. Per-company feature enablement (SaaS)
 * 
 * SAFETY PRINCIPLES:
 *   1. Default to OFF for new/risky features
 *   2. All flag changes are audited
 *   3. Kill switches take effect immediately
 *   4. No deployment required to disable
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'core' | 'experimental' | 'beta' | 'deprecated';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  rolloutPercent: number; // 0-100, for gradual rollout
  enabledForRoles?: UserRole[];
  killSwitch: boolean; // If true, can be disabled instantly
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_FLAGS: FeatureFlag[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE FEATURES (always on, but can be killed in emergency)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    key: 'stock_movements',
    name: 'Mouvements de Stock',
    description: 'Création et gestion des mouvements de stock',
    enabled: true,
    category: 'core',
    riskLevel: 'critical',
    rolloutPercent: 100,
    killSwitch: true,
  },
  {
    key: 'production_orders',
    name: 'Ordres de Production',
    description: 'Création et gestion des ordres de production',
    enabled: true,
    category: 'core',
    riskLevel: 'critical',
    rolloutPercent: 100,
    killSwitch: true,
  },
  {
    key: 'invoicing',
    name: 'Facturation',
    description: 'Création et gestion des factures',
    enabled: true,
    category: 'core',
    riskLevel: 'critical',
    rolloutPercent: 100,
    killSwitch: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BETA FEATURES (controlled rollout)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    key: 'auto_reorder_suggestions',
    name: 'Suggestions Réapprovisionnement Auto',
    description: 'Suggestions automatiques de réapprovisionnement basées sur l\'historique',
    enabled: true,
    category: 'beta',
    riskLevel: 'medium',
    rolloutPercent: 100,
    enabledForRoles: [UserRole.ADMIN, UserRole.APPRO],
    killSwitch: true,
  },
  {
    key: 'bulk_stock_import',
    name: 'Import Stock en Masse',
    description: 'Import CSV de mouvements de stock',
    enabled: true,
    category: 'beta',
    riskLevel: 'high',
    rolloutPercent: 100,
    enabledForRoles: [UserRole.ADMIN],
    killSwitch: true,
  },
  {
    key: 'ocr_reception',
    name: 'OCR Bon de Livraison',
    description: 'Lecture automatique des bons de livraison par OCR',
    enabled: false,
    category: 'experimental',
    riskLevel: 'medium',
    rolloutPercent: 0,
    enabledForRoles: [UserRole.ADMIN, UserRole.APPRO],
    killSwitch: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPERIMENTAL FEATURES (off by default)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    key: 'mobile_sync',
    name: 'Synchronisation Mobile',
    description: 'Synchronisation bidirectionnelle avec l\'app mobile',
    enabled: false,
    category: 'experimental',
    riskLevel: 'high',
    rolloutPercent: 0,
    killSwitch: true,
  },
  {
    key: 'predictive_stock',
    name: 'Prédiction de Stock',
    description: 'Prédiction des ruptures basée sur l\'historique',
    enabled: false,
    category: 'experimental',
    riskLevel: 'low',
    rolloutPercent: 0,
    killSwitch: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN/DANGEROUS FEATURES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    key: 'data_export_full',
    name: 'Export Données Complet',
    description: 'Export de toutes les données (RGPD/audit)',
    enabled: true,
    category: 'core',
    riskLevel: 'high',
    rolloutPercent: 100,
    enabledForRoles: [UserRole.ADMIN],
    killSwitch: true,
  },
  {
    key: 'manual_stock_override',
    name: 'Override Stock Manuel',
    description: 'Permet les ajustements manuels sans justification',
    enabled: false,
    category: 'deprecated',
    riskLevel: 'critical',
    rolloutPercent: 0,
    enabledForRoles: [UserRole.ADMIN],
    killSwitch: true,
  },
];

@Injectable()
export class FeatureFlagsService {
  private flags: Map<string, FeatureFlag> = new Map();

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('FeatureFlagsService');
    this.initializeFlags();
  }

  private initializeFlags(): void {
    DEFAULT_FLAGS.forEach(flag => {
      this.flags.set(flag.key, { ...flag });
    });
    this.logger.info(`Initialized ${this.flags.size} feature flags`, 'FeatureFlagsService');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLAG QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if a feature is enabled for a given user
   */
  isEnabled(key: string, userRole?: UserRole, userId?: string): boolean {
    const flag = this.flags.get(key);
    if (!flag) {
      this.logger.warn(`Unknown feature flag: ${key}`, 'FeatureFlagsService');
      return false;
    }

    // Check global enabled
    if (!flag.enabled) {
      return false;
    }

    // Check role restriction
    if (flag.enabledForRoles && userRole) {
      if (!flag.enabledForRoles.includes(userRole)) {
        return false;
      }
    }

    // Check rollout percentage (simple hash-based)
    if (flag.rolloutPercent < 100 && userId) {
      const hash = this.hashUserId(userId);
      if (hash > flag.rolloutPercent) {
        return false;
      }
    }

    return true;
  }

  private hashUserId(userId: string): number {
    // Simple hash to get consistent 0-100 value for user
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }

  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  getFlagsByCategory(category: FeatureFlag['category']): FeatureFlag[] {
    return this.getAllFlags().filter(f => f.category === category);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLAG MUTATIONS (Admin only, audited)
  // ═══════════════════════════════════════════════════════════════════════════

  async enableFlag(
    key: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<FeatureFlag> {
    return this.updateFlag(key, { enabled: true }, actorId, actorRole);
  }

  async disableFlag(
    key: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<FeatureFlag> {
    return this.updateFlag(key, { enabled: false }, actorId, actorRole);
  }

  /**
   * KILL SWITCH - Immediately disable a feature
   * Used in emergencies when a feature is causing issues
   */
  async killSwitch(
    key: string,
    reason: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<FeatureFlag> {
    const flag = this.flags.get(key);
    if (!flag) {
      throw new Error(`Unknown feature flag: ${key}`);
    }

    if (!flag.killSwitch) {
      throw new Error(`Feature ${key} does not have a kill switch`);
    }

    const before = { ...flag };
    
    flag.enabled = false;
    flag.rolloutPercent = 0;
    flag.lastModifiedBy = actorId;
    flag.lastModifiedAt = new Date();

    await this.auditService.log({
      actor: { id: actorId, role: actorRole },
      action: AuditAction.MANUAL_OVERRIDE,
      severity: AuditSeverity.CRITICAL,
      entityType: 'FeatureFlag',
      entityId: key,
      beforeState: { enabled: before.enabled, rolloutPercent: before.rolloutPercent },
      afterState: { enabled: false, rolloutPercent: 0 },
      metadata: { reason, isKillSwitch: true },
    });

    this.logger.warn(
      `KILL SWITCH activated for ${key}: ${reason}`,
      'FeatureFlagsService',
    );

    return flag;
  }

  async updateFlag(
    key: string,
    updates: Partial<Pick<FeatureFlag, 'enabled' | 'rolloutPercent' | 'enabledForRoles'>>,
    actorId: string,
    actorRole: UserRole,
  ): Promise<FeatureFlag> {
    const flag = this.flags.get(key);
    if (!flag) {
      throw new Error(`Unknown feature flag: ${key}`);
    }

    // Only ADMIN can modify flags
    if (actorRole !== UserRole.ADMIN) {
      throw new Error('Only ADMIN can modify feature flags');
    }

    const before = { ...flag };

    if (updates.enabled !== undefined) flag.enabled = updates.enabled;
    if (updates.rolloutPercent !== undefined) flag.rolloutPercent = updates.rolloutPercent;
    if (updates.enabledForRoles !== undefined) flag.enabledForRoles = updates.enabledForRoles;
    
    flag.lastModifiedBy = actorId;
    flag.lastModifiedAt = new Date();

    await this.auditService.log({
      actor: { id: actorId, role: actorRole },
      action: AuditAction.MANUAL_OVERRIDE,
      severity: flag.riskLevel === 'critical' ? AuditSeverity.CRITICAL : AuditSeverity.WARNING,
      entityType: 'FeatureFlag',
      entityId: key,
      beforeState: before as unknown as Record<string, unknown>,
      afterState: flag as unknown as Record<string, unknown>,
    });

    this.logger.info(
      `Feature flag ${key} updated by ${actorId}`,
      'FeatureFlagsService',
    );

    return flag;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRADUAL ROLLOUT
  // ═══════════════════════════════════════════════════════════════════════════

  async setRolloutPercent(
    key: string,
    percent: number,
    actorId: string,
    actorRole: UserRole,
  ): Promise<FeatureFlag> {
    if (percent < 0 || percent > 100) {
      throw new Error('Rollout percent must be between 0 and 100');
    }

    return this.updateFlag(key, { rolloutPercent: percent }, actorId, actorRole);
  }

  /**
   * Get rollout status for all flags
   */
  getRolloutStatus(): Array<{
    key: string;
    name: string;
    enabled: boolean;
    rolloutPercent: number;
    category: string;
    riskLevel: string;
  }> {
    return this.getAllFlags().map(f => ({
      key: f.key,
      name: f.name,
      enabled: f.enabled,
      rolloutPercent: f.rolloutPercent,
      category: f.category,
      riskLevel: f.riskLevel,
    }));
  }
}
