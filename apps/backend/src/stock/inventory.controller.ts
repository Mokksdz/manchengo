import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductType, UserRole } from '@prisma/client';
import {
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  Min,
  IsEnum,
} from 'class-validator';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INVENTORY CONTROLLER - Endpoints REST pour le process inventaire
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ENDPOINTS:
 *   POST   /inventory/declare          - Déclarer un inventaire
 *   POST   /inventory/:id/validate     - Valider une déclaration
 *   POST   /inventory/:id/reject       - Rejeter une déclaration
 *   GET    /inventory/pending          - Liste des inventaires en attente
 *   GET    /inventory/:id              - Détail d'une déclaration
 *   GET    /inventory/history/:type/:productId - Historique par produit
 *
 * SÉCURITÉ:
 *   - Déclaration: ADMIN, APPRO, PRODUCTION
 *   - Validation/Rejet: ADMIN uniquement
 *   - Compteur ≠ Validateur (enforced in service)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DTOs
// ═══════════════════════════════════════════════════════════════════════════════

class DeclareInventoryDto {
  @IsEnum(['MP', 'PF'])
  productType: ProductType;

  @IsNumber()
  @Min(1)
  productId: number;

  @IsNumber()
  @Min(0)
  declaredQuantity: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidencePhotos?: string[];
}

class ValidateInventoryDto {
  @IsString()
  approvalReason: string;
}

class RejectInventoryDto {
  @IsString()
  rejectionReason: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Déclarer un inventaire (comptage physique)
   * Accessible: ADMIN, APPRO, PRODUCTION
   */
  @Post('declare')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @HttpCode(HttpStatus.CREATED)
  async declareInventory(
    @Body() dto: DeclareInventoryDto,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    const result = await this.inventoryService.declareInventory(
      {
        productType: dto.productType,
        productId: dto.productId,
        declaredQuantity: dto.declaredQuantity,
        notes: dto.notes,
        evidencePhotos: dto.evidencePhotos,
      },
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      data: result,
      message: result.status === 'AUTO_APPROVED'
        ? 'Inventaire auto-approuvé (écart faible)'
        : result.requiresDoubleValidation
          ? 'Inventaire en attente de double validation (écart critique)'
          : 'Inventaire en attente de validation ADMIN',
    };
  }

  /**
   * Valider une déclaration d'inventaire
   * Accessible: ADMIN uniquement
   * Contrainte: Validateur ≠ Compteur
   */
  @Post(':id/validate')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async validateInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValidateInventoryDto,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    const result = await this.inventoryService.validateInventory(
      id,
      dto.approvalReason,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      data: result,
      message: result.status === 'APPROVED'
        ? 'Inventaire approuvé, mouvement créé'
        : 'Première validation effectuée, en attente du 2ème validateur',
    };
  }

  /**
   * Rejeter une déclaration d'inventaire
   * Accessible: ADMIN uniquement
   */
  @Post(':id/reject')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async rejectInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectInventoryDto,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    await this.inventoryService.rejectInventory(
      id,
      dto.rejectionReason,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      message: 'Inventaire rejeté. Un nouveau comptage est requis.',
    };
  }

  /**
   * Liste des inventaires en attente de validation
   * Accessible: ADMIN, APPRO
   */
  @Get('pending')
  @Roles('ADMIN', 'APPRO')
  async getPendingInventories() {
    const pending = await this.inventoryService.getPendingValidations();

    return {
      success: true,
      data: pending,
      count: pending.length,
    };
  }

  /**
   * Détail d'une déclaration d'inventaire
   * Accessible: ADMIN, APPRO, PRODUCTION
   */
  @Get(':id')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  async getDeclaration(@Param('id', ParseIntPipe) id: number) {
    const declaration = await this.inventoryService.getDeclaration(id);

    if (!declaration) {
      return {
        success: false,
        message: 'Déclaration non trouvée',
      };
    }

    return {
      success: true,
      data: declaration,
    };
  }

  /**
   * Historique des inventaires pour un produit
   * Accessible: ADMIN, COMPTABLE
   */
  @Get('history/:productType/:productId')
  @Roles('ADMIN', 'APPRO')
  async getInventoryHistory(
    @Param('productType') productType: ProductType,
    @Param('productId', ParseIntPipe) productId: number,
    @Query('limit') limit?: string,
  ) {
    const history = await this.inventoryService.getDeclarationHistory(
      productType,
      productId,
      limit ? parseInt(limit, 10) : 20,
    );

    return {
      success: true,
      data: history,
      count: history.length,
    };
  }
}
