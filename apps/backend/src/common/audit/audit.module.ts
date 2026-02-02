import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Global Audit Module
 * 
 * WHY Global: Every module that performs critical business operations
 * needs access to audit logging. Making it global avoids importing
 * AuditModule in every feature module.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
