import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE INTERCEPTOR — Manchengo Smart ERP
// ═══════════════════════════════════════════════════════════════════════════════
// Logs response times for all API endpoints
// Helps identify slow endpoints for optimization
// ═══════════════════════════════════════════════════════════════════════════════

// Threshold in ms - log warning for slow requests
const SLOW_REQUEST_THRESHOLD = 500;
const VERY_SLOW_REQUEST_THRESHOLD = 2000;

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');

  // Metrics storage (in-memory, reset on restart)
  private metrics: Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    maxTime: number;
    minTime: number;
    slowCount: number;
  }> = new Map();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const startTime = Date.now();

    // Build route key (normalize parameters)
    const routeKey = this.normalizeRoute(method, url);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.recordMetrics(routeKey, duration);
          this.logRequest(method, url, duration);
        },
        error: () => {
          const duration = Date.now() - startTime;
          this.recordMetrics(routeKey, duration);
          this.logRequest(method, url, duration, true);
        },
      }),
    );
  }

  /**
   * Normalize route for metrics aggregation
   * Replace UUIDs and IDs with placeholders
   */
  private normalizeRoute(method: string, url: string): string {
    // Remove query string
    const path = url.split('?')[0];
    
    // Replace UUIDs with :id
    const normalized = path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
      .replace(/\/\d+/g, '/:id');

    return `${method} ${normalized}`;
  }

  /**
   * Record metrics for a route
   */
  private recordMetrics(routeKey: string, duration: number): void {
    const existing = this.metrics.get(routeKey) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
      minTime: Infinity,
      slowCount: 0,
    };

    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = Math.round(existing.totalTime / existing.count);
    existing.maxTime = Math.max(existing.maxTime, duration);
    existing.minTime = Math.min(existing.minTime, duration);

    if (duration >= SLOW_REQUEST_THRESHOLD) {
      existing.slowCount++;
    }

    this.metrics.set(routeKey, existing);
  }

  /**
   * Log request with appropriate level based on duration
   */
  private logRequest(
    method: string,
    url: string,
    duration: number,
    isError = false,
  ): void {
    const status = isError ? '❌' : '✅';

    if (duration >= VERY_SLOW_REQUEST_THRESHOLD) {
      this.logger.warn(
        `🐢 VERY SLOW ${status} ${method} ${url} — ${duration}ms`,
      );
    } else if (duration >= SLOW_REQUEST_THRESHOLD) {
      this.logger.warn(
        `⚠️ SLOW ${status} ${method} ${url} — ${duration}ms`,
      );
    } else {
      this.logger.debug(
        `${status} ${method} ${url} — ${duration}ms`,
      );
    }
  }

  /**
   * Get performance metrics summary
   */
  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    this.metrics.forEach((value, key) => {
      result[key] = {
        ...value,
        minTime: value.minTime === Infinity ? 0 : value.minTime,
      };
    });

    return result;
  }

  /**
   * Get top slow endpoints
   */
  getSlowEndpoints(limit = 10): Array<{
    route: string;
    avgTime: number;
    maxTime: number;
    slowCount: number;
    count: number;
  }> {
    const entries = Array.from(this.metrics.entries())
      .map(([route, stats]) => ({
        route,
        avgTime: stats.avgTime,
        maxTime: stats.maxTime,
        slowCount: stats.slowCount,
        count: stats.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);

    return entries;
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics.clear();
  }
}
