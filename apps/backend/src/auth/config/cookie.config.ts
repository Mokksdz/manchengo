import { CookieOptions } from 'express';

// ═══════════════════════════════════════════════════════════════════════════════
// COOKIE CONFIGURATION - Security-hardened httpOnly cookies
// ═══════════════════════════════════════════════════════════════════════════════
//
// HARDENING NOTES (Post-audit):
//   - Production uses __Host- prefix (binding to origin, prevents SLD injection)
//   - sameSite: 'strict' en prod (CSRF defense-in-depth)
//   - secure: true enforced in production (HTTPS mandatory)
//   - Refresh cookie TTL aligned with env (1d) — NOT hardcoded 7d
//   - __Host- prefix requires: secure=true, path='/', no domain attribute
//     → refresh cookie cannot use __Host- (path=/api/auth), uses __Secure- instead
// ═══════════════════════════════════════════════════════════════════════════════

const isProduction = process.env.NODE_ENV === 'production';
const sameSitePolicy: 'strict' | 'lax' = isProduction ? 'strict' : 'lax';

/**
 * Cookie name prefix strategy:
 *   __Host-   = secure + path=/ + no domain  (strongest, access token)
 *   __Secure- = secure only                  (refresh token, needs path=/api/auth)
 *   No prefix in development (localhost doesn't support __Host-)
 */
const ACCESS_PREFIX = isProduction ? '__Host-' : '';
const REFRESH_PREFIX = isProduction ? '__Secure-' : '';

/**
 * Access Token Cookie Configuration
 * - Short expiration (15 minutes)
 * - httpOnly: Not accessible via JavaScript (XSS protection)
 * - secure: HTTPS only in production
 * - sameSite: Strict CSRF protection
 * - __Host- prefix in production (origin-bound, no SLD injection)
 */
export const ACCESS_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: sameSitePolicy,
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
  // NOTE: __Host- prefix requires NO domain attribute — omit domain entirely
};

/**
 * Refresh Token Cookie Configuration
 * - TTL aligned with JWT_REFRESH_EXPIRES_IN (default 1d)
 * - httpOnly: Not accessible via JavaScript (XSS protection)
 * - secure: HTTPS only in production
 * - sameSite: Strict CSRF protection
 * - path: Restricted to auth endpoints only
 * - __Secure- prefix in production (can't use __Host- with path != '/')
 */
export const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: sameSitePolicy,
  path: '/api/auth', // Only sent to auth endpoints
  maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day — aligned with JWT_REFRESH_EXPIRES_IN
};

/**
 * Cookie names - centralized for consistency
 * Production uses __Host- / __Secure- prefixes for cookie hardening
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: `${ACCESS_PREFIX}access_token`,
  REFRESH_TOKEN: `${REFRESH_PREFIX}refresh_token`,
} as const;

/**
 * Clear cookie options (for logout)
 * Must match the same options as the original cookies for browsers to clear them
 */
export const CLEAR_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: sameSitePolicy,
  path: '/',
  maxAge: 0,
};

export const CLEAR_REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: sameSitePolicy,
  path: '/api/auth',
  maxAge: 0,
};
