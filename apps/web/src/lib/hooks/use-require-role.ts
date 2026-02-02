'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/**
 * Hook to enforce role-based access on a page.
 * Redirects to /dashboard if user's role is not in the allowed list.
 */
export function useRequireRole(allowedRoles: string[]) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      // A30: Delay redirect slightly so "Accès interdit" message can render
      const timer = setTimeout(() => router.replace('/dashboard'), 2000);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, allowedRoles, router]);

  const hasAccess = !isLoading && user && allowedRoles.includes(user.role);
  // A30: Distinguish between loading and access denied
  const isAccessDenied = !isLoading && user && !allowedRoles.includes(user.role);

  return { hasAccess, isLoading, user, isAccessDenied };
}
