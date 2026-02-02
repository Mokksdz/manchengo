import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityLogService } from './security-log.service';
import { DevicesService } from './devices.service';
import { SecurityController } from './security.controller';
import { AuditController } from './audit.controller';

/**
 * Security Module
 * 
 * Provides enterprise-grade security services:
 * - Audit logging for all security events
 * - Device management and revocation
 * - User status validation
 * - Admin endpoints for security management
 * 
 * Marked as Global so security services are available throughout the app.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [SecurityController, AuditController],
  providers: [SecurityLogService, DevicesService],
  exports: [SecurityLogService, DevicesService],
})
export class SecurityModule {}
