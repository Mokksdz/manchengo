/**
 * Sentry Client Configuration
 * This file configures Sentry for the browser/client-side
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session Replay for error debugging
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% when error occurs

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance monitoring configuration
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/.*\.manchengo\.com/,
      /^\/api\//,
    ],

    // Filter noisy errors
    ignoreErrors: [
      // Browser extension errors
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // ResizeObserver loop limit exceeded
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Non-error promise rejections
      'Non-Error promise rejection captured',
      // Network errors
      'Network request failed',
      'Load failed',
      'Failed to fetch',
      // User abort
      'AbortError',
    ],

    // Sanitize sensitive data before sending
    beforeSend(event) {
      // Remove cookies
      if (event.request?.cookies) {
        delete event.request.cookies;
      }

      // Redact authorization headers
      if (event.request?.headers?.authorization) {
        event.request.headers.authorization = '[REDACTED]';
      }

      // Redact sensitive URL parameters
      if (event.request?.query_string) {
        const params = new URLSearchParams(event.request.query_string);
        ['token', 'password', 'secret', 'key', 'api_key'].forEach(key => {
          if (params.has(key)) {
            params.set(key, '[REDACTED]');
          }
        });
        event.request.query_string = params.toString();
      }

      return event;
    },

    // Custom sampling for transactions
    beforeSendTransaction(event) {
      // Ignore health check transactions
      if (event.transaction?.includes('/health')) {
        return null;
      }
      return event;
    },
  });
}
