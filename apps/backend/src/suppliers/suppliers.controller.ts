import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto, BlockSupplierDto, SurveillanceSupplierDto } from './dto/supplier.dto';

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIERS CONTROLLER - Endpoints REST pour gestion fournisseurs
// ═══════════════════════════════════════════════════════════════════════════════
// Sécurité: ADMIN uniquement pour création/modification
// GET accessible à ADMIN et APPRO (pour sélection lors des réceptions)
// ═══════════════════════════════════════════════════════════════════════════════

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  /**
   * GET /api/suppliers
   * Liste tous les fournisseurs (actifs par défaut)
   * Query: ?includeInactive=true pour inclure les désactivés
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.APPRO)
  async findAll(@Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true';
    return this.suppliersService.findAll(include);
  }

  /**
   * GET /api/suppliers/:id
   * Récupère un fournisseur par son ID
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.APPRO)
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.findById(id);
  }

  /**
   * GET /api/suppliers/:id/can-delete
   * Vérifie si un fournisseur peut être supprimé
   */
  @Get(':id/can-delete')
  @Roles(UserRole.ADMIN)
  async canDelete(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.canDelete(id);
  }

  /**
   * POST /api/suppliers
   * Crée un nouveau fournisseur
   * ADMIN et APPRO
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.APPRO)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  /**
   * PUT /api/suppliers/:id
   * Met à jour un fournisseur existant
   * ADMIN uniquement
   */
  @Put(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(id, dto);
  }

  /**
   * DELETE /api/suppliers/:id
   * Désactive un fournisseur (soft delete)
   * ADMIN uniquement
   * Note: La suppression réelle est interdite si des réceptions existent
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.deactivate(id);
  }

  /**
   * GET /api/suppliers/:id/history
   * Historique des réceptions d'un fournisseur avec filtres temporels
   * Query params: year, month, from, to, page, limit
   */
  @Get(':id/history')
  @Roles(UserRole.ADMIN, UserRole.APPRO)
  async getHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.suppliersService.getHistory(id, {
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CHAÎNE D'IMPACT FOURNISSEURS — DONNÉES RÉELLES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/suppliers/impacts
   * Retourne tous les fournisseurs avec leur impact réel
   * Données 100% traçables, zéro mock
   */
  @Get('impacts')
  @Roles(UserRole.ADMIN, UserRole.APPRO)
  async getSupplierImpacts() {
    return this.suppliersService.getSupplierImpacts();
  }

  /**
   * GET /api/suppliers/:id/impact-chain
   * Retourne la chaîne d'impact complète d'un fournisseur
   */
  @Get(':id/impact-chain')
  @Roles(UserRole.ADMIN, UserRole.APPRO)
  async getSupplierImpactChain(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.getSupplierImpactChain(id);
  }

  /**
   * PUT /api/suppliers/:id/block
   * Bloque temporairement un fournisseur
   * ADMIN uniquement - Motif obligatoire
   */
  @Put(':id/block')
  @Roles(UserRole.ADMIN)
  async blockSupplier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BlockSupplierDto,
    @Req() req: any,
  ) {
    return this.suppliersService.blockSupplier(id, dto, req.user.id);
  }

  /**
   * PUT /api/suppliers/:id/surveillance
   * Met un fournisseur sous surveillance
   * ADMIN uniquement - Motif obligatoire
   */
  @Put(':id/surveillance')
  @Roles(UserRole.ADMIN)
  async setSupplierSurveillance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SurveillanceSupplierDto,
    @Req() req: any,
  ) {
    return this.suppliersService.setSupplierSurveillance(id, dto, req.user.id);
  }
}
