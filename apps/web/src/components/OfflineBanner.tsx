'use client';

import { useOnlineStatus } from '@/hooks/use-online-status';
import { WifiOff } from 'lucide-react';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OFFLINE BANNER — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R13: Composant OfflineBanner intégré au layout
 *
 * Shows a prominent banner when the user loses internet connection.
 * Critical for ERP users in Algerian factories with unstable internet.
 * Prevents silent form submission failures.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[9999] bg-[#C62828] text-white px-4 py-3 flex items-center justify-center gap-3 shadow-lg"
    >
      <WifiOff className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <div className="text-sm font-medium">
        <span className="font-bold">Connexion perdue</span>
        {' — '}
        <span>Vos modifications ne seront pas enregistrées. Vérifiez votre connexion internet.</span>
      </div>
    </div>
  );
}
