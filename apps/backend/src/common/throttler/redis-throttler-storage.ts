import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { logger } from '../logger/logger.service';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * REDIS THROTTLER STORAGE — Persistent Rate Limiting
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Replaces the default in-memory ThrottlerStorageService with Redis-backed storage.
 * Benefits:
 * - Persists across server restarts
 * - Works across multiple instances (Railway scaling)
 * - Atomic increment with INCR + EXPIRE (no race conditions)
 * - Automatic key expiry via Redis TTL
 *
 * Key format: throttler:{throttlerName}:{key}
 * ═══════════════════════════════════════════════════════════════════════════════
 */

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private redis: Redis | null = null;
  private fallbackStorage = new Map<string, { totalHits: number; expiresAt: number }>();

  constructor(private readonly configService: ConfigService) {
    this.initRedis();
  }

  private initRedis() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD', '');

    try {
      if (redisUrl) {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
          lazyConnect: false,
          enableReadyCheck: true,
          retryStrategy: (times: number) => {
            if (times > 5) {
              logger.warn('Redis throttler: max retries reached, using in-memory fallback', 'Throttler');
              return null;
            }
            return Math.min(times * 200, 3000);
          },
        });
      } else if (redisHost) {
        this.redis = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
          lazyConnect: false,
          enableReadyCheck: true,
          retryStrategy: (times: number) => {
            if (times > 5) {
              logger.warn('Redis throttler: max retries reached, using in-memory fallback', 'Throttler');
              return null;
            }
            return Math.min(times * 200, 3000);
          },
        });
      }

      if (this.redis) {
        this.redis.on('error', (err) => {
          logger.warn(`Redis throttler error (non-fatal): ${err.message}`, 'Throttler');
        });
        this.redis.on('connect', () => {
          logger.info('Redis throttler storage connected', 'Throttler');
        });
      }
    } catch (err) {
      logger.warn(`Redis throttler init failed, using in-memory: ${err.message}`, 'Throttler');
      this.redis = null;
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    const storageKey = `throttler:${throttlerName}:${key}`;
    const blockKey = `throttler:block:${throttlerName}:${key}`;

    // TTL is in milliseconds from @nestjs/throttler v6
    const ttlSeconds = Math.ceil(ttl / 1000);
    const blockSeconds = Math.ceil(blockDuration / 1000);

    if (this.redis && this.redis.status === 'ready') {
      return this.incrementRedis(storageKey, blockKey, ttlSeconds, limit, blockSeconds);
    }

    // Fallback: in-memory
    return this.incrementMemory(storageKey, blockKey, ttlSeconds, limit, blockSeconds);
  }

  private async incrementRedis(
    storageKey: string,
    blockKey: string,
    ttlSeconds: number,
    limit: number,
    blockSeconds: number,
  ) {
    try {
      // Check if blocked
      const blocked = await this.redis!.get(blockKey);
      if (blocked) {
        const blockTtl = await this.redis!.ttl(blockKey);
        return {
          totalHits: limit + 1,
          timeToExpire: 0,
          isBlocked: true,
          timeToBlockExpire: Math.max(blockTtl * 1000, 0),
        };
      }

      // Atomic increment
      const totalHits = await this.redis!.incr(storageKey);

      // Set expiry on first hit
      if (totalHits === 1) {
        await this.redis!.expire(storageKey, ttlSeconds);
      }

      // Get remaining TTL
      const remainingTtl = await this.redis!.ttl(storageKey);
      const timeToExpire = Math.max(remainingTtl * 1000, 0);

      // If over limit and blockDuration > 0, set block key
      if (totalHits > limit && blockSeconds > 0) {
        await this.redis!.set(blockKey, '1', 'EX', blockSeconds);
        return {
          totalHits,
          timeToExpire,
          isBlocked: true,
          timeToBlockExpire: blockSeconds * 1000,
        };
      }

      return {
        totalHits,
        timeToExpire,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (err) {
      logger.warn(`Redis throttler error, falling back: ${err.message}`, 'Throttler');
      return this.incrementMemory(storageKey, '', ttlSeconds, limit, blockSeconds);
    }
  }

  private incrementMemory(
    storageKey: string,
    _blockKey: string,
    ttlSeconds: number,
    _limit: number,
    _blockSeconds: number,
  ) {
    const now = Date.now();
    const existing = this.fallbackStorage.get(storageKey);

    if (existing && existing.expiresAt > now) {
      existing.totalHits++;
      const timeToExpire = existing.expiresAt - now;
      return Promise.resolve({
        totalHits: existing.totalHits,
        timeToExpire,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    }

    // New entry
    const expiresAt = now + ttlSeconds * 1000;
    this.fallbackStorage.set(storageKey, { totalHits: 1, expiresAt });

    // Cleanup old entries periodically
    if (this.fallbackStorage.size > 1000) {
      for (const [k, v] of this.fallbackStorage) {
        if (v.expiresAt < now) this.fallbackStorage.delete(k);
      }
    }

    return Promise.resolve({
      totalHits: 1,
      timeToExpire: ttlSeconds * 1000,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  }

  async onModuleDestroy() {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // Ignore disconnect errors
      }
    }
  }
}
