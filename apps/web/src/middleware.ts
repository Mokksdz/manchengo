import { NextResponse, type NextRequest } from 'next/server';

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-dashboard routes
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  // Check for auth cookie existence
  // In production, cookie name has __Host- prefix for security hardening
  const accessToken =
    request.cookies.get('__Host-access_token') ||
    request.cookies.get('access_token');
  if (!accessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Decode JWT payload (without verification — backend verifies on API calls)
  try {
    const parts = accessToken.value.split('.');
    if (parts.length !== 3) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString(),
    );
    const userRole = payload.role;

    if (!userRole) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check role-based access for protected routes
    for (const [route, allowedRoles] of Object.entries(PROTECTED_ROUTES)) {
      if (pathname.startsWith(route) && !allowedRoles.includes(userRole)) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  } catch {
    // Invalid token format — redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
