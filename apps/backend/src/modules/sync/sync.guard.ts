import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SyncDeviceGuard implements CanActivate {
  private readonly logger = new Logger(SyncDeviceGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Get device ID from header or body
    const deviceId =
      request.headers['x-device-id'] ||
      request.body?.deviceId ||
      request.query?.deviceId;

    if (!deviceId) {
      this.logger.warn(`Sync attempt without device ID - User: ${user.id}`);
      throw new UnauthorizedException('Device ID required for sync operations');
    }

    // Validate device exists and belongs to user
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        userId: true,
        isActive: true,
        name: true,
        platform: true,
        lastSyncAt: true,
      },
    });

    if (!device) {
      this.logger.warn(
        `Sync attempt with unknown device - DeviceId: ${deviceId}, User: ${user.id}`,
      );
      throw new UnauthorizedException('Device not registered');
    }

    if (device.userId !== user.id) {
      this.logger.error(
        `SECURITY: Device hijack attempt - DeviceId: ${deviceId}, RequestUser: ${user.id}, DeviceOwner: ${device.userId}`,
      );
      
      // Log security event
      await this.prisma.securityLog.create({
        data: {
          action: 'ACCESS_DENIED',
          userId: user.id,
          deviceId: deviceId,
          targetId: device.userId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          details: {
            reason: 'DEVICE_HIJACK_ATTEMPT',
            deviceOwner: device.userId,
          },
          success: false,
        },
      });

      throw new ForbiddenException('Device belongs to another user');
    }

    if (!device.isActive) {
      this.logger.warn(
        `Sync attempt with revoked device - DeviceId: ${deviceId}, User: ${user.id}`,
      );
      throw new ForbiddenException('Device has been revoked');
    }

    // Check if user is blocked
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isActive: true },
    });

    if (!userRecord?.isActive) {
      this.logger.warn(`Sync attempt by blocked user - User: ${user.id}`);
      throw new ForbiddenException('User account is blocked');
    }

    // Attach device info to request for later use
    request.device = device;
    request.deviceId = deviceId;

    return true;
  }
}

@Injectable()
export class SyncRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(SyncRateLimitGuard.name);
  private readonly requestCounts = new Map<string, { count: number; resetAt: number }>();
  
  // Rate limits
  private readonly PUSH_LIMIT = 100; // requests per window
  private readonly PULL_LIMIT = 200;
  private readonly WINDOW_MS = 60000; // 1 minute

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const deviceId = request.deviceId || request.headers['x-device-id'];
    const method = request.method;
    const path = request.path;

    if (!deviceId) {
      return true; // Let SyncDeviceGuard handle this
    }

    const key = `${deviceId}:${method}:${path}`;
    const now = Date.now();
    const limit = method === 'POST' ? this.PUSH_LIMIT : this.PULL_LIMIT;

    let record = this.requestCounts.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + this.WINDOW_MS };
      this.requestCounts.set(key, record);
    }

    record.count++;

    if (record.count > limit) {
      this.logger.warn(
        `Rate limit exceeded - Device: ${deviceId}, Path: ${path}, Count: ${record.count}`,
      );
      throw new ForbiddenException('Rate limit exceeded. Please slow down.');
    }

    return true;
  }
}
