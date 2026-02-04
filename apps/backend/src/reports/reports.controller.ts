import { Controller, Get, Query, UseGuards, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService, ReportFilters } from './reports.service';
import { ReportExportService, ReportType } from './report-export.service';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * REPORTS CONTROLLER — Report Generation Endpoints
 * ═══════════════════════════════════════════════════════════════════════════════
 */

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportExportService: ReportExportService,
  ) {}

  // ─── Stock Reports ─────────────────────────────────────────────────────────

  @Get('stock/valorization')
  @ApiOperation({ summary: 'Get stock valorization report' })
  @Roles('ADMIN', 'APPRO')
  async getStockValorization() {
    return this.reportsService.getStockValorizationReport();
  }

  @Get('stock/movements')
  @ApiOperation({ summary: 'Get stock movements report' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'productMpId', required: false, type: Number })
  @ApiQuery({ name: 'productPfId', required: false, type: Number })
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  async getStockMovements(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('productMpId') productMpId?: string,
    @Query('productPfId') productPfId?: string,
  ) {
    const filters: ReportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      productMpId: productMpId ? parseInt(productMpId, 10) : undefined,
      productPfId: productPfId ? parseInt(productPfId, 10) : undefined,
    };
    return this.reportsService.getStockMovementReport(filters);
  }

  // ─── Production Reports ────────────────────────────────────────────────────

  @Get('production')
  @ApiOperation({ summary: 'Get production performance report' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @Roles('ADMIN', 'PRODUCTION')
  async getProductionReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('status') status?: string,
  ) {
    const filters: ReportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status,
    };
    return this.reportsService.getProductionReport(filters);
  }

  // ─── Procurement Reports ───────────────────────────────────────────────────

  @Get('procurement/purchase-orders')
  @ApiOperation({ summary: 'Get purchase orders report' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiQuery({ name: 'supplierId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @Roles('ADMIN', 'APPRO')
  async getPurchaseOrdersReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
  ) {
    const filters: ReportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      supplierId: supplierId ? parseInt(supplierId, 10) : undefined,
      status,
    };
    return this.reportsService.getPurchaseOrdersReport(filters);
  }

  @Get('procurement/suppliers')
  @ApiOperation({ summary: 'Get supplier performance report' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @Roles('ADMIN', 'APPRO')
  async getSupplierPerformanceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const filters: ReportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
    return this.reportsService.getSupplierPerformanceReport(filters);
  }

  // ─── Sales Reports ─────────────────────────────────────────────────────────

  @Get('sales')
  @ApiOperation({ summary: 'Get sales report' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @Roles('ADMIN', 'COMMERCIAL')
  async getSalesReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const filters: ReportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
    return this.reportsService.getSalesReport(filters);
  }

  // ─── Export Endpoints ──────────────────────────────────────────────────────

  @Get('export/excel')
  @ApiOperation({ summary: 'Export report to Excel (.xlsx)' })
  @ApiQuery({ name: 'type', required: true, type: String, description: 'stock-valorization, stock-movements, production, purchase-orders, suppliers, sales' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @Roles('ADMIN', 'APPRO', 'PRODUCTION', 'COMMERCIAL')
  async exportToExcel(
    @Query('type') type: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    this.validateExportParams(type, startDate, endDate);

    const filters: ReportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    const result = await this.reportExportService.exportToExcel(type as ReportType, filters);

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.buffer.length,
    });
    res.end(result.buffer);
  }

  @Get('export/pdf')
  @ApiOperation({ summary: 'Export report to PDF' })
  @ApiQuery({ name: 'type', required: true, type: String, description: 'stock-valorization, stock-movements, production, purchase-orders, suppliers, sales' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @Roles('ADMIN', 'APPRO', 'PRODUCTION', 'COMMERCIAL')
  async exportToPdf(
    @Query('type') type: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    this.validateExportParams(type, startDate, endDate);

    const filters: ReportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    const result = await this.reportExportService.exportToPdf(type as ReportType, filters);

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.buffer.length,
    });
    res.end(result.buffer);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private validateExportParams(type: string, startDate: string, endDate: string): void {
    const validTypes: ReportType[] = [
      'stock-valorization',
      'stock-movements',
      'production',
      'purchase-orders',
      'suppliers',
      'sales',
    ];

    if (!validTypes.includes(type as ReportType)) {
      throw new BadRequestException(
        `Type de rapport invalide: "${type}". Types valides: ${validTypes.join(', ')}`,
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Dates invalides');
    }
    if (start > end) {
      throw new BadRequestException('La date de debut doit etre anterieure a la date de fin');
    }
  }
}
