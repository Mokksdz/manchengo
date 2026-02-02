import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';

/**
 * Centralized Log Aggregation Service
 *
 * Configures Pino for structured JSON logging suitable for:
 * - ELK Stack (Elasticsearch + Logstash + Kibana)
 * - CloudWatch Logs
 * - DataDog Log Management
 * - Any JSON-based log aggregation pipeline
 *
 * In production: JSON output to stdout (container logs → aggregator)
 * In development: Pretty-printed human-readable output
 */
@Injectable()
export class LogAggregationService implements OnModuleInit {
  private logger: pino.Logger;

  constructor(private configService: ConfigService) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    this.logger = pino({
      level: isProduction ? 'info' : 'debug',
      timestamp: pino.stdTimeFunctions.isoTime,

      // Base fields added to every log entry
      base: {
        service: 'manchengo-backend',
        version: '1.0.0',
        environment: this.configService.get('NODE_ENV', 'development'),
      },

      // Redact sensitive fields automatically
      redact: {
        paths: [
          'password',
          'passwordHash',
          'token',
          'refreshToken',
          'accessToken',
          'authorization',
          'cookie',
          'req.headers.authorization',
          'req.headers.cookie',
        ],
        censor: '[REDACTED]',
      },

      // Pretty print in development only
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          },
    });
  }

  onModuleInit() {
    this.logger.info('Log aggregation service initialized');
  }

  /**
   * Log a business event (for analytics and audit)
   */
  business(action: string, data: Record<string, unknown>) {
    this.logger.info({ type: 'business', action, ...data });
  }

  /**
   * Log an API request (for monitoring)
   */
  request(data: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    userId?: string;
    requestId?: string;
  }) {
    this.logger.info({ type: 'request', ...data });
  }

  /**
   * Log a security event (for SIEM)
   */
  security(event: string, data: Record<string, unknown>) {
    this.logger.warn({ type: 'security', event, ...data });
  }

  /**
   * Log a performance metric
   */
  metric(name: string, value: number, tags?: Record<string, string>) {
    this.logger.info({ type: 'metric', metric: name, value, tags });
  }

  /**
   * Log an error with context
   */
  error(message: string, error: Error, context?: Record<string, unknown>) {
    this.logger.error({
      type: 'error',
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    });
  }

  getLogger(): pino.Logger {
    return this.logger;
  }
}
