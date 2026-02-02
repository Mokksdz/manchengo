import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PROMETHEUS METRICS CONTROLLER — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R17: Métriques Prometheus endpoint
 *
 * Exposes application metrics in Prometheus text format.
 * Endpoint: GET /api/metrics
 *
 * Metrics exported:
 * - manchengo_uptime_seconds
 * - manchengo_memory_heap_used_bytes
 * - manchengo_cache_hits_total / misses_total / hit_rate
 * - manchengo_active_users_total
 * - manchengo_orders_pending_total
 * - manchengo_http_request_duration_seconds (histogram via middleware)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);
  private requestCounts: Record<string, number> = {};
  private errorCounts: Record<string, number> = {};

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  async getMetrics() {
    const lines: string[] = [];
    const now = Date.now();

    // ── System metrics ──
    const mem = process.memoryUsage();
    lines.push('# HELP manchengo_uptime_seconds Application uptime in seconds');
    lines.push('# TYPE manchengo_uptime_seconds gauge');
    lines.push(`manchengo_uptime_seconds ${Math.floor(process.uptime())}`);

    lines.push('# HELP manchengo_memory_heap_used_bytes Heap memory used in bytes');
    lines.push('# TYPE manchengo_memory_heap_used_bytes gauge');
    lines.push(`manchengo_memory_heap_used_bytes ${mem.heapUsed}`);

    lines.push('# HELP manchengo_memory_rss_bytes RSS memory in bytes');
    lines.push('# TYPE manchengo_memory_rss_bytes gauge');
    lines.push(`manchengo_memory_rss_bytes ${mem.rss}`);

    // ── Cache metrics ──
    const cache = this.cacheService.getMetrics();
    lines.push('# HELP manchengo_cache_hits_total Total cache hits');
    lines.push('# TYPE manchengo_cache_hits_total counter');
    lines.push(`manchengo_cache_hits_total ${cache.hits}`);

    lines.push('# HELP manchengo_cache_misses_total Total cache misses');
    lines.push('# TYPE manchengo_cache_misses_total counter');
    lines.push(`manchengo_cache_misses_total ${cache.misses}`);

    lines.push('# HELP manchengo_cache_hit_rate Cache hit rate percentage');
    lines.push('# TYPE manchengo_cache_hit_rate gauge');
    lines.push(`manchengo_cache_hit_rate ${cache.hitRate.toFixed(2)}`);

    // ── Business metrics (with safe fallbacks) ──
    try {
      const [activeUsers, pendingOrders, todayInvoices, pendingDeliveries] =
        await Promise.all([
          this.prisma.user.count({ where: { isActive: true } }),
          this.prisma.productionOrder.count({ where: { status: 'PENDING' } }),
          this.prisma.invoice.count({
            where: {
              date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
              status: { not: 'CANCELLED' },
            },
          }),
          this.prisma.delivery.count({ where: { status: 'PENDING' } }),
        ]);

      lines.push('# HELP manchengo_active_users_total Total active users');
      lines.push('# TYPE manchengo_active_users_total gauge');
      lines.push(`manchengo_active_users_total ${activeUsers}`);

      lines.push('# HELP manchengo_orders_pending_total Pending production orders');
      lines.push('# TYPE manchengo_orders_pending_total gauge');
      lines.push(`manchengo_orders_pending_total ${pendingOrders}`);

      lines.push('# HELP manchengo_invoices_today_total Invoices created today');
      lines.push('# TYPE manchengo_invoices_today_total gauge');
      lines.push(`manchengo_invoices_today_total ${todayInvoices}`);

      lines.push('# HELP manchengo_deliveries_pending_total Pending deliveries');
      lines.push('# TYPE manchengo_deliveries_pending_total gauge');
      lines.push(`manchengo_deliveries_pending_total ${pendingDeliveries}`);
    } catch (error) {
      this.logger.warn(`Failed to collect business metrics: ${error.message}`);
    }

    // ── Meta ──
    lines.push('# HELP manchengo_metrics_scrape_duration_ms Time to collect metrics');
    lines.push('# TYPE manchengo_metrics_scrape_duration_ms gauge');
    lines.push(`manchengo_metrics_scrape_duration_ms ${Date.now() - now}`);

    return lines.join('\n') + '\n';
  }
}
