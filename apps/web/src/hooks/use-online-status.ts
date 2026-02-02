'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect online/offline status
 *
 * WHY: ERP users in Algerian factories may have unstable internet.
 * This hook allows showing a banner when offline so users don't
 * submit forms that will silently fail.
 *
 * Usage:
 *   const isOnline = useOnlineStatus();
 *   if (!isOnline) return <OfflineBanner />;
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true; // Default to online during SSR
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
