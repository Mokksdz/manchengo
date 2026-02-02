/**
 * Frontend Logger for Manchengo ERP
 * 
 * WHY: console.log in production is:
 * - Unprofessional (visible in browser DevTools)
 * - Potential security leak (may expose internal data)
 * - Unstructured and unsearchable
 * 
 * This logger:
 * - Is disabled in production by default
 * - Provides structured output in development
 * - Can be extended to send errors to monitoring (Sentry, etc.)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

const isDev = process.env.NODE_ENV !== 'production';

// In production, only errors are logged (and could be sent to monitoring)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = isDev ? 'debug' : 'error';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatLog(entry: LogEntry): string {
  const { level, module, message, timestamp } = entry;
  return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}`;
}

function createLogEntry(
  level: LogLevel,
  module: string,
  message: string,
  meta?: Record<string, unknown>
): LogEntry {
  return {
    level,
    module,
    message,
    timestamp: new Date().toISOString(),
    meta,
  };
}

/**
 * Create a logger instance for a specific module
 * 
 * Usage:
 * const log = createLogger('DashboardPage');
 * log.info('Loading data...');
 * log.error('Failed to fetch', { error: err.message });
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => {
      if (!shouldLog('debug')) return;
      const entry = createLogEntry('debug', module, message, meta);
      // eslint-disable-next-line no-console
      console.debug(formatLog(entry), meta || '');
    },

    info: (message: string, meta?: Record<string, unknown>) => {
      if (!shouldLog('info')) return;
      const entry = createLogEntry('info', module, message, meta);
      // eslint-disable-next-line no-console
      console.info(formatLog(entry), meta || '');
    },

    warn: (message: string, meta?: Record<string, unknown>) => {
      if (!shouldLog('warn')) return;
      const entry = createLogEntry('warn', module, message, meta);
      console.warn(formatLog(entry), meta || '');
    },

    error: (message: string, meta?: Record<string, unknown>) => {
      if (!shouldLog('error')) return;
      const entry = createLogEntry('error', module, message, meta);
      console.warn(formatLog(entry), meta || '');

      // Send errors to Sentry in production
      if (!isDev && typeof window !== 'undefined') {
        import('@/lib/sentry').then(({ captureError }) => {
          captureError(new Error(`[${module}] ${message}`), meta);
        }).catch(() => { /* Sentry not available */ });
      }
    },
  };
}

// Default logger for quick usage
export const logger = createLogger('App');
