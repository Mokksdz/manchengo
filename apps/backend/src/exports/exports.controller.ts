import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DateRangeQueryDto, ExportFormat } from './dto/export.dto';
import { SalesJournalService } from './services/sales-journal.service';
import { VatJournalService } from './services/vat-journal.service';
import { StampDutyService } from './services/stamp-duty.service';
import { StockStatementService } from './services/stock-statement.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { MpStocksService } from './services/mp-stocks.service';
import { MpReceptionsService } from './services/mp-receptions.service';
import { PfStocksService } from './services/pf-stocks.service';
import { PfProductionService } from './services/pf-production.service';

/**
 * Exports Controller
 * 
 * Provides fiscal export endpoints for Algerian compliance.
 * All endpoints are:
 * - Protected by JWT authentication
 * - Restricted to ADMIN role only
 * - READ-ONLY (no data mutations)
 * 
 * Endpoints:
 * - GET /api/exports/sales - Sales Journal (Journal des Ventes)
 * - GET /api/exports/vat - VAT Journal (Journal de TVA)
 * - GET /api/exports/stamp - Stamp Duty Journal (Journal du Timbre)
 * - GET /api/exports/stock - Stock Statement (État des Stocks)
 * - GET /api/exports/invoice/:id - Individual Invoice PDF
 */
@ApiTags('Exports')
@ApiBearerAuth()
@Controller('exports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ExportsController {
  constructor(
    private salesJournalService: SalesJournalService,
    private vatJournalService: VatJournalService,
    private stampDutyService: StampDutyService,
    private stockStatementService: StockStatementService,
    private invoicePdfService: InvoicePdfService,
    private mpStocksService: MpStocksService,
    private mpReceptionsService: MpReceptionsService,
    private pfStocksService: PfStocksService,
    private pfProductionService: PfProductionService,
  ) {}

  /**
   * Sales Journal Export
   * Lists all invoices for the period with fiscal totals
   */
  @Get('sales')
  @ApiOperation({ summary: 'Export Sales Journal (Journal des Ventes)' })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-12-31' })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat })
  async exportSalesJournal(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    this.validateDateRange(startDate, endDate);
    endDate.setHours(23, 59, 59, 999); // Include full day

    const format = query.format || ExportFormat.PDF;
    const buffer = await this.salesJournalService.generate(startDate, endDate, format);

    const filename = `journal_ventes_${query.startDate}_${query.endDate}`;
    this.sendFile(res, buffer, filename, format);
  }

  /**
   * VAT Journal Export
   * Per-invoice breakdown of HT and TVA for G50 declaration
   */
  @Get('vat')
  @ApiOperation({ summary: 'Export VAT Journal (Journal de TVA)' })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-12-31' })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat })
  async exportVatJournal(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    this.validateDateRange(startDate, endDate);
    endDate.setHours(23, 59, 59, 999);

    const format = query.format || ExportFormat.PDF;
    const buffer = await this.vatJournalService.generate(startDate, endDate, format);

    const filename = `journal_tva_${query.startDate}_${query.endDate}`;
    this.sendFile(res, buffer, filename, format);
  }

  /**
   * Stamp Duty Journal Export
   * Cash invoices with stamp duty applied
   */
  @Get('stamp')
  @ApiOperation({ summary: 'Export Stamp Duty Journal (Journal du Timbre Fiscal)' })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-12-31' })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat })
  async exportStampDutyJournal(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);

    const format = query.format || ExportFormat.PDF;
    const buffer = await this.stampDutyService.generate(startDate, endDate, format);

    const filename = `journal_timbre_${query.startDate}_${query.endDate}`;
    this.sendFile(res, buffer, filename, format);
  }

  /**
   * Stock Statement Export
   * MP and PF stock movements for the period
   */
  @Get('stock')
  @ApiOperation({ summary: 'Export Stock Statement (État des Stocks)' })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-12-31' })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat })
  async exportStockStatement(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);

    const format = query.format || ExportFormat.PDF;
    const buffer = await this.stockStatementService.generate(startDate, endDate, format);

    const filename = `etat_stocks_${query.startDate}_${query.endDate}`;
    this.sendFile(res, buffer, filename, format);
  }

  /**
   * Individual Invoice PDF Export
   * Legally formatted invoice document
   * Accessible to ADMIN and COMMERCIAL roles
   */
  @Get('invoice/:id/pdf')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({ summary: 'Export Individual Invoice PDF' })
  async exportInvoicePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.invoicePdfService.generate(id);
    const invoice = await this.invoicePdfService.getInvoiceReference(id);
    const filename = `Facture-${invoice?.reference || id}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  // ============================================
  // MATIÈRES PREMIÈRES (MP) EXPORTS
  // ============================================

  /**
   * MP Stocks Export
   * État des stocks matières premières
   */
  @Get('mp/stocks')
  @ApiOperation({ summary: 'Export MP Stocks (État des Stocks MP)' })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-12-31' })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat })
  async exportMpStocks(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);

    const format = query.format || ExportFormat.PDF;
    const buffer = await this.mpStocksService.generate(startDate, endDate, format);

    const filename = `etat_stocks_mp_${query.startDate}_${query.endDate}`;
    this.sendFile(res, buffer, filename, format);
  }

  /**
   * MP Receptions Journal Export
   * Journal des réceptions matières premières
   */
  @Get('mp/receptions')
  @ApiOperation({ summary: 'Export MP Receptions Journal (Journal Réceptions MP)' })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-12-31' })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat })
  async exportMpReceptions(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);

    const format = query.format || ExportFormat.PDF;
    const buffer = await this.mpReceptionsService.generate(startDate, endDate, format);

    const filename = `journal_receptions_mp_${query.startDate}_${query.endDate}`;
    this.sendFile(res, buffer, filename, format);
  }

  // ============================================
  // PRODUITS FINIS (PF) EXPORTS
  // ============================================

  /**
   * PF Stocks Export
   * État des stocks produits finis
   */
  @Get('pf/stocks')
  @ApiOperation({ summary: 'Export PF Stocks (État des Stocks PF)' })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-12-31' })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat })
  async exportPfStocks(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);

    const format = query.format || ExportFormat.PDF;
    const buffer = await this.pfStocksService.generate(startDate, endDate, format);

    const filename = `etat_stocks_pf_${query.startDate}_${query.endDate}`;
    this.sendFile(res, buffer, filename, format);
  }

  /**
   * PF Production Journal Export
   * Journal de production produits finis
   */
  @Get('pf/production')
  @ApiOperation({ summary: 'Export PF Production Journal (Journal Production PF)' })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-12-31' })
  @ApiQuery({ name: 'format', required: false, enum: ExportFormat })
  async exportPfProduction(
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);

    const format = query.format || ExportFormat.PDF;
    const buffer = await this.pfProductionService.generate(startDate, endDate, format);

    const filename = `journal_production_pf_${query.startDate}_${query.endDate}`;
    this.sendFile(res, buffer, filename, format);
  }

  /**
   * Validate date range: startDate must be before or equal to endDate
   */
  private validateDateRange(startDate: Date, endDate: Date): void {
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Dates invalides');
    }
    if (startDate > endDate) {
      throw new BadRequestException('La date de début doit être antérieure à la date de fin');
    }
  }

  /**
   * Helper to send file with proper headers
   */
  private sendFile(
    res: Response,
    buffer: Buffer,
    filename: string,
    format: ExportFormat,
  ): void {
    const isPdf = format === ExportFormat.PDF;
    const contentType = isPdf
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const extension = isPdf ? 'pdf' : 'xlsx';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
