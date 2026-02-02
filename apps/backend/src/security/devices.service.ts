import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityLogService } from './security-log.service';

/**
 * Devices Service
 * 
 * Manages device lifecycle for enterprise security:
 * - Device registration on first login/sync
 * - Device status validation
 * - Admin revocation of compromised devices
 * 
 * Security model:
 * - Each device has a unique UUID from mobile
 * - Devices are linked to users
 * - Revoked devices cannot login or sync
 * - Offline usage continues until next sync attempt
 */
@Injectable()
export class DevicesService {
  constructor(
    private prisma: PrismaService,
    private securityLog: SecurityLogService,
  ) {}

  /**
   * Register or update a device on login/sync
   * Called automatically during authentication
   */
  async registerDevice(params: {
    deviceId: string;
    userId: string;
    name: string;
    platform: string;
    appVersion?: string;
  }): Promise<{ isNew: boolean; device: any }> {
    const existing = await this.prisma.device.findUnique({
      where: { id: params.deviceId },
    });

    if (existing) {
      // Check if device is revoked
      if (!existing.isActive) {
        throw new ForbiddenException('Device has been revoked');
      }

      // Check if device belongs to same user
      if (existing.userId !== params.userId) {
        throw new ForbiddenException('Device registered to different user');
      }

      // Update last seen
      const device = await this.prisma.device.update({
        where: { id: params.deviceId },
        data: {
          name: params.name,
          appVersion: params.appVersion,
          lastSyncAt: new Date(),
        },
      });

      return { isNew: false, device };
    }

    // Register new device
    const device = await this.prisma.device.create({
      data: {
        id: params.deviceId,
        userId: params.userId,
        name: params.name,
        platform: params.platform,
        appVersion: params.appVersion,
        lastSyncAt: new Date(),
      },
    });

    // Log device registration
    await this.securityLog.logDeviceRegister(
      params.userId,
      params.deviceId,
      params.name,
      params.platform,
    );

    return { isNew: true, device };
  }

  /**
   * Validate device is active and belongs to user
   * Called by auth guards on every protected request
   */
  async validateDevice(deviceId: string, userId: string): Promise<boolean> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { user: { select: { isActive: true } } },
    });

    if (!device) {
      return false; // Device not registered
    }

    if (!device.isActive) {
      return false; // Device revoked
    }

    if (device.userId !== userId) {
      return false; // Device belongs to different user
    }

    if (!device.user.isActive) {
      return false; // User blocked
    }

    return true;
  }

  /**
   * Get device by ID
   */
  async getDevice(deviceId: string) {
    return this.prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        user: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Revoke a device (admin action)
   * Device will be denied access on next login/sync attempt
   */
  async revokeDevice(
    deviceId: string,
    adminUserId: string,
    reason?: string,
  ): Promise<void> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Revoke device
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { isActive: false },
    });

    // Invalidate all refresh tokens for this device
    await this.prisma.refreshToken.deleteMany({
      where: { deviceId },
    });

    // Log revocation
    await this.securityLog.logDeviceRevoke(
      adminUserId,
      deviceId,
      device.userId,
      reason,
    );
  }

  /**
   * Reactivate a revoked device (admin action)
   */
  async reactivateDevice(deviceId: string): Promise<void> {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { isActive: true },
    });
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSyncAt: 'desc' },
    });
  }

  /**
   * Get all devices (admin)
   */
  async getAllDevices(params?: {
    userId?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (params?.userId) where.userId = params.userId;
    if (params?.isActive !== undefined) where.isActive = params.isActive;

    const [devices, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              role: true,
              isActive: true,
            },
          },
        },
        orderBy: { lastSyncAt: 'desc' },
        take: params?.limit || 50,
        skip: params?.offset || 0,
      }),
      this.prisma.device.count({ where }),
    ]);

    return { devices, total };
  }

  /**
   * Update device last sync time
   */
  async updateLastSync(deviceId: string): Promise<void> {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });
  }
}
