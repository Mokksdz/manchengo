import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateReceptionDto,
  AdjustInventoryMpDto,
  AdjustInventoryPfDto,
  DeclareLossDto,
  MovementsQueryDto,
} from './dto';

@ApiTags('Stock')
@ApiBearerAuth()
@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK MP
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('mp')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({ summary: 'Liste stock Matières Premières (calculé)' })
  async getStockMp(@Request() req: any) {
    const data = await this.stockService.getStockMp();
    // PRODUCTION: masquer les données financières
    if (req.user?.role === 'PRODUCTION') {
      return data.map(item => ({
        productId: item.productId,
        code: item.code,
        name: item.name,
        unit: item.unit,
        minStock: item.minStock,
        currentStock: item.currentStock,
        status: item.status,
        lastMovementAt: item.lastMovementAt,
        // Masquer: priceHt, stockValue
      }));
    }
    return data;
  }

  @Get('mp/:id/stock')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({ summary: 'Stock actuel d\'une MP' })
  async getStockMpById(@Param('id', ParseIntPipe) id: number) {
    const stock = await this.stockService.calculateStock('MP', id);
    return { productId: id, productType: 'MP', currentStock: stock };
  }

  @Get('mp/:id/movements')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({ summary: 'Historique mouvements d\'une MP' })
  async getMovementsMp(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: MovementsQueryDto,
  ) {
    return this.stockService.getMovements('MP', id, query.limit ?? 50);
  }

  @Post('mp/receptions')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ summary: 'Créer une réception MP (Achat fournisseur)' })
  async createReception(@Body() dto: CreateReceptionDto, @Request() req: any) {
    return this.stockService.createReception(
      {
        supplierId: dto.supplierId,
        date: new Date(dto.date),
        blNumber: dto.blNumber,
        note: dto.note,
        lines: dto.lines.map(line => ({
          ...line,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : undefined,
          manufactureDate: line.manufactureDate ? new Date(line.manufactureDate) : undefined,
        })),
      },
      req.user.id,
      req.user.role,
    );
  }

  @Post('mp/inventory')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ajustement inventaire MP (ADMIN uniquement)' })
  async adjustInventoryMp(@Body() dto: AdjustInventoryMpDto, @Request() req: any) {
    return this.stockService.adjustInventory(
      {
        productType: 'MP',
        productId: dto.productId,
        physicalQuantity: dto.physicalQuantity,
        reason: dto.reason,
      },
      req.user.id,
      req.user.role,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK PF
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('pf')
  @Roles('ADMIN', 'COMMERCIAL', 'PRODUCTION')
  @ApiOperation({ summary: 'Liste stock Produits Finis (calculé)' })
  async getStockPf(@Request() req: any) {
    const data = await this.stockService.getStockPf();
    // PRODUCTION: masquer les données financières
    if (req.user?.role === 'PRODUCTION') {
      return data.map(item => ({
        productId: item.productId,
        code: item.code,
        name: item.name,
        unit: item.unit,
        minStock: item.minStock,
        currentStock: item.currentStock,
        status: item.status,
        lastMovementAt: item.lastMovementAt,
        // Masquer: priceHt, stockValue
      }));
    }
    return data;
  }

  @Get('pf/:id/stock')
  @Roles('ADMIN', 'COMMERCIAL', 'PRODUCTION')
  @ApiOperation({ summary: 'Stock actuel d\'un PF' })
  async getStockPfById(@Param('id', ParseIntPipe) id: number) {
    const stock = await this.stockService.calculateStock('PF', id);
    return { productId: id, productType: 'PF', currentStock: stock };
  }

  @Get('pf/:id/movements')
  @Roles('ADMIN', 'COMMERCIAL', 'PRODUCTION')
  @ApiOperation({ summary: 'Historique mouvements d\'un PF' })
  async getMovementsPf(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: MovementsQueryDto,
  ) {
    return this.stockService.getMovements('PF', id, query.limit ?? 50);
  }

  @Post('pf/inventory')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ajustement inventaire PF (ADMIN uniquement)' })
  async adjustInventoryPf(@Body() dto: AdjustInventoryPfDto, @Request() req: any) {
    return this.stockService.adjustInventory(
      {
        productType: 'PF',
        productId: dto.productId,
        physicalQuantity: dto.physicalQuantity,
        reason: dto.reason,
      },
      req.user.id,
      req.user.role,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTION — DEPRECATED: Use POST /production/:id/complete instead
  // The ProductionService.complete() handles lot creation, yield tracking,
  // and proper FIFO consumption reversal. This endpoint is kept for
  // backward compatibility but should NOT be used.
  // ═══════════════════════════════════════════════════════════════════════════

  // Route removed — use POST /api/production/:id/complete (ProductionController)

  // ═══════════════════════════════════════════════════════════════════════════
  // PERTES
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('loss')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Déclarer une perte MP/PF (ADMIN uniquement)' })
  async declareLoss(@Body() dto: DeclareLossDto, @Request() req: any) {
    return this.stockService.declareLoss(
      {
        productType: dto.productType,
        productId: dto.productId,
        lotId: dto.lotId,
        quantity: dto.quantity,
        reason: dto.reason,
        description: dto.description,
        evidencePhotos: dto.evidencePhotos,
      },
      req.user.id,
      req.user.role,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ALERTES & VALEUR
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('alerts')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({ summary: 'Alertes stock (ruptures et sous seuil)' })
  async getStockAlerts() {
    return this.stockService.getStockAlerts();
  }

  @Get('value')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ summary: 'Valeur totale du stock PF' })
  async getTotalStockValue() {
    return this.stockService.getTotalStockValue();
  }
}
