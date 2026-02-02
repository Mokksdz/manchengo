import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityAction } from '@prisma/client';

/**
 * Security Log Service
 * 
 * Provides audit logging for all security-related events.
 * All actions are immutable and timestamped for compliance.
 * 
 * Logged events:
 * - LOGIN_SUCCESS/FAILURE: Authentication attempts
 * - DEVICE_REGISTER/REVOKE: Device lifecycle
 * - USER_BLOCK/UNBLOCK: Account status changes
 * - ROLE_CHANGE: Permission modifications
 * - SYNC_PUSH/PULL: Data synchronization
 * - ACCESS_DENIED: Authorization failures
 */
@Injectable()
export class SecurityLogService {
  constructor(private prisma: PrismaService) {}

  /**
   * Log a security event
   * Creates an immutable audit record
   */
  async log(params: {
    action: SecurityAction;
    userId?: string;
    targetId?: string;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, any>;
    success?: boolean;
  }): Promise<void> {
    await this.prisma.securityLog.create({
      data: {
        action: params.action,
        userId: params.userId,
        targetId: params.targetId,
        deviceId: params.deviceId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: params.details,
        success: params.success ?? true,
      },
    });
  }

  /**
   * Log successful login
   */
  async logLoginSuccess(
    userId: string,
    deviceId: string | undefined,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    await this.log({
      action: SecurityAction.LOGIN_SUCCESS,
      userId,
      deviceId,
      ipAddress,
      userAgent,
      success: true,
    });
  }

  /**
   * Log failed login attempt
   */
  async logLoginFailure(
    email: string,
    ipAddress: string,
    userAgent: string,
    reason: string,
  ): Promise<void> {
    await this.log({
      action: SecurityAction.LOGIN_FAILURE,
      ipAddress,
      userAgent,
      details: { email, reason },
      success: false,
    });
  }

  /**
   * Log device registration
   */
  async logDeviceRegister(
    userId: string,
    deviceId: string,
    deviceName: string,
    platform: string,
  ): Promise<void> {
    await this.log({
      action: SecurityAction.DEVICE_REGISTER,
      userId,
      deviceId,
      details: { deviceName, platform },
      success: true,
    });
  }

  /**
   * Log device revocation by admin
   */
  async logDeviceRevoke(
    adminUserId: string,
    deviceId: string,
    deviceOwnerId: string,
    reason?: string,
  ): Promise<void> {
    await this.log({
      action: SecurityAction.DEVICE_REVOKE,
      userId: adminUserId,
      targetId: deviceOwnerId,
      deviceId,
      details: { reason },
      success: true,
    });
  }

  /**
   * Log user block by admin
   */
  async logUserBlock(
    adminUserId: string,
    targetUserId: string,
    reason?: string,
  ): Promise<void> {
    await this.log({
      action: SecurityAction.USER_BLOCK,
      userId: adminUserId,
      targetId: targetUserId,
      details: { reason },
      success: true,
    });
  }

  /**
   * Log user unblock by admin
   */
  async logUserUnblock(
    adminUserId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.log({
      action: SecurityAction.USER_UNBLOCK,
      userId: adminUserId,
      targetId: targetUserId,
      success: true,
    });
  }

  /**
   * Log role change by admin
   */
  async logRoleChange(
    adminUserId: string,
    targetUserId: string,
    oldRole: string,
    newRole: string,
  ): Promise<void> {
    await this.log({
      action: SecurityAction.ROLE_CHANGE,
      userId: adminUserId,
      targetId: targetUserId,
      details: { oldRole, newRole },
      success: true,
    });
  }

  /**
   * Log access denied event
   */
  async logAccessDenied(
    userId: string | undefined,
    deviceId: string | undefined,
    resource: string,
    reason: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      action: SecurityAction.ACCESS_DENIED,
      userId,
      deviceId,
      ipAddress,
      details: { resource, reason },
      success: false,
    });
  }

  /**
   * Get security logs with filtering
   */
  async getLogs(params: {
    action?: SecurityAction;
    userId?: string;
    deviceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (params.action) where.action = params.action;
    if (params.userId) where.userId = params.userId;
    if (params.deviceId) where.deviceId = params.deviceId;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.securityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.securityLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get recent failed login attempts for an IP
   * Used for rate limiting
   */
  async getRecentFailedLogins(
    ipAddress: string,
    windowMinutes: number = 15,
  ): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    return this.prisma.securityLog.count({
      where: {
        action: SecurityAction.LOGIN_FAILURE,
        ipAddress,
        createdAt: { gte: since },
      },
    });
  }
}
