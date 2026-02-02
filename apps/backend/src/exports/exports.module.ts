import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { SalesJournalService } from './services/sales-journal.service';
import { VatJournalService } from './services/vat-journal.service';
import { StampDutyService } from './services/stamp-duty.service';
import { StockStatementService } from './services/stock-statement.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { ExcelGeneratorService } from './services/excel-generator.service';
import { MpStocksService } from './services/mp-stocks.service';
import { MpReceptionsService } from './services/mp-receptions.service';
import { PfStocksService } from './services/pf-stocks.service';
import { PfProductionService } from './services/pf-production.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Exports Module
 * 
 * Provides fiscal and industrial export functionality.
 * All exports are READ-ONLY snapshots from PostgreSQL.
 * 
 * Fiscal exports:
 * - Sales Journal (Journal des Ventes)
 * - VAT Journal (Journal de TVA)
 * - Stamp Duty Journal (Journal du Timbre Fiscal)
 * - Stock Statement (État des Stocks)
 * - Individual Invoice PDF
 * 
 * Industrial exports (MP):
 * - État des Stocks MP
 * - Journal des Réceptions MP
 * 
 * Industrial exports (PF):
 * - État des Stocks PF
 * - Journal de Production PF
 */
@Module({
  imports: [PrismaModule],
  controllers: [ExportsController],
  providers: [
    // Fiscal exports
    SalesJournalService,
    VatJournalService,
    StampDutyService,
    StockStatementService,
    InvoicePdfService,
    // Generators
    PdfGeneratorService,
    ExcelGeneratorService,
    // MP exports
    MpStocksService,
    MpReceptionsService,
    // PF exports
    PfStocksService,
    PfProductionService,
  ],
})
export class ExportsModule {}
