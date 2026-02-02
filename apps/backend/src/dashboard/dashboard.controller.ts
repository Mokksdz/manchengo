import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const MAX_DAYS = 365;
const MAX_LIMIT = 100;

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  // A8+A25: KPIs contain sales data → exclude PRODUCTION role
  @Get('kpis')
  @Roles('ADMIN', 'COMMERCIAL', 'APPRO')
  @ApiOperation({ summary: 'Get main KPIs' })
  async getKpis() {
    return this.dashboardService.getKpis();
  }

  // A25: Sales chart data → restrict to ADMIN and COMMERCIAL
  @Get('charts/sales')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({ summary: 'Get sales chart data' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days (default: 7)' })
  async getSalesChart(@Query('days') days?: string) {
    const parsedDays = days ? Math.min(Math.max(parseInt(days) || 7, 1), MAX_DAYS) : 7;
    return this.dashboardService.getSalesChart(parsedDays);
  }

  // A25: Production chart → ADMIN + PRODUCTION
  @Get('charts/production')
  @Roles('ADMIN', 'PRODUCTION')
  @ApiOperation({ summary: 'Get production chart data' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days (default: 7)' })
  async getProductionChart(@Query('days') days?: string) {
    const parsedDays = days ? Math.min(Math.max(parseInt(days) || 7, 1), MAX_DAYS) : 7;
    return this.dashboardService.getProductionChart(parsedDays);
  }

  // A25: Sync status → ADMIN only
  @Get('sync/status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get sync status by device' })
  async getSyncStatus() {
    return this.dashboardService.getSyncStatus();
  }

  // A25: Sync events → ADMIN only
  @Get('sync/events')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get recent sync events' })
  @ApiQuery({ name: 'limit', required: false })
  async getRecentSyncEvents(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit) || 20, 1), MAX_LIMIT) : 20;
    return this.dashboardService.getRecentSyncEvents(parsedLimit);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD PRODUCTION (ROLE PRODUCTION)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('production')
  @Roles('PRODUCTION', 'ADMIN')
  @ApiOperation({ summary: 'Get production dashboard KPIs (no financial data)' })
  async getProductionDashboard(@Req() req: Request & { user: { id: string } }) {
    return this.dashboardService.getProductionDashboard(req.user.id);
  }
}
