import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { LotsService } from './lots.service';

// ═══════════════════════════════════════════════════════════════════════════════
// LOTS CONTROLLER - V1.1 Traçabilité sanitaire
// ═══════════════════════════════════════════════════════════════════════════════

@Controller('lots')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LOTS MP
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/lots/mp
   * Liste tous les lots MP actifs
   */
  @Get('mp')
  @Roles(UserRole.ADMIN, UserRole.APPRO, UserRole.PRODUCTION)
  async findAllMp(
    @Query('productId') productId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.lotsService.findLotsMp(
      productId ? parseInt(productId, 10) : undefined,
      includeInactive === 'true',
    );
  }

  /**
   * GET /api/lots/mp/:productId/stock
   * Vérifie le stock disponible (hors expirés)
   */
  @Get('mp/:productId/stock')
  @Roles(UserRole.ADMIN, UserRole.APPRO, UserRole.PRODUCTION)
  async checkMpStock(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('quantity') quantity?: string,
  ) {
    const qty = quantity ? parseInt(quantity, 10) : 0;
    if (qty > 0) {
      return this.lotsService.canConsumeMp(productId, qty);
    }

    const lots = await this.lotsService.findLotsMp(productId);
    const availableStock = lots
      .filter((l) => l.status !== 'EXPIRED')
      .reduce((sum, l) => sum + l.quantityRemaining, 0);
    const expiredLots = lots.filter((l) => l.status === 'EXPIRED').length;

    return { availableStock, expiredLots, totalLots: lots.length };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOTS PF
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/lots/pf
   * Liste tous les lots PF actifs
   */
  @Get('pf')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION, UserRole.COMMERCIAL)
  async findAllPf(
    @Query('productId') productId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.lotsService.findLotsPf(
      productId ? parseInt(productId, 10) : undefined,
      includeInactive === 'true',
    );
  }

  /**
   * GET /api/lots/pf/:productId/stock
   * Vérifie le stock disponible pour vente
   */
  @Get('pf/:productId/stock')
  @Roles(UserRole.ADMIN, UserRole.PRODUCTION, UserRole.COMMERCIAL)
  async checkPfStock(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('quantity') quantity?: string,
  ) {
    const qty = quantity ? parseInt(quantity, 10) : 0;
    if (qty > 0) {
      return this.lotsService.canSellPf(productId, qty);
    }

    const lots = await this.lotsService.findLotsPf(productId);
    const availableStock = lots
      .filter((l) => l.status !== 'EXPIRED')
      .reduce((sum, l) => sum + l.quantityRemaining, 0);
    const expiredLots = lots.filter((l) => l.status === 'EXPIRED').length;

    return { availableStock, expiredLots, totalLots: lots.length };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ALERTES DLC
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/lots/expiring
   * Lots bientôt expirés ou expirés
   */
  @Get('expiring')
  @Roles(UserRole.ADMIN, UserRole.APPRO, UserRole.PRODUCTION)
  async getExpiringLots(@Query('days') days?: string) {
    const withinDays = days ? parseInt(days, 10) : 7;
    return this.lotsService.getExpiringLots(withinDays);
  }

  /**
   * GET /api/lots/expired
   * Lots expirés uniquement
   */
  @Get('expired')
  @Roles(UserRole.ADMIN)
  async getExpiredLots() {
    return this.lotsService.getExpiredLots();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AJUSTEMENT INVENTAIRE (ADMIN)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/lots/mp/:id/adjust
   * Ajuste la quantité d'un lot MP
   */
  @Post('mp/:id/adjust')
  @Roles(UserRole.ADMIN)
  async adjustLotMp(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { quantity: number },
  ) {
    return this.lotsService.adjustLotMp(id, body.quantity);
  }

  /**
   * POST /api/lots/pf/:id/adjust
   * Ajuste la quantité d'un lot PF
   */
  @Post('pf/:id/adjust')
  @Roles(UserRole.ADMIN)
  async adjustLotPf(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { quantity: number },
  ) {
    return this.lotsService.adjustLotPf(id, body.quantity);
  }
}
