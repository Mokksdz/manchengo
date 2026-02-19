/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PAGINATION CONTROLLER — Examples & Documentation
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Ce contrôleur fournit des endpoints génériques de pagination pour:
 * - Démontrer l'utilisation de la pagination cursor
 * - Fournir des endpoints réutilisables
 * - Documentation Swagger complète
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  PaginationService,
  CursorPaginatedResult,
  OffsetPaginatedResult,
} from './pagination.service';
import {
  CursorPaginationDto,
  OffsetPaginationDto,
} from './pagination.dto';

@ApiTags('Pagination')
@ApiBearerAuth()
@Controller('paginated')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaginationController {
  constructor(private readonly paginationService: PaginationService) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // MP - MATIÈRES PREMIÈRES
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('mp')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({
    summary: 'Paginated MP list (cursor)',
    description: 'Returns paginated list of raw materials using cursor pagination for optimal performance with large datasets',
  })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (max 100)' })
  @ApiQuery({ name: 'categoryId', required: false, type: Number })
  @ApiQuery({ name: 'criticite', required: false, enum: ['BLOQUANTE', 'CRITIQUE', 'STANDARD'] })
  @ApiQuery({ name: 'isStockTracked', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, description: 'Search in name or code' })
  @ApiResponse({ status: 200, description: 'Paginated list of MPs' })
  async getMp(
    @Query() pagination: CursorPaginationDto,
    @Query('categoryId') categoryId?: number,
    @Query('criticite') criticite?: string,
    @Query('isStockTracked') isStockTracked?: boolean,
    @Query('search') search?: string,
  ): Promise<CursorPaginatedResult<any>> {
    const where: Record<string, unknown> = {};

    if (categoryId) where.categoryId = Number(categoryId);
    if (criticite) where.criticite = criticite;
    if (isStockTracked !== undefined) where.isStockTracked = isStockTracked === true || isStockTracked === 'true' as any;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.paginationService.paginateMp(where, {
      cursor: pagination.cursor,
      limit: pagination.limit,
      direction: pagination.direction,
      sort: pagination.sortBy ? {
        field: pagination.sortBy,
        direction: pagination.sortDirection || 'asc',
      } : undefined,
    });
  }

  @Get('mp/offset')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({
    summary: 'Paginated MP list (offset)',
    description: 'Returns paginated list of raw materials using traditional offset pagination',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of MPs with total count' })
  async getMpOffset(
    @Query() pagination: OffsetPaginationDto,
    @Query('categoryId') categoryId?: number,
    @Query('search') search?: string,
  ): Promise<OffsetPaginatedResult<any>> {
    const where: Record<string, unknown> = { isActive: true };

    if (categoryId) where.categoryId = Number(categoryId);
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.paginationService.offsetPaginate(
      'productMp',
      where,
      {
        page: pagination.page,
        limit: pagination.limit,
        sort: pagination.sortBy ? {
          field: pagination.sortBy,
          direction: pagination.sortDirection || 'asc',
        } : { field: 'code', direction: 'asc' },
      },
      { field: 'code', direction: 'asc' },
      { category: true },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STOCK MOVEMENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('stock-movements')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({
    summary: 'Paginated stock movements (cursor)',
    description: 'Returns paginated list of stock movements with cursor pagination',
  })
  @ApiQuery({ name: 'mpId', required: false, type: Number, description: 'Filter by MP ID' })
  @ApiQuery({ name: 'pfId', required: false, type: Number, description: 'Filter by PF ID' })
  @ApiQuery({ name: 'movementType', required: false, enum: ['IN', 'OUT'] })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Start date (ISO)' })
  @ApiQuery({ name: 'toDate', required: false, description: 'End date (ISO)' })
  @ApiResponse({ status: 200, description: 'Paginated list of stock movements' })
  async getStockMovements(
    @Query() pagination: CursorPaginationDto,
    @Query('mpId') mpId?: number,
    @Query('pfId') pfId?: number,
    @Query('movementType') movementType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<CursorPaginatedResult<any>> {
    const where: Record<string, unknown> = {};

    if (mpId) where.productMpId = Number(mpId);
    if (pfId) where.productPfId = Number(pfId);
    if (movementType) where.movementType = movementType;

    if (fromDate || toDate) {
      where.createdAt = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      };
    }

    return this.paginationService.paginateStockMovements(where, {
      cursor: pagination.cursor,
      limit: pagination.limit,
      direction: pagination.direction,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRODUCTION ORDERS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('production-orders')
  @Roles('ADMIN', 'PRODUCTION')
  @ApiOperation({
    summary: 'Paginated production orders (cursor)',
    description: 'Returns paginated list of production orders',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  @ApiQuery({ name: 'recipeId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of production orders' })
  async getProductionOrders(
    @Query() pagination: CursorPaginationDto,
    @Query('status') status?: string,
    @Query('recipeId') recipeId?: number,
  ): Promise<CursorPaginatedResult<any>> {
    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (recipeId) where.recipeId = Number(recipeId);

    return this.paginationService.paginateProductionOrders(where, {
      cursor: pagination.cursor,
      limit: pagination.limit,
      direction: pagination.direction,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUPPLIERS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('suppliers')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({
    summary: 'Paginated suppliers (cursor)',
    description: 'Returns paginated list of suppliers',
  })
  @ApiQuery({ name: 'grade', required: false, enum: ['A', 'B', 'C'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Paginated list of suppliers' })
  async getSuppliers(
    @Query() pagination: CursorPaginationDto,
    @Query('grade') grade?: string,
    @Query('search') search?: string,
  ): Promise<CursorPaginatedResult<any>> {
    const where: Record<string, unknown> = {};

    if (grade) where.grade = grade;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.paginationService.paginateSuppliers(where, {
      cursor: pagination.cursor,
      limit: pagination.limit,
      direction: pagination.direction,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ALERTS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('alerts')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({
    summary: 'Paginated APPRO alerts (cursor)',
    description: 'Returns paginated list of APPRO alerts',
  })
  @ApiQuery({ name: 'niveau', required: false, enum: ['INFO', 'WARNING', 'CRITICAL'] })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'unacknowledgedOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Paginated list of alerts' })
  async getAlerts(
    @Query() pagination: CursorPaginationDto,
    @Query('niveau') niveau?: string,
    @Query('type') type?: string,
    @Query('unacknowledgedOnly') unacknowledgedOnly?: boolean,
  ): Promise<CursorPaginatedResult<any>> {
    const where: Record<string, unknown> = {};

    if (niveau) where.niveau = niveau;
    if (type) where.type = type;
    if (unacknowledgedOnly === true || unacknowledgedOnly === 'true' as any) {
      where.acknowledgedAt = null;
    }

    return this.paginationService.paginateApproAlerts(where, {
      cursor: pagination.cursor,
      limit: pagination.limit,
      direction: pagination.direction,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('audit-logs')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Paginated audit logs (cursor)',
    description: 'Returns paginated audit logs for admin investigation',
  })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'severity', required: false, enum: ['INFO', 'WARNING', 'CRITICAL', 'SECURITY'] })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiResponse({ status: 200, description: 'Paginated audit logs' })
  async getAuditLogs(
    @Query() pagination: CursorPaginationDto,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('severity') severity?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<CursorPaginatedResult<any>> {
    const where: Record<string, unknown> = {};

    if (action) where.action = action;
    if (actorId) where.actorId = actorId;
    if (entityType) where.entityType = entityType;
    if (severity) where.severity = severity;

    if (fromDate || toDate) {
      where.timestamp = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      };
    }

    return this.paginationService.paginateAuditLogs(where, {
      cursor: pagination.cursor,
      limit: pagination.limit,
      direction: pagination.direction,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PURCHASE ORDERS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('purchase-orders')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({
    summary: 'Paginated purchase orders (cursor)',
    description: 'Returns paginated list of purchase orders',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CANCELLED'] })
  @ApiQuery({ name: 'supplierId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of purchase orders' })
  async getPurchaseOrders(
    @Query() pagination: CursorPaginationDto,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: number,
  ): Promise<CursorPaginatedResult<any>> {
    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (supplierId) where.supplierId = Number(supplierId);

    return this.paginationService.paginatePurchaseOrders(where, {
      cursor: pagination.cursor,
      limit: pagination.limit,
      direction: pagination.direction,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOTS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('lots')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({
    summary: 'Paginated lots (cursor)',
    description: 'Returns paginated list of lots',
  })
  @ApiQuery({ name: 'mpId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'CONSUMED', 'EXPIRED'] })
  @ApiQuery({ name: 'expiringBefore', required: false, description: 'Filter lots expiring before date' })
  @ApiResponse({ status: 200, description: 'Paginated list of lots' })
  async getLots(
    @Query() pagination: CursorPaginationDto,
    @Query('mpId') mpId?: number,
    @Query('status') status?: string,
    @Query('expiringBefore') expiringBefore?: string,
  ): Promise<CursorPaginatedResult<any>> {
    const where: Record<string, unknown> = {};

    if (mpId) where.productMpId = Number(mpId);
    if (status) where.status = status;
    if (expiringBefore) {
      where.dlc = { lte: new Date(expiringBefore) };
    }

    return this.paginationService.paginateLots(where, {
      cursor: pagination.cursor,
      limit: pagination.limit,
      direction: pagination.direction,
    });
  }
}
