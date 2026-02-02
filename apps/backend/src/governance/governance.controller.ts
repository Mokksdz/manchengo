import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RetentionService } from './retention.service';
import { SecurityHardeningService, EmergencyMode } from './security-hardening.service';
import { FeatureFlagsService } from './feature-flags.service';
import { UserRole } from '@prisma/client';

/**
 * Governance Controller - Admin-only endpoints for system governance
 */
@ApiTags('Governance')
@ApiBearerAuth()
@Controller('governance')
export class GovernanceController {
  constructor(
    private retentionService: RetentionService,
    private securityService: SecurityHardeningService,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // RETENTION
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('retention/policies')
  @ApiOperation({ summary: 'Get all retention policies' })
  getRetentionPolicies() {
    return this.retentionService.getAllPolicies();
  }

  @Get('retention/status')
  @ApiOperation({ summary: 'Get retention status for all entity types' })
  async getRetentionStatus() {
    return this.retentionService.getRetentionStatus();
  }

  @Post('retention/purge')
  @ApiOperation({ summary: 'Purge records for an entity type (admin only)' })
  async purgeEntity(
    @Body() body: { entityType: string; dryRun?: boolean },
    @Req() req: any,
  ) {
    const userId = req.user?.id || 'system';
    const userRole = req.user?.role || UserRole.ADMIN;
    
    return this.retentionService.purgeEntity(
      body.entityType,
      userId,
      userRole,
      body.dryRun ?? true, // Default to dry run for safety
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('security/status')
  @ApiOperation({ summary: 'Get security status and stats' })
  async getSecurityStatus() {
    const [stats, alertStatus, emergencyMode] = await Promise.all([
      this.securityService.getSecurityStats(),
      this.securityService.shouldAlertSecurity(),
      Promise.resolve(this.securityService.getEmergencyMode()),
    ]);

    return {
      stats,
      alertStatus,
      emergencyMode,
    };
  }

  @Get('security/thresholds')
  @ApiOperation({ summary: 'Get current security thresholds' })
  getSecurityThresholds() {
    return this.securityService.getThresholds();
  }

  @Post('security/emergency-mode')
  @ApiOperation({ summary: 'Set emergency mode (admin only)' })
  async setEmergencyMode(
    @Body() body: { mode: EmergencyMode; reason: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id || 'system';
    const userRole = req.user?.role || UserRole.ADMIN;

    await this.securityService.setEmergencyMode(
      body.mode,
      body.reason,
      userId,
      userRole,
    );

    return { success: true, mode: body.mode };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE FLAGS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('features')
  @ApiOperation({ summary: 'Get all feature flags' })
  getFeatureFlags() {
    return this.featureFlagsService.getAllFlags();
  }

  @Get('features/rollout-status')
  @ApiOperation({ summary: 'Get rollout status for all features' })
  getRolloutStatus() {
    return this.featureFlagsService.getRolloutStatus();
  }

  @Get('features/check')
  @ApiOperation({ summary: 'Check if a feature is enabled for current user' })
  checkFeature(
    @Query('key') key: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    return {
      key,
      enabled: this.featureFlagsService.isEnabled(key, userRole, userId),
    };
  }

  @Post('features/toggle')
  @ApiOperation({ summary: 'Enable or disable a feature flag (admin only)' })
  async toggleFeature(
    @Body() body: { key: string; enabled: boolean },
    @Req() req: any,
  ) {
    const userId = req.user?.id || 'system';
    const userRole = req.user?.role || UserRole.ADMIN;

    if (body.enabled) {
      return this.featureFlagsService.enableFlag(body.key, userId, userRole);
    } else {
      return this.featureFlagsService.disableFlag(body.key, userId, userRole);
    }
  }

  @Post('features/kill-switch')
  @ApiOperation({ summary: 'Emergency kill switch for a feature (admin only)' })
  async killSwitch(
    @Body() body: { key: string; reason: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id || 'system';
    const userRole = req.user?.role || UserRole.ADMIN;

    return this.featureFlagsService.killSwitch(
      body.key,
      body.reason,
      userId,
      userRole,
    );
  }

  @Post('features/rollout')
  @ApiOperation({ summary: 'Set rollout percentage for a feature (admin only)' })
  async setRollout(
    @Body() body: { key: string; percent: number },
    @Req() req: any,
  ) {
    const userId = req.user?.id || 'system';
    const userRole = req.user?.role || UserRole.ADMIN;

    return this.featureFlagsService.setRolloutPercent(
      body.key,
      body.percent,
      userId,
      userRole,
    );
  }
}
