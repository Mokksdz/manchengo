import { Module, Global, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Global()
@Module({})
export class SentryModule implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    const environment = this.configService.get<string>('NODE_ENV', 'development');

    if (!dsn) {
      return; // Sentry disabled if no DSN
    }

    Sentry.init({
      dsn,
      environment,
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      profilesSampleRate: 0.1,
      integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration(),
        Sentry.prismaIntegration(),
      ],
      // Sanitize sensitive data
      beforeSend(event) {
        if (event.request?.cookies) {
          delete event.request.cookies;
        }
        if (event.request?.headers?.authorization) {
          event.request.headers.authorization = '[REDACTED]';
        }
        return event;
      },
    });
  }
}
