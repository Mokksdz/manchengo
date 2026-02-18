/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Unit tests for src/lib/logger.ts
 *
 * Tests the createLogger factory: method existence, development-mode logging,
 * and production-mode suppression of non-error levels.
 */

// We need to control process.env.NODE_ENV per test, so we use jest.isolateModules.

describe('createLogger', () => {
  let consoleSpy: {
    debug: jest.SpyInstance;
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns an object with debug, info, warn, and error methods', () => {
    jest.isolateModules(() => {
      const { createLogger } = require('../logger');
      const log = createLogger('TestModule');
      expect(typeof log.debug).toBe('function');
      expect(typeof log.info).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.error).toBe('function');
    });
  });

  it('exports a default logger instance', () => {
    jest.isolateModules(() => {
      const { logger } = require('../logger');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('development mode (NODE_ENV !== "production")', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('logs debug messages', () => {
      jest.isolateModules(() => {
        const { createLogger } = require('../logger');
        const log = createLogger('DevTest');
        log.debug('debug message');
        expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
        expect(consoleSpy.debug).toHaveBeenCalledWith(
          expect.stringContaining('[DEBUG]'),
          expect.anything(),
        );
      });
    });

    it('logs info messages', () => {
      jest.isolateModules(() => {
        const { createLogger } = require('../logger');
        const log = createLogger('DevTest');
        log.info('info message');
        expect(consoleSpy.info).toHaveBeenCalledTimes(1);
        expect(consoleSpy.info).toHaveBeenCalledWith(
          expect.stringContaining('[INFO]'),
          expect.anything(),
        );
      });
    });

    it('logs warn messages', () => {
      jest.isolateModules(() => {
        const { createLogger } = require('../logger');
        const log = createLogger('DevTest');
        log.warn('warn message');
        expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('[WARN]'),
          expect.anything(),
        );
      });
    });

    it('logs error messages', () => {
      jest.isolateModules(() => {
        const { createLogger } = require('../logger');
        const log = createLogger('DevTest');
        log.error('error message');
        // error() calls console.warn in the source code
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR]'),
          expect.anything(),
        );
      });
    });

    it('includes the module name in log output', () => {
      jest.isolateModules(() => {
        const { createLogger } = require('../logger');
        const log = createLogger('MyModule');
        log.info('test');
        expect(consoleSpy.info).toHaveBeenCalledWith(
          expect.stringContaining('[MyModule]'),
          expect.anything(),
        );
      });
    });

    it('passes meta data in log output', () => {
      jest.isolateModules(() => {
        const { createLogger } = require('../logger');
        const log = createLogger('MetaTest');
        const meta = { userId: '123', action: 'click' };
        log.info('with meta', meta);
        expect(consoleSpy.info).toHaveBeenCalledWith(
          expect.any(String),
          meta,
        );
      });
    });
  });

  describe('production mode (NODE_ENV === "production")', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('does NOT log debug messages', () => {
      process.env.NODE_ENV = 'production';
      jest.isolateModules(() => {
        const { createLogger } = require('../logger');
        const log = createLogger('ProdTest');
        log.debug('should be suppressed');
        expect(consoleSpy.debug).not.toHaveBeenCalled();
      });
    });

    it('does NOT log info messages', () => {
      process.env.NODE_ENV = 'production';
      jest.isolateModules(() => {
        const { createLogger } = require('../logger');
        const log = createLogger('ProdTest');
        log.info('should be suppressed');
        expect(consoleSpy.info).not.toHaveBeenCalled();
      });
    });

    it('does NOT log warn messages', () => {
      process.env.NODE_ENV = 'production';
      jest.isolateModules(() => {
        const { createLogger } = require('../logger');
        const log = createLogger('ProdTest');
        log.warn('should be suppressed');
        // warn level is below error in production min level
        // The warn method calls console.warn, but shouldLog('warn') is false in prod
        expect(consoleSpy.warn).not.toHaveBeenCalled();
      });
    });

    it('DOES log error messages in production', () => {
      process.env.NODE_ENV = 'production';

      // Mock dynamic import of sentry to prevent errors
      jest.mock('@/lib/sentry', () => ({
        captureError: jest.fn(),
      }), { virtual: true });

      jest.isolateModules(() => {
        const { createLogger } = require('../logger');
        const log = createLogger('ProdTest');
        log.error('critical failure');
        // error() uses console.warn in the source
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR]'),
          expect.anything(),
        );
      });
    });
  });
});
