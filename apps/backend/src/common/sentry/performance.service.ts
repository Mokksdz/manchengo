import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

/**
 * Performance Monitoring Service
 * Provides APM capabilities with Sentry integration
 */
@Injectable()
export class PerformanceService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceService.name);
  private enabled = false;

  // Performance thresholds (ms)
  private readonly thresholds = {
    database: 500, // Slow query threshold
    api: 2000, // Slow API response threshold
    external: 3000, // External service timeout threshold
  };

  // Metrics storage for internal tracking
  private metrics = new Map<string, { count: number; totalTime: number; maxTime: number }>();

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.enabled = !!this.configService.get<string>('SENTRY_DSN');
    if (this.enabled) {
      this.logger.log('Performance monitoring enabled');
    }
  }

  /**
   * Start a performance transaction
   */
  startTransaction(name: string, op: string): Sentry.Span | null {
    if (!this.enabled) return null;

    return Sentry.startInactiveSpan({
      name,
      op,
      forceTransaction: true,
    });
  }

  /**
   * Create a child span within an existing transaction
   */
  startSpan(name: string, op: string): Sentry.Span | null {
    if (!this.enabled) return null;

    return Sentry.startInactiveSpan({
      name,
      op,
    });
  }

  /**
   * Measure the execution time of a function
   */
  async measure<T>(
    name: string,
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await Sentry.startSpan(
        {
          name,
          op: operation,
          attributes: metadata as Record<string, string | number | boolean>,
        },
        async () => {
          return fn();
        },
      );

      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);

      // Alert on slow operations
      this.checkThreshold(name, operation, duration, metadata);

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(`${name}.error`, duration);
      throw error;
    }
  }

  /**
   * Measure database query performance
   */
  async measureQuery<T>(
    queryName: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    return this.measure(queryName, 'db.query', fn, metadata);
  }

  /**
   * Measure external HTTP call performance
   */
  async measureHttp<T>(
    endpoint: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    return this.measure(endpoint, 'http.client', fn, metadata);
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, duration: number): void {
    const existing = this.metrics.get(name) || { count: 0, totalTime: 0, maxTime: 0 };
    this.metrics.set(name, {
      count: existing.count + 1,
      totalTime: existing.totalTime + duration,
      maxTime: Math.max(existing.maxTime, duration),
    });
  }

  /**
   * Get aggregated metrics
   */
  getMetrics(): Record<string, { count: number; avgTime: number; maxTime: number }> {
    const result: Record<string, { count: number; avgTime: number; maxTime: number }> = {};
    this.metrics.forEach((value, key) => {
      result[key] = {
        count: value.count,
        avgTime: value.count > 0 ? value.totalTime / value.count : 0,
        maxTime: value.maxTime,
      };
    });
    return result;
  }

  /**
   * Reset metrics (call periodically or at start of aggregation window)
   */
  resetMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Check if operation exceeds threshold and alert
   */
  private checkThreshold(
    name: string,
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ): void {
    const threshold = this.getThresholdForOperation(operation);

    if (duration > threshold) {
      this.logger.warn(
        `Slow ${operation}: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`,
        metadata,
      );

      // Send to Sentry as a performance issue
      if (this.enabled) {
        Sentry.withScope((scope) => {
          scope.setLevel('warning');
          scope.setTag('performance', 'slow_operation');
          scope.setTag('operation_type', operation);
          scope.setExtra('duration_ms', duration);
          scope.setExtra('threshold_ms', threshold);
          scope.setExtra('metadata', metadata);
          Sentry.captureMessage(`Slow operation: ${name} (${duration.toFixed(0)}ms)`);
        });
      }
    }
  }

  /**
   * Get threshold for operation type
   */
  private getThresholdForOperation(operation: string): number {
    if (operation.startsWith('db.')) {
      return this.thresholds.database;
    }
    if (operation.startsWith('http.')) {
      return this.thresholds.external;
    }
    return this.thresholds.api;
  }

  /**
   * Add custom breadcrumb for debugging
   */
  addBreadcrumb(
    category: string,
    message: string,
    level: Sentry.SeverityLevel = 'info',
    data?: Record<string, unknown>,
  ): void {
    if (!this.enabled) return;

    Sentry.addBreadcrumb({
      category,
      message,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Set user context for tracing
   */
  setUserContext(userId: string, email?: string, role?: string): void {
    if (!this.enabled) return;

    Sentry.setUser({
      id: userId,
      email,
    });

    if (role) {
      Sentry.setTag('user_role', role);
    }
  }

  /**
   * Clear user context (on logout)
   */
  clearUserContext(): void {
    if (!this.enabled) return;
    Sentry.setUser(null);
  }

  /**
   * Capture a custom metric to Sentry
   */
  captureMetric(name: string, value: number, unit: string, _tags?: Record<string, string>): void {
    if (!this.enabled) return;

    // Use Sentry metrics if available
    try {
      Sentry.metrics.gauge(name, value, {
        unit,
      } as any);
    } catch {
      // Metrics API might not be available in all Sentry versions
      this.logger.debug(`Metric captured locally: ${name}=${value}${unit}`);
    }
  }
}
