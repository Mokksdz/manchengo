import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ProductionService } from './production.service';
import { ProductionSupplyRisksService } from './production-supply-risks.service';

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION CONTROLLER - Gestion des ordres de production
// ═══════════════════════════════════════════════════════════════════════════════

@Controller('production')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductionController {
  constructor(
    private readonly productionService: ProductionService,
    private readonly supplyRisksService: ProductionSupplyRisksService,
  ) {}

  /**
   * GET /api/production
   * Liste tous les ordres de production
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async findAll(
    @Query('status') status?: string,
    @Query('productPfId') productPfId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productionService.findAll({
      status,
      productPfId: productPfId ? parseInt(productPfId) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  /**
   * POST /api/production
   * Crée un nouvel ordre de production
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: {
      productPfId: number;
      batchCount: number;
      notes?: string;
    },
    @CurrentUser() user: { id: string },
  ) {
    if (!dto.batchCount || dto.batchCount < 1 || dto.batchCount > 1000) {
      throw new BadRequestException('batchCount doit être compris entre 1 et 1000');
    }
    return this.productionService.create(dto, user.id);
  }

  /**
   * POST /api/production/:id/start
   * Démarre une production (consomme les MP en FIFO)
   */
  @Post(':id/start')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async start(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: string },
  ) {
    return this.productionService.start(id, user.id);
  }

  /**
   * POST /api/production/:id/complete
   * Termine une production (crée le lot PF)
   */
  @Post(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: {
      quantityProduced: number;
      batchWeightReal?: number;
      qualityNotes?: string;
      qualityStatus?: string;
    },
    @CurrentUser() user: { id: string },
  ) {
    if (!dto.quantityProduced || dto.quantityProduced <= 0) {
      throw new BadRequestException('quantityProduced doit être supérieur à 0');
    }
    return this.productionService.complete(id, dto, user.id);
  }

  /**
   * POST /api/production/:id/cancel
   * Annule une production
   */
  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { reason?: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.productionService.cancel(id, user.id, dto.reason);
  }

  /**
   * GET /api/production/dashboard/kpis
   * KPIs du dashboard production
   */
  @Get('dashboard/kpis')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async getDashboardKpis() {
    return this.productionService.getDashboardKpis();
  }

  /**
   * GET /api/production/dashboard/supply-risks
   * P0.1: Risques supply chain agrégés pour le Dashboard Production
   * 
   * Retourne:
   * - MP critiques (bloquantes, risque 48h, 72h)
   * - BC en retard avec impact
   * - Fournisseurs bloquants
   * - Résumé pour bannière d'urgence
   */
  @Get('dashboard/supply-risks')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async getSupplyRisks() {
    return this.supplyRisksService.getSupplyRisks();
  }

  /**
   * GET /api/production/dashboard/at-risk
   * A1: Productions à risque supply chain
   * 
   * Question métier: "Quelles productions prévues vont échouer si je ne fais rien ?"
   * 
   * Retourne:
   * - Productions PENDING/IN_PROGRESS avec risques identifiés
   * - Niveau de risque (CRITICAL/WARNING)
   * - Raisons explicites (MP en rupture, BC en retard)
   * - Indicateur canStart
   */
  @Get('dashboard/at-risk')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async getProductionsAtRisk() {
    return this.supplyRisksService.getProductionsAtRisk();
  }

  /**
   * GET /api/production/dashboard/alerts
   * Alertes production
   */
  @Get('dashboard/alerts')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async getAlerts() {
    return this.productionService.getAlerts();
  }

  /**
   * GET /api/production/dashboard/stock-pf
   * Résumé stock PF
   */
  @Get('dashboard/stock-pf')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async getStockPfSummary() {
    return this.productionService.getStockPfSummary();
  }

  /**
   * GET /api/production/dashboard/calendar
   * Calendrier de production
   */
  @Get('dashboard/calendar')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async getCalendar(@Query('days') days?: string) {
    return this.productionService.getCalendar(days ? parseInt(days) : 7);
  }

  /**
   * GET /api/production/dashboard/analytics
   * Analytics de production
   */
  @Get('dashboard/analytics')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async getAnalytics(@Query('period') period?: 'week' | 'month' | 'year') {
    return this.productionService.getAnalytics(period || 'month');
  }

  /**
   * GET /api/production/lots/search
   * Recherche traçabilité lots
   */
  @Get('lots/search')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async searchLots(
    @Query('q') query: string,
    @Query('type') type?: 'MP' | 'PF',
  ) {
    return this.productionService.searchLots(query || '', type);
  }

  /**
   * GET /api/production/product/:productPfId/history
   * Historique de production d'un produit
   */
  @Get('product/:productPfId/history')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async getProductHistory(
    @Param('productPfId', ParseIntPipe) productPfId: number,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productionService.getProductHistory(productPfId, {
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PARAMETERIZED ROUTES — MUST be declared AFTER all specific routes
  // to avoid :id capturing "dashboard", "lots", "product" etc.
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/production/:id/pdf
   * Télécharger le PDF d'un ordre de production
   */
  @Get(':id/pdf')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async downloadPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.productionService.generatePdf(id);
    const order = await this.productionService.findById(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Production-${order.reference}.pdf"`,
    });

    return new StreamableFile(buffer);
  }

  /**
   * GET /api/production/:id
   * Récupère un ordre de production par ID
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.productionService.findById(id);
  }
}
