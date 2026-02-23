import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';
import { COOKIE_NAMES } from '../../auth/config/cookie.config';

/**
 * CSRF Protection Middleware
 *
 * Defense-in-depth alongside SameSite cookies.
 * Generates a CSRF token via GET /api/auth/csrf-token,
 * then validates it on state-changing requests (POST, PUT, DELETE, PATCH).
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private static readonly CSRF_HEADER = 'x-csrf-token';
  private static readonly CSRF_COOKIE = 'csrf-token';
  private static readonly TOKEN_LENGTH = 32;

  // Methods that require CSRF validation
  private static readonly UNSAFE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

  // Paths exempt from CSRF (login needs to work without a prior token)
  // NOTE: req.path INCLUDES the global prefix '/api' when middleware runs
  private static readonly EXEMPT_PATHS = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/health',
    '/api/health/ready',
    '/api/health/detailed',
    '/api/metrics',
    '/api/sync/events', // Mobile sync uses device auth
  ];

  use(req: Request, res: Response, next: NextFunction) {
    // Skip safe methods
    if (!CsrfMiddleware.UNSAFE_METHODS.includes(req.method)) {
      return next();
    }

    // Skip exempt paths
    if (CsrfMiddleware.EXEMPT_PATHS.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Skip if no cookies (API-only clients with Bearer tokens)
    const hasCookieAuth = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
    if (!hasCookieAuth) {
      return next();
    }

    // Validate CSRF token
    const cookieToken = req.cookies?.[CsrfMiddleware.CSRF_COOKIE];
    const headerToken = req.headers[CsrfMiddleware.CSRF_HEADER] as string;

    if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length) {
      throw new ForbiddenException('CSRF token invalide ou manquant');
    }

    // Timing-safe comparison to prevent timing attacks
    const cookieBuffer = Buffer.from(cookieToken, 'utf-8');
    const headerBuffer = Buffer.from(headerToken, 'utf-8');
    if (!timingSafeEqual(cookieBuffer, headerBuffer)) {
      throw new ForbiddenException('CSRF token invalide ou manquant');
    }

    next();
  }

  /**
   * Generate a new CSRF token and set it as a cookie.
   * Called by GET /api/auth/csrf-token
   */
  static generateToken(res: Response): string {
    const token = randomBytes(CsrfMiddleware.TOKEN_LENGTH).toString('hex');

    res.cookie(CsrfMiddleware.CSRF_COOKIE, token, {
      httpOnly: false, // Must be readable by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes (matches access token)
      path: '/',
    });

    return token;
  }
}
