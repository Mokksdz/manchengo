import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * HEALTH CHECK CONTROLLER — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R6: Health checks par module (DB, Redis, services)
 *
 * Endpoints (no auth required — for load balancers & monitoring):
 *   GET /api/health          - Basic liveness check
 *   GET /api/health/ready    - Full readiness check (DB, Cache)
 *   GET /api/health/detailed - Detailed status per module (admin use)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * GET /api/health — Liveness probe
   * Returns 200 if the app is running (no dependency checks)
   */
  @Get()
  @ApiOperation({ summary: 'Liveness check - is the app running?' })
  async liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * GET /api/health/ready — Readiness probe
   * Checks DB and Cache connectivity
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check - are all dependencies healthy?' })
  async readiness() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkCache(),
    ]);

    const [dbResult, cacheResult] = checks;

    const dbOk = dbResult.status === 'fulfilled' && dbResult.value.ok;
    const cacheOk = cacheResult.status === 'fulfilled' && cacheResult.value.ok;
    const allOk = dbOk && cacheOk;

    const response = {
      status: allOk ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk
          ? { status: 'up', responseTimeMs: (dbResult as PromiseFulfilledResult<any>).value.ms }
          : { status: 'down', error: dbResult.status === 'rejected' ? dbResult.reason?.message : 'Unknown' },
        cache: cacheOk
          ? { status: 'up', responseTimeMs: (cacheResult as PromiseFulfilledResult<any>).value.ms }
          : { status: 'down', error: cacheResult.status === 'rejected' ? cacheResult.reason?.message : 'Unknown' },
      },
    };

    return response;
  }

  /**
   * GET /api/health/detailed — Full diagnostic (for admin dashboards)
   * Protected: exposes sensitive data (version, memory, cache metrics)
   */
  @Get('detailed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Detailed health check with metrics (ADMIN only)' })
  async detailed() {
    const [dbCheck, cacheCheck] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkCache(),
    ]);

    const cacheMetrics = this.cacheService.getMetrics();
    const memoryUsage = process.memoryUsage();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: {
        seconds: Math.floor(process.uptime()),
        human: this.formatUptime(process.uptime()),
      },
      checks: {
        database: dbCheck.status === 'fulfilled'
          ? { status: 'up', ...dbCheck.value }
          : { status: 'down', error: (dbCheck as PromiseRejectedResult).reason?.message },
        cache: cacheCheck.status === 'fulfilled'
          ? { status: 'up', ...cacheCheck.value }
          : { status: 'down', error: (cacheCheck as PromiseRejectedResult).reason?.message },
      },
      cache: {
        ...cacheMetrics,
        hitRateFormatted: `${cacheMetrics.hitRate.toFixed(1)}%`,
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      },
      nodeVersion: process.version,
    };
  }

  private async checkDatabase(): Promise<{ ok: boolean; ms: number }> {
    const start = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - start;
    return { ok: true, ms };
  }

  private async checkCache(): Promise<{ ok: boolean; ms: number }> {
    const start = Date.now();
    const testKey = 'health:check';
    await this.cacheService.set(testKey, 'ok', 5000);
    const value = await this.cacheService.get<string>(testKey);
    const ms = Date.now() - start;
    return { ok: value === 'ok', ms };
  }

  private formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }
}
