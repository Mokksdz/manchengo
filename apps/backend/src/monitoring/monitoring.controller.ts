import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MonitoringService } from './monitoring.service';
import { AlertsService } from './alerts.service';
import { AlertStatus, AlertType, AlertSeverity } from '@prisma/client';

/**
 * Monitoring Controller
 * 
 * Admin endpoints for system monitoring and alerts:
 * - GET /api/monitoring/kpis - Real-time system KPIs
 * - GET /api/monitoring/alerts - List alerts with filters
 * - POST /api/monitoring/alerts/:id/ack - Acknowledge an alert
 * - POST /api/monitoring/alerts/:id/close - Close an alert
 * - POST /api/monitoring/check - Trigger alert check manually
 * 
 * All endpoints require ADMIN role.
 */
@ApiTags('Monitoring')
@ApiBearerAuth()
@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MonitoringController {
  constructor(
    private monitoringService: MonitoringService,
    private alertsService: AlertsService,
  ) {}

  /**
   * GET /api/monitoring/kpis
   * 
   * Returns real-time system KPIs:
   * - Sync health (devices, events)
   * - Stock levels (MP, PF, low stock)
   * - Fiscal metrics (today/month sales, VAT)
   * - Security status (users, access denied)
   */
  @Get('kpis')
  @ApiOperation({ summary: 'Get system KPIs' })
  async getKpis() {
    return this.monitoringService.getKpis();
  }

  /**
   * GET /api/monitoring/alerts
   * 
   * Returns alerts with optional filters:
   * - status: OPEN, ACKNOWLEDGED, CLOSED
   * - type: AlertType enum
   * - severity: INFO, WARNING, CRITICAL
   */
  @Get('alerts')
  @ApiOperation({ summary: 'Get alerts list' })
  async getAlerts(
    @Query('status') status?: AlertStatus,
    @Query('type') type?: AlertType,
    @Query('severity') severity?: AlertSeverity,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.alertsService.getAlerts({
      status,
      type,
      severity,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  /**
   * POST /api/monitoring/alerts/:id/ack
   * 
   * Acknowledge an alert (mark as seen by admin)
   */
  @Post('alerts/:id/ack')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  async acknowledgeAlert(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Request() req: any,
  ) {
    const userId = req.user.sub;
    return this.alertsService.acknowledgeAlert(id, userId, body.note);
  }

  /**
   * POST /api/monitoring/alerts/:id/close
   * 
   * Close an alert (resolved or dismissed)
   */
  @Post('alerts/:id/close')
  @ApiOperation({ summary: 'Close an alert' })
  async closeAlert(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Request() req: any,
  ) {
    const userId = req.user.sub;
    return this.alertsService.closeAlert(id, userId, body.note);
  }

  /**
   * POST /api/monitoring/check
   * 
   * Manually trigger alert checks (useful for testing)
   */
  @Post('check')
  @ApiOperation({ summary: 'Run alert checks manually' })
  async runChecks() {
    await this.alertsService.runScheduledChecks();
    return { success: true, message: 'Alert checks completed' };
  }
}
