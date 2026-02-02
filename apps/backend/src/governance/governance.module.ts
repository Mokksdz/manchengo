import { Module, Global } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { SecurityHardeningService } from './security-hardening.service';
import { FeatureFlagsService } from './feature-flags.service';
import { GovernanceController } from './governance.controller';

/**
 * Governance Module
 * 
 * Provides enterprise governance services:
 * - Data retention & legal compliance
 * - Security hardening & anomaly detection
 * - Feature flags & change control
 * 
 * Marked as Global so governance services are available throughout the app.
 */
@Global()
@Module({
  controllers: [GovernanceController],
  providers: [
    RetentionService,
    SecurityHardeningService,
    FeatureFlagsService,
  ],
  exports: [
    RetentionService,
    SecurityHardeningService,
    FeatureFlagsService,
  ],
})
export class GovernanceModule {}
