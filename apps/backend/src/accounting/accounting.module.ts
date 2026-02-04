import { Module } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LoggerModule } from '../common/logger/logger.module';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ACCOUNTING MODULE — Integration with Accounting Systems
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Features:
 * - Export accounting entries (journal entries)
 * - Support for PC Compta, Sage formats
 * - Chart of accounts mapping
 * - VAT declarations support
 * - Fiscal compliance (DGI Algeria)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

@Module({
  imports: [PrismaModule, LoggerModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
