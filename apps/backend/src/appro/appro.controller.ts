/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * APPRO CONTROLLER - API APPROVISIONNEMENT INDUSTRIEL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Endpoints exposés:
 * - GET  /appro/dashboard           → Dashboard complet APPRO
 * - GET  /appro/stock-mp            → Liste MP avec état calculé
 * - GET  /appro/stock-mp/critical   → MP critiques uniquement
 * - GET  /appro/requisitions/suggested → Suggestions automatiques
 * - GET  /appro/suppliers/performance → Performance fournisseurs
 * - GET  /appro/alerts              → Alertes actives
 * - POST /appro/check-production    → Vérifier si production possible
 * - POST /appro/update-metrics      → Recalculer les métriques (admin)
 * - PATCH /appro/stock-mp/:id       → Mettre à jour les champs APPRO d'une MP
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApproService } from './appro.service';
import { ApproAlertService } from './appro-alert.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  UpdateProductMpApproDto,
  StockMpQueryDto,
  CheckProductionDto,
  DashboardResponseDto,
  ProductionCheckResponseDto,
  RequisitionSuggestionDto,
  SupplierPerformanceDto,
} from './dto/appro.dto';

@ApiTags('Appro')
@ApiBearerAuth()
@Controller('appro')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApproController {
  constructor(
    private readonly approService: ApproService,
    private readonly approAlertService: ApproAlertService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('dashboard')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Dashboard APPRO', 
    description: 'Retourne le tableau de bord complet avec IRS, MP critiques, stats et alertes' 
  })
  @ApiResponse({ status: 200, description: 'Dashboard APPRO', type: DashboardResponseDto })
  async getDashboard() {
    return this.approService.getDashboard();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STOCK MP
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('stock-mp')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({ 
    summary: 'Liste Stock MP avec état', 
    description: 'Retourne toutes les MP avec leur état calculé (SAIN, SOUS_SEUIL, A_COMMANDER, RUPTURE, BLOQUANT_PRODUCTION)' 
  })
  async getStockMp(@Query() query: StockMpQueryDto) {
    const stockMp = await this.approService.getStockMpWithState();
    
    // Filtrer si nécessaire
    let filtered = stockMp;
    
    if (query.state) {
      filtered = filtered.filter(mp => mp.state === query.state);
    }
    
    if (query.criticite) {
      filtered = filtered.filter(mp => mp.criticiteEffective === query.criticite);
    }
    
    if (query.criticalOnly) {
      filtered = await this.approService.getCriticalMp();
    }
    
    return filtered;
  }

  @Get('stock-mp/critical')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({ 
    summary: 'MP Critiques', 
    description: 'Retourne uniquement les MP à risque pour la production' 
  })
  async getCriticalMp() {
    return this.approService.getCriticalMp();
  }

  @Patch('stock-mp/:id')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Mettre à jour les paramètres APPRO d\'une MP', 
    description: 'Permet de définir les seuils, lead time, criticité et fournisseur principal. Validation: seuilCommande doit être > seuilSecurite' 
  })
  async updateProductMpAppro(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductMpApproDto,
  ) {
    return this.approService.updateProductMpAppro(id, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUGGESTIONS DE RÉQUISITIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('requisitions/suggested')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Suggestions de réquisitions', 
    description: 'Génère automatiquement des suggestions de commandes basées sur l\'état du stock, la consommation et les lead times' 
  })
  @ApiResponse({ status: 200, description: 'Liste des suggestions', type: [RequisitionSuggestionDto] })
  async getSuggestedRequisitions() {
    return this.approService.generateSuggestedRequisitions();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PERFORMANCE FOURNISSEURS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('suppliers/performance')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Performance fournisseurs', 
    description: 'Retourne les métriques de performance de tous les fournisseurs (délais, taux de retard, score)' 
  })
  @ApiResponse({ status: 200, description: 'Liste des performances', type: [SupplierPerformanceDto] })
  async getSuppliersPerformance() {
    return this.approService.getSuppliersPerformance();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ALERTES
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('alerts')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Alertes APPRO actives', 
    description: 'Retourne les alertes stock et fournisseur actives' 
  })
  async getAlerts() {
    return this.approService.getActiveAlerts();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VÉRIFICATIONS PRODUCTION
  // ═══════════════════════════════════════════════════════════════════════════════

  @Post('check-production')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({ 
    summary: 'Vérifier si production possible', 
    description: 'Vérifie si toutes les MP nécessaires sont disponibles pour lancer une production. Retourne la liste des MP bloquantes si non.' 
  })
  @ApiResponse({ status: 200, description: 'Résultat de la vérification', type: ProductionCheckResponseDto })
  async checkProduction(@Body() dto: CheckProductionDto) {
    return this.approService.canStartProduction(dto.recipeId, dto.batchCount);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ADMINISTRATION
  // ═══════════════════════════════════════════════════════════════════════════════

  @Post('update-metrics')
  @Roles('ADMIN')
  @ApiOperation({ 
    summary: 'Recalculer les métriques MP', 
    description: 'Force le recalcul des métriques de consommation et jours de couverture pour toutes les MP. Normalement exécuté en batch quotidien.' 
  })
  async updateMetrics() {
    return this.approService.updateAllMpMetrics();
  }

  @Post('check-alerts')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Vérifier et créer les alertes', 
    description: 'Vérifie l\'état des MP et crée les alertes nécessaires pour les MP critiques' 
  })
  async checkAlerts() {
    return this.approAlertService.scanAndCreateAlerts();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ALERTES APPRO V1.2 - Audit Ready
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('alerts/all')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Toutes les alertes APPRO', 
    description: 'Retourne toutes les alertes APPRO (accusées et non accusées)' 
  })
  async getAllApproAlerts() {
    return this.approAlertService.getAllAlerts();
  }

  @Get('alerts/active')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Alertes actives (non accusées)', 
    description: 'Retourne uniquement les alertes non encore accusées de réception' 
  })
  async getActiveApproAlerts() {
    return this.approAlertService.getActiveAlerts();
  }

  @Get('alerts/critical')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({ 
    summary: 'Alertes critiques non accusées', 
    description: 'Retourne les alertes CRITICAL non accusées. Ces alertes DOIVENT être visibles partout.' 
  })
  async getCriticalAlerts() {
    return this.approAlertService.getCriticalUnacknowledgedAlerts();
  }

  @Get('alerts/counts')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Compteurs d\'alertes', 
    description: 'Retourne les compteurs d\'alertes par niveau et statut' 
  })
  async getAlertCounts() {
    return this.approAlertService.getAlertCounts();
  }

  @Post('alerts/:id/acknowledge')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Accuser réception d\'une alerte', 
    description: 'Marque une alerte comme vue. OBLIGATOIRE pour les alertes CRITICAL. Traçabilité: qui a vu quoi, quand.' 
  })
  async acknowledgeAlert(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: string },
  ) {
    return this.approAlertService.acknowledgeAlert(id, user.id);
  }

  @Post('alerts/mp/:mpId/postpone')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Reporter une alerte MP V1', 
    description: 'Reporter une alerte pour une MP avec motif obligatoire. Traçabilité audit. RUPTURE non reportable.' 
  })
  async postponeMpAlert(
    @Param('mpId', ParseIntPipe) mpId: number,
    @Body() data: { duration: string; reason: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.approAlertService.postponeMpAlert(mpId, data.duration, data.reason, user.id);
  }

  @Post('alerts/scan')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ 
    summary: 'Scanner et créer les alertes', 
    description: 'Scan complet: MP critiques, ruptures imminentes, fournisseurs en retard. Crée les alertes nécessaires.' 
  })
  async scanAlerts() {
    return this.approAlertService.scanAndCreateAlerts();
  }
}
