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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ProductsService } from './products.service';
import {
  CreateProductMpDto,
  UpdateProductMpDto,
  CreateProductPfDto,
  UpdateProductPfDto,
} from './dto/product.dto';

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS CONTROLLER - Endpoints REST pour gestion des articles
// ═══════════════════════════════════════════════════════════════════════════════
// Sécurité: ADMIN uniquement pour création/modification
// GET accessible à tous les rôles authentifiés
// ═══════════════════════════════════════════════════════════════════════════════

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUITS MP (Matières Premières)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/products/mp
   * Liste tous les produits MP (actifs par défaut)
   */
  @Get('mp')
  @Roles(UserRole.ADMIN, UserRole.APPRO, UserRole.PRODUCTION)
  async findAllMp(@Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true';
    return this.productsService.findAllMp(include);
  }

  /**
   * GET /api/products/packaging
   * Liste tous les produits d'emballage (category = PACKAGING)
   */
  @Get('packaging')
  @Roles(UserRole.ADMIN, UserRole.APPRO, UserRole.PRODUCTION)
  async findAllPackaging() {
    return this.productsService.findAllPackaging();
  }

  /**
   * GET /api/products/raw-materials
   * Liste toutes les matières premières (category = RAW_MATERIAL)
   */
  @Get('raw-materials')
  @Roles(UserRole.ADMIN, UserRole.APPRO, UserRole.PRODUCTION)
  async findAllRawMaterials() {
    return this.productsService.findAllRawMaterials();
  }

  /**
   * GET /api/products/mp/:id
   * Récupère un produit MP par son ID
   */
  @Get('mp/:id')
  @Roles(UserRole.ADMIN, UserRole.APPRO, UserRole.PRODUCTION)
  async findMpById(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findMpById(id);
  }

  /**
   * GET /api/products/mp/:id/can-delete
   * Vérifie si un produit MP peut être supprimé
   */
  @Get('mp/:id/can-delete')
  @Roles(UserRole.ADMIN)
  async canDeleteMp(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.canDeleteMp(id);
  }

  /**
   * GET /api/products/mp/next-code
   * Génère le prochain code MP disponible
   */
  @Get('mp/next-code')
  @Roles(UserRole.ADMIN, UserRole.APPRO)
  async getNextMpCode() {
    return this.productsService.getNextMpCode();
  }

  /**
   * POST /api/products/mp
   * Crée un nouveau produit MP
   */
  @Post('mp')
  @Roles(UserRole.ADMIN, UserRole.APPRO)
  @HttpCode(HttpStatus.CREATED)
  async createMp(@Body() dto: CreateProductMpDto) {
    return this.productsService.createMp(dto);
  }

  /**
   * PUT /api/products/mp/:id
   * Met à jour un produit MP existant
   */
  @Put('mp/:id')
  @Roles(UserRole.ADMIN)
  async updateMp(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductMpDto,
  ) {
    return this.productsService.updateMp(id, dto);
  }

  /**
   * DELETE /api/products/mp/:id
   * Désactive un produit MP (soft delete)
   */
  @Delete('mp/:id')
  @Roles(UserRole.ADMIN)
  async deactivateMp(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deactivateMp(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUITS PF (Produits Finis)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/products/pf
   * Liste tous les produits PF (actifs par défaut)
   */
  @Get('pf')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION, UserRole.COMMERCIAL)
  async findAllPf(@Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true';
    return this.productsService.findAllPf(include);
  }

  /**
   * GET /api/products/pf/:id
   * Récupère un produit PF par son ID
   */
  @Get('pf/:id')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION, UserRole.COMMERCIAL)
  async findPfById(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findPfById(id);
  }

  /**
   * GET /api/products/pf/:id/can-delete
   * Vérifie si un produit PF peut être supprimé
   */
  @Get('pf/:id/can-delete')
  @Roles(UserRole.ADMIN)
  async canDeletePf(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.canDeletePf(id);
  }

  /**
   * POST /api/products/pf
   * Crée un nouveau produit PF
   */
  @Post('pf')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createPf(@Body() dto: CreateProductPfDto) {
    return this.productsService.createPf(dto);
  }

  /**
   * PUT /api/products/pf/:id
   * Met à jour un produit PF existant
   */
  @Put('pf/:id')
  @Roles(UserRole.ADMIN)
  async updatePf(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductPfDto,
  ) {
    return this.productsService.updatePf(id, dto);
  }

  /**
   * DELETE /api/products/pf/:id
   * Désactive un produit PF (soft delete)
   */
  @Delete('pf/:id')
  @Roles(UserRole.ADMIN)
  async deactivatePf(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deactivatePf(id);
  }
}
