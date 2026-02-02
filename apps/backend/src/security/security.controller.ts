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
import { PrismaService } from '../prisma/prisma.service';
import { SecurityLogService } from './security-log.service';
import { DevicesService } from './devices.service';
import { SecurityAction, UserRole } from '@prisma/client';

/**
 * Security Controller
 * 
 * Admin endpoints for enterprise security management:
 * - User management (block/unblock, role change)
 * - Device management (list, revoke)
 * - Security logs (audit trail)
 * 
 * All endpoints require ADMIN role.
 */
@ApiTags('Security Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SecurityController {
  constructor(
    private prisma: PrismaService,
    private securityLog: SecurityLogService,
    private devicesService: DevicesService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all users with device counts
   */
  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  async getUsers(
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const where: any = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          code: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { devices: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit) : 50,
        skip: offset ? parseInt(offset) : 0,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * Get single user with devices
   */
  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details' })
  async getUser(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        devices: {
          select: {
            id: true,
            name: true,
            platform: true,
            appVersion: true,
            lastSyncAt: true,
            isActive: true,
            registeredAt: true,
          },
          orderBy: { lastSyncAt: 'desc' },
        },
      },
    });

    return user;
  }

  /**
   * Block a user
   * All their sessions become invalid immediately
   */
  @Post('users/:id/block')
  @ApiOperation({ summary: 'Block a user' })
  async blockUser(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    const adminId = req.user.sub;

    // Block user
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate all refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId: id },
    });

    // Log action
    await this.securityLog.logUserBlock(adminId, id, body.reason);

    return { success: true, message: 'User blocked' };
  }

  /**
   * Unblock a user
   */
  @Post('users/:id/unblock')
  @ApiOperation({ summary: 'Unblock a user' })
  async unblockUser(@Param('id') id: string, @Request() req: any) {
    const adminId = req.user.sub;

    await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    await this.securityLog.logUserUnblock(adminId, id);

    return { success: true, message: 'User unblocked' };
  }

  /**
   * Change user role
   */
  @Post('users/:id/role')
  @ApiOperation({ summary: 'Change user role' })
  async changeUserRole(
    @Param('id') id: string,
    @Body() body: { role: UserRole },
    @Request() req: any,
  ) {
    const adminId = req.user.sub;

    // Get current role
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Update role
    await this.prisma.user.update({
      where: { id },
      data: { role: body.role },
    });

    // Log role change
    await this.securityLog.logRoleChange(adminId, id, user.role, body.role);

    return { success: true, message: 'Role updated' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEVICE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all devices
   */
  @Get('devices')
  @ApiOperation({ summary: 'List all devices' })
  async getDevices(
    @Query('userId') userId?: string,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.devicesService.getAllDevices({
      userId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  /**
   * Get single device
   */
  @Get('devices/:id')
  @ApiOperation({ summary: 'Get device details' })
  async getDevice(@Param('id') id: string) {
    return this.devicesService.getDevice(id);
  }

  /**
   * Revoke a device
   * Device will be denied access on next login/sync attempt
   */
  @Post('devices/:id/revoke')
  @ApiOperation({ summary: 'Revoke a device' })
  async revokeDevice(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    const adminId = req.user.sub;

    await this.devicesService.revokeDevice(id, adminId, body.reason);

    return { success: true, message: 'Device revoked' };
  }

  /**
   * Reactivate a device
   */
  @Post('devices/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate a revoked device' })
  async reactivateDevice(@Param('id') id: string) {
    await this.devicesService.reactivateDevice(id);

    return { success: true, message: 'Device reactivated' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get security logs
   */
  @Get('security-logs')
  @ApiOperation({ summary: 'Get security audit logs' })
  async getSecurityLogs(
    @Query('action') action?: SecurityAction,
    @Query('userId') userId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.securityLog.getLogs({
      action,
      userId,
      deviceId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }
}
