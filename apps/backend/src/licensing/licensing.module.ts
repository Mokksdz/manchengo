import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LicensingService } from './licensing.service';
import { LicensingController } from './licensing.controller';
import { LicenseGuard, ReadOnlyGuard } from './license.guard';

/**
 * Licensing Module
 * 
 * SaaS licensing infrastructure:
 * - Company management
 * - License validation and enforcement
 * - Device-based licensing
 * - License key activation
 * - Guards for write protection
 * 
 * Marked as Global for access throughout the app.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [LicensingController],
  providers: [LicensingService, LicenseGuard, ReadOnlyGuard],
  exports: [LicensingService, LicenseGuard, ReadOnlyGuard],
})
export class LicensingModule {}
