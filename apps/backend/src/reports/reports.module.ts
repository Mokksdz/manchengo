import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportExportService } from './report-export.service';
import { ReportsController } from './reports.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LoggerModule } from '../common/logger/logger.module';
import { QueuesModule } from '../common/queues/queues.module';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * REPORTS MODULE — Advanced Reporting & Export
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Features:
 * - Stock reports (MP, PF, movements)
 * - Production reports (orders, yield, consumption)
 * - Procurement reports (PO, suppliers, lead times)
 * - Financial reports (sales, purchases)
 * - Export to PDF/Excel via ReportExportService
 * - Scheduled reports via email
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

@Module({
  imports: [PrismaModule, LoggerModule, QueuesModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportExportService],
  exports: [ReportsService, ReportExportService],
})
export class ReportsModule {}
