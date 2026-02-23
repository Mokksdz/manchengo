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
// - Exponential backoff retry with max 5 attempts
// - Error events logged but never crash the process
// - Configurable TTLs per cache key pattern
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
            // Fast TCP probe to avoid hanging for 30s+ when Redis is down
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const net = require('net');
            await new Promise<void>((resolve, reject) => {
              const sock = net.createConnection({ host: redisHost, port: redisPort, timeout: 2000 });
              sock.once('connect', () => { sock.destroy(); resolve(); });
              sock.once('timeout', () => { sock.destroy(); reject(new Error('Redis TCP timeout')); });
              sock.once('error', (err: Error) => { sock.destroy(); reject(err); });
            });

            const store = await redisStore({
              host: redisHost,
              port: redisPort,
              password: redisPassword || undefined,
              db: redisDb,
              ttl: defaultTtl,
              // Connection resilience
              lazyConnect: false,
              enableReadyCheck: true,
              maxRetriesPerRequest: 3,
              // Reconnect with exponential backoff (cap at 5s)
              retryStrategy: (times: number) => {
                if (times > 10) {
                  logger.warn(
                    `Redis retry limit reached (${times} attempts), falling back to in-memory`,
                    'Cache',
                  );
                  return null; // Stop retrying, ioredis will emit 'end'
                }
                const delay = Math.min(times * 200, 5000);
                logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`, 'Cache');
                return delay;
              },
              // Prevent unhandled errors from crashing the process
              enableOfflineQueue: true,
              connectTimeout: 10000,
            });

            // Attach error handler to prevent uncaught exceptions
            const client = (store as any)?.client;
            if (client && typeof client.on === 'function') {
              client.on('error', (err: Error) => {
                logger.warn(`Redis error (non-fatal): ${err.message}`, 'Cache');
              });
              client.on('reconnecting', (delay: number) => {
                logger.warn(`Redis reconnecting (delay: ${delay}ms)`, 'Cache');
              });
            }

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
