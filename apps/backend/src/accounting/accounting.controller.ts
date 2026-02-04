import { Controller, Get, Query, UseGuards, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccountingService, ExportFilters } from './accounting.service';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ACCOUNTING CONTROLLER — Export Endpoints
 * ═══════════════════════════════════════════════════════════════════════════════
 */

@ApiTags('Accounting')
@ApiBearerAuth()
@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // ─── Journal Entries ───────────────────────────────────────────────────────

  @Get('journal/sales')
  @ApiOperation({ summary: 'Get sales journal entries' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getSalesJournal(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const filters: ExportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
    return this.accountingService.getSalesJournalEntries(filters);
  }

  @Get('journal/purchases')
  @ApiOperation({ summary: 'Get purchases journal entries' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getPurchasesJournal(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const filters: ExportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
    return this.accountingService.getPurchasesJournalEntries(filters);
  }

  @Get('journal/production')
  @ApiOperation({ summary: 'Get production journal entries' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getProductionJournal(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const filters: ExportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
    return this.accountingService.getProductionJournalEntries(filters);
  }

  // ─── Export Formats ────────────────────────────────────────────────────────

  @Get('export/pccompta')
  @ApiOperation({ summary: 'Export journal entries to PC Compta format' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'journalType', required: false, enum: ['SALES', 'PURCHASES', 'PRODUCTION', 'ALL'] })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportPCCompta(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('journalType') journalType: 'SALES' | 'PURCHASES' | 'PRODUCTION' | 'ALL' = 'ALL',
    @Res() res: Response,
  ) {
    const filters: ExportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      journalType,
    };

    const csv = await this.accountingService.exportToPCCompta(filters);

    const filename = `manchengo_pccompta_${startDate}_${endDate}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('export/sage')
  @ApiOperation({ summary: 'Export journal entries to Sage format' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'journalType', required: false, enum: ['SALES', 'PURCHASES', 'PRODUCTION', 'ALL'] })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportSage(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('journalType') journalType: 'SALES' | 'PURCHASES' | 'PRODUCTION' | 'ALL' = 'ALL',
    @Res() res: Response,
  ) {
    const filters: ExportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      journalType,
    };

    const csv = await this.accountingService.exportToSage(filters);

    const filename = `manchengo_sage_${startDate}_${endDate}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  // ─── VAT Declaration ───────────────────────────────────────────────────────

  @Get('vat/declaration')
  @ApiOperation({ summary: 'Get VAT declaration data (G50)' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getVATDeclaration(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const filters: ExportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
    return this.accountingService.getVATDeclaration(filters);
  }
}
