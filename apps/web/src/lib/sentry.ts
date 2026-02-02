/**
 * Sentry Integration for Manchengo ERP Frontend
 *
 * Initialize in layout.tsx or providers.tsx:
 *   import { initSentry } from '@/lib/sentry';
 *   initSentry();
 */

let sentryInitialized = false;

export async function initSentry() {
  if (sentryInitialized) return;
  if (typeof window === 'undefined') return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      // Filter noisy errors
      ignoreErrors: [
        'ResizeObserver loop',
        'Non-Error promise rejection',
        'Network request failed',
      ],

      beforeSend(event) {
        // Strip sensitive data
        if (event.request?.cookies) {
          delete event.request.cookies;
        }
        return event;
      },
    });

    sentryInitialized = true;
  } catch {
    // Sentry not available, silently fail
  }
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  try {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.withScope((scope) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }
        Sentry.captureException(error);
      });
    });
  } catch {
    // Sentry not available
  }
}

export function setUser(user: { id: string; email: string; role: string }) {
  try {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.setUser({ id: user.id, email: user.email });
      Sentry.setTag('role', user.role);
    });
  } catch {
    // Sentry not available
  }
}
