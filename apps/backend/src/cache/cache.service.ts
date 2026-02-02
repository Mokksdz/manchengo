import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE SERVICE — Manchengo Smart ERP
// ═══════════════════════════════════════════════════════════════════════════════
// Provides:
// - Type-safe cache get/set operations
// - Cache key namespacing
// - TTL management by key pattern
// - Cache invalidation by pattern
// - Performance metrics (hit/miss logging)
// ═══════════════════════════════════════════════════════════════════════════════

// Cache key prefixes for namespacing
export enum CachePrefix {
  DASHBOARD_KPI = 'dashboard:kpi',
  STOCK_MP = 'stock:mp',
  STOCK_PF = 'stock:pf',
  SALES = 'sales',
  DELIVERY = 'delivery',
  SYNC = 'sync',
  DEVICE = 'device',
  CHART = 'chart',
}

// TTL values in milliseconds
export const CacheTTL = {
  KPI: 300 * 1000,        // 5 minutes - main KPIs
  CHART: 600 * 1000,      // 10 minutes - chart data (less volatile)
  STOCK: 180 * 1000,      // 3 minutes - stock data (more volatile)
  SALES: 120 * 1000,      // 2 minutes - sales data (real-time feel)
  DELIVERY: 60 * 1000,    // 1 minute - delivery status (critical)
  SYNC: 30 * 1000,        // 30 seconds - sync status (most volatile)
  DEVICE: 60 * 1000,      // 1 minute - device status
} as const;

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  
  // Performance metrics
  private metrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
  };

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get value from cache
   * @returns cached value or undefined if not found
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const startTime = Date.now();
      const value = await this.cacheManager.get<T>(key);
      const duration = Date.now() - startTime;

      if (value !== undefined && value !== null) {
        this.metrics.hits++;
        this.logger.debug(`[HIT] ${key} (${duration}ms)`);
        return value;
      }

      this.metrics.misses++;
      this.logger.debug(`[MISS] ${key} (${duration}ms)`);
      return undefined;
    } catch (error) {
      this.logger.warn(`[ERROR] Cache get failed for ${key}: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Set value in cache with TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl TTL in milliseconds (default: 5 minutes)
   */
  async set<T>(key: string, value: T, ttl: number = CacheTTL.KPI): Promise<void> {
    try {
      const startTime = Date.now();
      await this.cacheManager.set(key, value, ttl);
      const duration = Date.now() - startTime;
      
      this.metrics.sets++;
      this.logger.debug(`[SET] ${key} (TTL: ${ttl / 1000}s, ${duration}ms)`);
    } catch (error) {
      this.logger.warn(`[ERROR] Cache set failed for ${key}: ${error.message}`);
    }
  }

  /**
   * Delete specific key from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.metrics.invalidations++;
      this.logger.debug(`[DEL] ${key}`);
    } catch (error) {
      this.logger.warn(`[ERROR] Cache del failed for ${key}: ${error.message}`);
    }
  }

  /**
   * Get or set pattern - READ-THROUGH cache
   * If key exists, return cached value
   * If not, execute factory function, cache result, and return
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = CacheTTL.KPI,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Cache miss - execute factory
    const startTime = Date.now();
    const value = await factory();
    const dbDuration = Date.now() - startTime;

    // Cache the result
    await this.set(key, value, ttl);

    this.logger.debug(`[FACTORY] ${key} computed in ${dbDuration}ms`);
    return value;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE KEY BUILDERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Build dashboard KPI cache key
   */
  buildKpiKey(role?: string, zone?: string): string {
    const parts: string[] = [CachePrefix.DASHBOARD_KPI];
    if (role) parts.push(role);
    if (zone) parts.push(zone);
    return parts.join(':');
  }

  /**
   * Build stock cache key
   */
  buildStockKey(type: 'mp' | 'pf', productId?: number): string {
    const prefix = type === 'mp' ? CachePrefix.STOCK_MP : CachePrefix.STOCK_PF;
    return productId ? `${prefix}:${productId}` : prefix;
  }

  /**
   * Build sales cache key
   */
  buildSalesKey(period: 'today' | 'week' | 'month'): string {
    return `${CachePrefix.SALES}:${period}`;
  }

  /**
   * Build chart cache key
   */
  buildChartKey(chartType: string, days: number): string {
    return `${CachePrefix.CHART}:${chartType}:${days}d`;
  }

  /**
   * Build delivery cache key
   */
  buildDeliveryKey(type: 'pending' | 'today' | 'stats'): string {
    return `${CachePrefix.DELIVERY}:${type}`;
  }

  /**
   * Build sync cache key
   */
  buildSyncKey(type: 'pending' | 'status'): string {
    return `${CachePrefix.SYNC}:${type}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE INVALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Invalidate multiple cache keys
   * Use after mutations that affect cached data
   */
  async invalidateKeys(keys: string[]): Promise<void> {
    const promises = keys.map((key) => this.del(key));
    await Promise.all(promises);
    this.logger.log(`[INVALIDATE] ${keys.length} keys: ${keys.join(', ')}`);
  }

  /**
   * Invalidate all stock-related caches
   * Call after: stock movements, lot updates, inventory adjustments
   */
  async invalidateStockCache(): Promise<void> {
    const keys = [
      this.buildStockKey('mp'),
      this.buildStockKey('pf'),
      this.buildKpiKey(), // Main KPI includes stock
    ];
    await this.invalidateKeys(keys);
  }

  /**
   * Invalidate all sales-related caches
   * Call after: invoice created, payment received, invoice cancelled
   */
  async invalidateSalesCache(): Promise<void> {
    const keys = [
      this.buildSalesKey('today'),
      this.buildSalesKey('week'),
      this.buildSalesKey('month'),
      this.buildChartKey('sales', 7),
      this.buildChartKey('sales', 30),
      this.buildKpiKey(), // Main KPI includes sales
    ];
    await this.invalidateKeys(keys);
  }

  /**
   * Invalidate delivery-related caches
   * Call after: delivery validated, cancelled, created
   */
  async invalidateDeliveryCache(): Promise<void> {
    const keys = [
      this.buildDeliveryKey('pending'),
      this.buildDeliveryKey('today'),
      this.buildDeliveryKey('stats'),
      this.buildKpiKey(),
    ];
    await this.invalidateKeys(keys);
  }

  /**
   * Invalidate sync-related caches
   * Call after: sync events applied, device status changed
   */
  async invalidateSyncCache(): Promise<void> {
    const keys = [
      this.buildSyncKey('pending'),
      this.buildSyncKey('status'),
      this.buildKpiKey(),
    ];
    await this.invalidateKeys(keys);
  }

  /**
   * Invalidate production-related caches
   * Call after: production order completed, cancelled
   */
  async invalidateProductionCache(): Promise<void> {
    const keys = [
      this.buildChartKey('production', 7),
      this.buildChartKey('production', 30),
      this.buildStockKey('mp'), // Production consumes MP
      this.buildStockKey('pf'), // Production creates PF
      this.buildKpiKey(),
    ];
    await this.invalidateKeys(keys);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // METRICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get cache performance metrics
   */
  getMetrics(): {
    hits: number;
    misses: number;
    sets: number;
    invalidations: number;
    hitRate: number;
  } {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? (this.metrics.hits / total) * 100 : 0,
    };
  }

  /**
   * Reset metrics (for testing/monitoring)
   */
  resetMetrics(): void {
    this.metrics = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
  }

  /**
   * Log current metrics summary
   */
  logMetricsSummary(): void {
    const metrics = this.getMetrics();
    this.logger.log(
      `[METRICS] Hits: ${metrics.hits}, Misses: ${metrics.misses}, ` +
      `Hit Rate: ${metrics.hitRate.toFixed(1)}%, Sets: ${metrics.sets}, ` +
      `Invalidations: ${metrics.invalidations}`,
    );
  }
}
