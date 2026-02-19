import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from '../common/audit';
import { AuditAction, AuditSeverity, UserRole } from '@prisma/client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AUDIT CONTROLLER - Investigation & Compliance Endpoint
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Allow administrators to query audit logs for:
 *   - Incident investigation
 *   - Compliance audits
 *   - Security monitoring
 *   - Discrepancy analysis
 * 
 * ACCESS: ADMIN only (enforced at route level)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

@ApiTags('Security - Audit')
@ApiBearerAuth()
@Controller('security/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Query audit logs with filters' })
  @ApiQuery({ name: 'actorId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction, description: 'Filter by action type' })
  @ApiQuery({ name: 'entityType', required: false, description: 'Filter by entity type (e.g., StockMovement)' })
  @ApiQuery({ name: 'entityId', required: false, description: 'Filter by entity ID' })
  @ApiQuery({ name: 'severity', required: false, enum: AuditSeverity, description: 'Filter by severity' })
  @ApiQuery({ name: 'requestId', required: false, description: 'Filter by request correlation ID' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50, max: 100)' })
  async queryLogs(
    @Query('actorId') actorId?: string,
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('severity') severity?: AuditSeverity,
    @Query('requestId') requestId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.query({
      actorId,
      action,
      entityType,
      entityId,
      severity,
      requestId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get audit history for a specific entity' })
  async getEntityHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.getEntityHistory(
      entityType,
      entityId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('request/:requestId')
  @ApiOperation({ summary: 'Get all audit logs for a specific request (correlation)' })
  async getByRequestId(@Param('requestId') requestId: string) {
    return this.auditService.getByRequestId(requestId);
  }

  @Get('security-events')
  @ApiOperation({ summary: 'Get recent security events for monitoring' })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: 'Hours to look back (default: 24)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max events (default: 100)' })
  async getSecurityEvents(
    @Query('hours') hours?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.getSecurityEvents(
      hours ? parseInt(hours, 10) : 24,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get audit log statistics for dashboard' })
  async getStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [todayLogs, weekLogs, securityEvents] = await Promise.all([
      this.auditService.query({ from: today, limit: 1 }),
      this.auditService.query({ from: weekAgo, limit: 1 }),
      this.auditService.getSecurityEvents(24, 1),
    ]);

    return {
      today: {
        total: todayLogs.pagination.total,
      },
      week: {
        total: weekLogs.pagination.total,
      },
      securityEvents: {
        last24h: securityEvents.length,
      },
    };
  }
}
