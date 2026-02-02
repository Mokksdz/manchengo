import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DemandesMpService, CreateDemandeDto, UpdateDemandeDto, ValidateDemandeDto, RejectDemandeDto } from './demandes-mp.service';
import { DemandeApproStatus } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// DEMANDES MP CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════
// Endpoints pour les demandes d'approvisionnement MP
// PRODUCTION: créer, modifier, envoyer, supprimer ses demandes
// ADMIN/APPRO: valider, rejeter, transformer en réception
// ═══════════════════════════════════════════════════════════════════════════════

@ApiTags('Demandes MP')
@ApiBearerAuth()
@Controller('demandes-mp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DemandesMpController {
  constructor(private readonly demandesMpService: DemandesMpService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD (PRODUCTION)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/demandes-mp
   * Créer une nouvelle demande d'approvisionnement
   * PRODUCTION uniquement
   */
  @Post()
  @Roles('PRODUCTION', 'ADMIN')
  @ApiOperation({ summary: 'Créer une demande d\'approvisionnement MP' })
  async create(@Body() dto: CreateDemandeDto, @Request() req: any) {
    return this.demandesMpService.create(dto, req.user.id, req.user.role);
  }

  /**
   * GET /api/demandes-mp
   * Lister les demandes
   * PRODUCTION: ses propres demandes
   * ADMIN/APPRO: toutes les demandes
   */
  @Get()
  @Roles('PRODUCTION', 'ADMIN', 'APPRO')
  @ApiOperation({ summary: 'Lister les demandes d\'approvisionnement' })
  @ApiQuery({ name: 'status', required: false, enum: ['BROUILLON', 'SOUMISE', 'VALIDEE', 'REJETEE', 'EN_COURS_COMMANDE', 'COMMANDEE', 'RECEPTIONNEE', 'ENVOYEE', 'TRANSFORMEE'] })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async findAll(
    @Request() req: any,
    @Query('status') status?: DemandeApproStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.demandesMpService.findAll(req.user.id, req.user.role, {
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /**
   * GET /api/demandes-mp/stats
   * Statistiques des demandes
   */
  @Get('stats')
  @Roles('PRODUCTION', 'ADMIN', 'APPRO')
  @ApiOperation({ summary: 'Statistiques des demandes' })
  async getStats(@Request() req: any) {
    return this.demandesMpService.getStats(req.user.id, req.user.role);
  }

  /**
   * GET /api/demandes-mp/:id
   * Détail d'une demande
   */
  @Get(':id')
  @Roles('PRODUCTION', 'ADMIN', 'APPRO')
  @ApiOperation({ summary: 'Détail d\'une demande' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.demandesMpService.findOne(id, req.user.id, req.user.role);
  }

  /**
   * PUT /api/demandes-mp/:id
   * Modifier une demande (BROUILLON uniquement)
   */
  @Put(':id')
  @Roles('PRODUCTION', 'ADMIN')
  @ApiOperation({ summary: 'Modifier une demande (BROUILLON)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDemandeDto,
    @Request() req: any,
  ) {
    return this.demandesMpService.update(id, dto, req.user.id, req.user.role);
  }

  /**
   * POST /api/demandes-mp/:id/envoyer
   * Soumettre une demande (BROUILLON → SOUMISE)
   */
  @Post(':id/envoyer')
  @Roles('PRODUCTION', 'ADMIN')
  @ApiOperation({ summary: 'Soumettre une demande pour validation' })
  async envoyer(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.demandesMpService.envoyer(id, req.user.id, req.user.role);
  }

  /**
   * DELETE /api/demandes-mp/:id
   * Supprimer une demande (BROUILLON uniquement)
   */
  @Delete(':id')
  @Roles('PRODUCTION', 'ADMIN')
  @ApiOperation({ summary: 'Supprimer une demande (BROUILLON)' })
  async delete(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.demandesMpService.delete(id, req.user.id, req.user.role);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION (ADMIN / APPRO)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/demandes-mp/:id/valider
   * Valider une demande (ADMIN/APPRO uniquement)
   */
  @Post(':id/valider')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ summary: 'Valider une demande' })
  async valider(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValidateDemandeDto,
    @Request() req: any,
  ) {
    return this.demandesMpService.valider(id, dto, req.user.id, req.user.role);
  }

  /**
   * POST /api/demandes-mp/:id/rejeter
   * Rejeter une demande (ADMIN/APPRO uniquement)
   */
  @Post(':id/rejeter')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ summary: 'Rejeter une demande' })
  async rejeter(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectDemandeDto,
    @Request() req: any,
  ) {
    return this.demandesMpService.rejeter(id, dto, req.user.id, req.user.role);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFORMATION EN RÉCEPTION (ADMIN / APPRO uniquement)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/demandes-mp/:id/transformer
   * Transformer une demande VALIDÉE en Réception MP
   * - RBAC: ADMIN / APPRO uniquement (PRODUCTION → 403)
   * - Une demande ne peut être transformée qu'UNE SEULE FOIS
   * - Crée une réception en statut DRAFT (EN_ATTENTE)
   */
  @Post(':id/transformer')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ summary: 'Transformer une demande validée en réception MP' })
  async transformer(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.demandesMpService.transformer(id, req.user.id, req.user.role);
  }
}
