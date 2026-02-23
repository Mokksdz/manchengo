import { NextResponse, type NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS — Set env vars to disable specific checks if issues arise
// MIDDLEWARE_JWT_EXPIRY_CHECK=false → disable JWT expiry validation
// MIDDLEWARE_SECURITY_HEADERS=false → disable security response headers
// MIDDLEWARE_RBAC_ENABLED=false → disable role-based route blocking
// JWT_CLOCK_SKEW_SECONDS=30 → allow clock drift (default 30s)
// ═══════════════════════════════════════════════════════════════════════════════

const JWT_EXPIRY_ENABLED = process.env.MIDDLEWARE_JWT_EXPIRY_CHECK !== 'false';
const SECURITY_HEADERS_ENABLED = process.env.MIDDLEWARE_SECURITY_HEADERS !== 'false';
const RBAC_ENABLED = process.env.MIDDLEWARE_RBAC_ENABLED !== 'false';
const CLOCK_SKEW_SECONDS = parseInt(process.env.JWT_CLOCK_SKEW_SECONDS || '30', 10);

// Route-to-role mapping for server-side protection
// Client-side useRequireRole remains as a fallback safety net
const PROTECTED_ROUTES: Record<string, string[]> = {
  '/dashboard/security': ['ADMIN'],
  '/dashboard/monitoring': ['ADMIN'],
  '/dashboard/exports': ['ADMIN'],
  '/dashboard/appro': ['ADMIN', 'APPRO'],
  '/dashboard/production': ['ADMIN', 'PRODUCTION'],
  '/dashboard/invoices': ['ADMIN', 'COMMERCIAL'],
  '/dashboard/clients': ['ADMIN', 'COMMERCIAL'],
};

// Security headers added to every response
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-dashboard routes
  if (!pathname.startsWith('/dashboard')) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Check for auth cookie existence
  const accessToken =
    request.cookies.get('__Host-access_token') ||
    request.cookies.get('access_token');
  if (!accessToken) {
    return addSecurityHeaders(
      NextResponse.redirect(new URL('/login', request.url)),
    );
  }

  // Decode JWT payload (without crypto verification — backend verifies on API calls)
  try {
    const parts = accessToken.value.split('.');
    if (parts.length !== 3) {
      return addSecurityHeaders(
        NextResponse.redirect(new URL('/login', request.url)),
      );
    }

    // Edge Runtime compatible base64 decode
    const payload = JSON.parse(atob(parts[1]));
    const userRole = payload.role;

    if (!userRole) {
      return addSecurityHeaders(
        NextResponse.redirect(new URL('/login', request.url)),
      );
    }

    // JWT expiry check (if enabled)
    if (JWT_EXPIRY_ENABLED && payload.exp) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
        // Token expired — redirect to login
        const response = NextResponse.redirect(new URL('/login', request.url));
        // Clear the expired cookie
        response.cookies.delete('access_token');
        response.cookies.delete('__Host-access_token');
        return addSecurityHeaders(response);
      }
    }

    // Check role-based access for protected routes (if enabled)
    if (RBAC_ENABLED) {
      for (const [route, allowedRoles] of Object.entries(PROTECTED_ROUTES)) {
        if (pathname.startsWith(route) && !allowedRoles.includes(userRole)) {
          return addSecurityHeaders(
            NextResponse.redirect(new URL('/dashboard', request.url)),
          );
        }
      }
    }
  } catch {
    // Invalid token format — redirect to login
    return addSecurityHeaders(
      NextResponse.redirect(new URL('/login', request.url)),
    );
  }

  return addSecurityHeaders(NextResponse.next());
}

/**
 * Add security headers to response (if feature flag is enabled)
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  if (!SECURITY_HEADERS_ENABLED) return response;

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
