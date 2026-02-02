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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { RecipeService } from './recipe.service';

// ═══════════════════════════════════════════════════════════════════════════════
// RECIPE CONTROLLER - Gestion des recettes de production
// ═══════════════════════════════════════════════════════════════════════════════

@Controller('recipes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  /**
   * GET /api/recipes
   * Liste toutes les recettes
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async findAll(@Query('includeInactive') includeInactive?: string) {
    return this.recipeService.findAll(includeInactive === 'true');
  }

  /**
   * GET /api/recipes/product/:productPfId
   * Récupère la recette d'un produit fini
   * NOTE: Cette route DOIT être avant :id pour éviter le conflit
   */
  @Get('product/:productPfId')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async findByProductPfId(@Param('productPfId', ParseIntPipe) productPfId: number) {
    const recipe = await this.recipeService.findByProductPfId(productPfId);
    return recipe || null;
  }

  /**
   * GET /api/recipes/:id
   * Récupère une recette par ID
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.recipeService.findById(id);
  }

  /**
   * POST /api/recipes
   * Crée une nouvelle recette
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: {
      productPfId: number;
      name: string;
      description?: string;
      batchWeight: number;
      outputQuantity: number;
      lossTolerance?: number;
      productionTime?: number;
      shelfLifeDays?: number;
      items: {
        type?: 'MP' | 'FLUID' | 'PACKAGING';
        productMpId?: number;
        name?: string;
        quantity: number;
        unit: string;
        unitCost?: number;
        affectsStock?: boolean;
        isMandatory?: boolean;
        isSubstitutable?: boolean;
        substituteIds?: number[];
        sortOrder?: number;
        notes?: string;
      }[];
    },
    @CurrentUser() user: { id: string },
  ) {
    return this.recipeService.create(dto, user.id);
  }

  /**
   * PUT /api/recipes/:id
   * Met à jour une recette (paramètres uniquement)
   */
  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: {
      name?: string;
      description?: string;
      batchWeight?: number;
      outputQuantity?: number;
      lossTolerance?: number;
      productionTime?: number;
      shelfLifeDays?: number;
      isActive?: boolean;
    },
  ) {
    return this.recipeService.update(id, dto);
  }

  /**
   * POST /api/recipes/:id/items
   * Ajoute un item à une recette
   */
  @Post(':id/items')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: {
      type?: 'MP' | 'FLUID' | 'PACKAGING';
      productMpId?: number;
      name?: string;
      quantity: number;
      unit: string;
      unitCost?: number;
      affectsStock?: boolean;
      isMandatory?: boolean;
      isSubstitutable?: boolean;
      substituteIds?: number[];
      sortOrder?: number;
      notes?: string;
    },
  ) {
    return this.recipeService.addItem(id, dto as any);
  }

  /**
   * PUT /api/recipes/:id/items/:itemId
   * Met à jour un item de recette
   */
  @Put(':id/items/:itemId')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: {
      quantity?: number;
      unit?: string;
      isMandatory?: boolean;
      isSubstitutable?: boolean;
      substituteIds?: number[];
      sortOrder?: number;
      notes?: string;
    },
  ) {
    return this.recipeService.updateItem(id, itemId, dto);
  }

  /**
   * DELETE /api/recipes/:id/items/:itemId
   * Supprime un item de recette
   */
  @Delete(':id/items/:itemId')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.recipeService.removeItem(id, itemId);
  }

  /**
   * GET /api/recipes/:id/requirements
   * Calcule les besoins en MP pour une quantité donnée
   */
  @Get(':id/requirements')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async calculateRequirements(
    @Param('id', ParseIntPipe) id: number,
    @Query('batchCount') batchCount: string,
  ) {
    return this.recipeService.calculateRequirements(id, parseInt(batchCount) || 1);
  }

  /**
   * GET /api/recipes/:id/check-stock
   * Vérifie la disponibilité des stocks pour une production
   */
  @Get(':id/check-stock')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION)
  async checkStockAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Query('batchCount') batchCount: string,
  ) {
    return this.recipeService.checkStockAvailability(id, parseInt(batchCount) || 1);
  }
}
