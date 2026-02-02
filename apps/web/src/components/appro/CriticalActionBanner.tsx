'use client';

import Link from 'next/link';
import { ArrowRight, AlertTriangle } from 'lucide-react';

/**
 * CriticalActionBanner — Premium Glassmorphism Alert Banner
 *
 * Apple Silicon inspired:
 * - Frosted glass with warm red-tinted backdrop
 * - Floating design with soft depth shadows
 * - Elegant gradient accent with subtle animation
 * - Clean action hierarchy with pill-shaped CTAs
 */

export type UserRole = 'APPRO' | 'ADMIN' | 'PRODUCTION' | 'COMMERCIAL' | 'COMPTABLE';

export interface CriticalActionBannerProps {
  blockingMpCount: number;
  productionBlocked: boolean;
  userRole: UserRole;
  blockingMpName?: string;
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
}

export function CriticalActionBanner({
  blockingMpCount,
  productionBlocked,
  userRole,
  blockingMpName,
  primaryAction,
  secondaryAction,
}: CriticalActionBannerProps) {
  if (blockingMpCount === 0 && !productionBlocked) {
    return null;
  }

  const isAdmin = userRole === 'ADMIN';

  return (
    <div className="relative rounded-[20px] overflow-hidden" style={{
      background: 'rgba(255, 255, 255, 0.75)',
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      boxShadow: `
        0 0 0 0.5px rgba(255, 59, 48, 0.1),
        0 1px 2px rgba(255, 59, 48, 0.04),
        0 4px 16px rgba(255, 59, 48, 0.06),
        0 12px 40px rgba(0, 0, 0, 0.04)
      `,
      border: '0.5px solid rgba(255, 255, 255, 0.6)',
    }}>
      {/* Subtle warm gradient overlay at top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#FF3B30]/40 via-[#FF6961]/20 to-transparent" />

      {/* Very subtle background tint */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF3B30]/[0.02] to-transparent pointer-events-none" />

      <div className="relative p-6">
        <div className="flex items-start gap-5">
          {/* Alert icon with glow */}
          <div className="flex-shrink-0 w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#FF3B30]/12 to-[#FF6961]/5 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-[#FF3B30]/80" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Severity pill */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-[6px] h-[6px] rounded-full bg-[#FF3B30] animate-pulse" />
              <span className="text-[11px] font-semibold text-[#FF3B30]/80 uppercase tracking-[0.08em]">
                Action requise
              </span>
            </div>

            {/* Title */}
            <h2 className="text-[17px] font-semibold text-[#1D1D1F] leading-tight tracking-[-0.01em]">
              {blockingMpCount === 1
                ? `Production bloquée par ${blockingMpName ? `"${blockingMpName}"` : '1 matière première'}`
                : `Production bloquée par ${blockingMpCount} matières premières`
              }
            </h2>

            {/* Subtitle */}
            <p className="mt-1.5 text-[13px] text-[#86868B] leading-relaxed">
              {isAdmin
                ? 'Intervention requise pour débloquer la situation'
                : 'Action immédiate requise pour éviter l\'arrêt de production'
              }
            </p>

            {/* Actions */}
            <div className="mt-5 flex items-center gap-3">
              <Link
                href={primaryAction.href}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white text-[13px] font-medium rounded-full hover:bg-[#333336] transition-all duration-200 hover:shadow-lg hover:shadow-black/10"
              >
                {primaryAction.label}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              {secondaryAction && (
                <Link
                  href={secondaryAction.href}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] rounded-full transition-all duration-200 hover:bg-black/[0.03]"
                >
                  {secondaryAction.label}
                </Link>
              )}

              {/* Role pill */}
              <span className="ml-auto glass-pill text-[#AEAEB2]">
                {isAdmin ? 'Admin' : 'Appro'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
