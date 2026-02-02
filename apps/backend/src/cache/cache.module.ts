import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import { CacheService } from './cache.service';
import { logger } from '../common/logger/logger.service';

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS CACHE MODULE — Manchengo Smart ERP
// ═══════════════════════════════════════════════════════════════════════════════
// Features:
// - Redis-backed caching for KPIs and dashboards
// - Automatic fallback to in-memory cache if Redis unavailable
// - Configurable TTLs per cache key pattern
// - Cache invalidation by pattern
// ═══════════════════════════════════════════════════════════════════════════════

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD', '');
        const redisDb = configService.get<number>('REDIS_DB', 0);
        const useRedis = configService.get<string>('CACHE_STORE', 'redis') === 'redis';

        // Default TTL: 5 minutes (300 seconds)
        const defaultTtl = configService.get<number>('CACHE_TTL_DEFAULT', 300) * 1000;

        if (useRedis) {
          try {
            const store = await redisStore({
              host: redisHost,
              port: redisPort,
              password: redisPassword || undefined,
              db: redisDb,
              ttl: defaultTtl,
              // Connection options
              lazyConnect: false,
              enableReadyCheck: true,
              maxRetriesPerRequest: 3,
              retryStrategy: (times: number) => {
                if (times > 3) {
                  logger.warn('Redis retry limit reached, using in-memory fallback', 'Cache', { retryCount: times });
                  return null; // Stop retrying
                }
                return Math.min(times * 200, 2000);
              },
            });

            logger.info(`Redis connected: ${redisHost}:${redisPort}`, 'Cache');

            return {
              store,
              ttl: defaultTtl,
            };
          } catch (error) {
            logger.warn(`Redis connection failed, using in-memory cache: ${error.message}`, 'Cache');
            return {
              ttl: defaultTtl,
            };
          }
        }

        // In-memory cache fallback
        logger.info('Using in-memory cache', 'Cache');
        return {
          ttl: defaultTtl,
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [NestCacheModule, CacheService],
})
export class RedisCacheModule {}
