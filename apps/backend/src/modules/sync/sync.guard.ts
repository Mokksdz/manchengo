import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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
export class SyncRateLimitGuard implements CanActivate, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncRateLimitGuard.name);
  private redis: Redis | null = null;
  private useRedis = false;

  // Fallback in-memory store (single-instance only)
  private readonly requestCounts = new Map<string, { count: number; resetAt: number }>();
  private lastCleanup = Date.now();

  // Rate limits
  private readonly PUSH_LIMIT = 100;
  private readonly PULL_LIMIT = 200;
  private readonly WINDOW_MS = 60000; // 1 minute
  private readonly CLEANUP_INTERVAL_MS = 120000;
  private readonly MAX_MAP_SIZE = 10_000;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    if (redisHost) {
      try {
        // Fast TCP probe to fail quickly when Redis is down
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const net = require('net');
        await new Promise<void>((resolve, reject) => {
          const sock = net.createConnection({ host: redisHost, port: redisPort, timeout: 2000 });
          sock.once('connect', () => { sock.destroy(); resolve(); });
          sock.once('timeout', () => { sock.destroy(); reject(new Error('Redis TCP timeout')); });
          sock.once('error', (err: Error) => { sock.destroy(); reject(err); });
        });

        this.redis = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          db: this.configService.get<number>('REDIS_DB', 0),
          keyPrefix: 'sync_rl:',
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          enableReadyCheck: true,
        });

        await this.redis.connect();
        this.useRedis = true;
        this.logger.log('Sync rate limiter using Redis (distributed-safe)');
      } catch (err) {
        this.logger.warn(
          `Redis unavailable for sync rate limiter, falling back to in-memory: ${err instanceof Error ? err.message : err}`,
        );
        this.redis = null;
        this.useRedis = false;
      }
    } else {
      this.logger.warn('No REDIS_HOST configured, sync rate limiter using in-memory store (single-instance only)');
    }

    // Periodic cleanup for in-memory fallback
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      this.cleanupExpiredEntries(now);
      // Cap map size
      if (this.requestCounts.size > this.MAX_MAP_SIZE) {
        const entriesToRemove = this.requestCounts.size - this.MAX_MAP_SIZE;
        const iterator = this.requestCounts.keys();
        for (let i = 0; i < entriesToRemove; i++) {
          const key = iterator.next().value;
          if (key !== undefined) this.requestCounts.delete(key);
        }
      }
    }, this.CLEANUP_INTERVAL_MS);
  }

  async onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // Ignore disconnect errors during shutdown
      }
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const deviceId = request.deviceId || request.headers['x-device-id'];
    const method = request.method;
    const path = request.path;

    if (!deviceId) {
      return true; // Let SyncDeviceGuard handle this
    }

    const key = `${deviceId}:${method}:${path}`;
    const limit = method === 'POST' ? this.PUSH_LIMIT : this.PULL_LIMIT;

    if (this.useRedis && this.redis) {
      return this.checkRedisRateLimit(key, limit, deviceId, path);
    }

    return this.checkMemoryRateLimit(key, limit, deviceId, path);
  }

  private async checkRedisRateLimit(
    key: string,
    limit: number,
    deviceId: string,
    path: string,
  ): Promise<boolean> {
    try {
      const windowSeconds = Math.ceil(this.WINDOW_MS / 1000);
      const count = await this.redis!.incr(key);

      if (count === 1) {
        // First request in window — set TTL
        await this.redis!.expire(key, windowSeconds);
      }

      if (count > limit) {
        this.logger.warn(
          `Rate limit exceeded - Device: ${deviceId}, Path: ${path}, Count: ${count}`,
        );
        throw new ForbiddenException('Rate limit exceeded. Please slow down.');
      }

      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      // Redis error — fallback to memory
      this.logger.warn(`Redis rate limit check failed, using memory fallback: ${err instanceof Error ? err.message : err}`);
      return this.checkMemoryRateLimit(key, limit, deviceId, path);
    }
  }

  private checkMemoryRateLimit(
    key: string,
    limit: number,
    deviceId: string,
    path: string,
  ): boolean {
    const now = Date.now();

    // Periodically purge expired entries to prevent memory leak
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL_MS) {
      this.cleanupExpiredEntries(now);
      this.lastCleanup = now;
    }

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

  private cleanupExpiredEntries(now: number): void {
    let cleaned = 0;
    for (const [key, record] of this.requestCounts) {
      if (now > record.resetAt) {
        this.requestCounts.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`Rate limiter cleanup: removed ${cleaned} expired entries`);
    }
  }
}
