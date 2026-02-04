import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { PerformanceService } from './performance.service';
import { SentryInterceptor } from './sentry.interceptor';

@Global()
@Module({
  providers: [PerformanceService, SentryInterceptor],
  exports: [PerformanceService, SentryInterceptor],
})
export class SentryModule implements OnModuleInit {
  private readonly logger = new Logger(SentryModule.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    const environment = this.configService.get<string>('NODE_ENV', 'development');
    const release = this.configService.get<string>('APP_VERSION', '1.0.0');

    if (!dsn) {
      this.logger.log('Sentry DSN not configured - monitoring disabled');
      return;
    }

    Sentry.init({
      dsn,
      environment,
      release: `manchengo-erp@${release}`,

      // Performance monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      profilesSampleRate: environment === 'production' ? 0.1 : 0.5,

      // Enable all default integrations
      integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration(),
        Sentry.prismaIntegration(),
        Sentry.onUncaughtExceptionIntegration({
          exitEvenIfOtherHandlersAreRegistered: false,
        }),
        Sentry.onUnhandledRejectionIntegration(),
      ],

      // Performance settings
      maxBreadcrumbs: 50,
      attachStacktrace: true,

      // Ignore common noise
      ignoreErrors: [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'Request aborted',
        'Navigation cancelled',
      ],

      // Sanitize sensitive data before sending
      beforeSend(event) {
        // Remove cookies
        if (event.request?.cookies) {
          delete event.request.cookies;
        }

        // Redact authorization headers
        if (event.request?.headers) {
          const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
          sensitiveHeaders.forEach((header) => {
            if (event.request?.headers?.[header]) {
              event.request.headers[header] = '[REDACTED]';
            }
          });
        }

        // Redact sensitive body fields
        if (event.request?.data && typeof event.request.data === 'string') {
          try {
            const data = JSON.parse(event.request.data);
            const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
            sensitiveFields.forEach((field) => {
              if (data[field]) {
                data[field] = '[REDACTED]';
              }
            });
            event.request.data = JSON.stringify(data);
          } catch {
            // Not JSON, leave as is
          }
        }

        return event;
      },

      // Custom transaction sampling
      tracesSampler: (context) => {
        // Don't trace health checks
        if (context.transactionContext.name?.includes('/health')) {
          return 0;
        }
        if (context.transactionContext.name?.includes('/metrics')) {
          return 0;
        }

        // Sample production at lower rate
        return environment === 'production' ? 0.1 : 1.0;
      },
    });

    this.logger.log(`Sentry initialized for environment: ${environment}`);
  }
}
