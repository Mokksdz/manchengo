'use client';

import { Check } from 'lucide-react';

/**
 * AllClearBanner — Glassmorphism "tout va bien" confirmation panel
 *
 * Displayed when there are no blocking MPs, no ruptures,
 * no pending BCs, and no active critical alerts.
 */
export function AllClearBanner() {
  return (
    <div className="glass-card p-10 text-center">
      <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-[#34C759]/10 to-[#30D158]/5 flex items-center justify-center mx-auto mb-4">
        <Check className="w-7 h-7 text-[#34C759]/70" />
      </div>
      <p className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">
        Production sécurisée
      </p>
      <p className="text-[13px] text-[#AEAEB2] mt-2 max-w-xs mx-auto leading-relaxed">
        Aucun blocage détecté — Approvisionnements sous contrôle
      </p>
    </div>
  );
}
