'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ActionableKpiCard — Premium Glassmorphism KPI Card
 *
 * Apple Silicon inspired:
 * - Frosted glass background with backdrop-blur
 * - Soft floating shadow with depth
 * - Subtle gradient icon containers
 * - Ultra-clean SF Pro typography
 * - Micro-interaction on hover (lift + glow)
 */

export type KpiSeverity = 'critical' | 'warning' | 'neutral' | 'success';

export interface ActionableKpiCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  severity: KpiSeverity;
  actionLabel: string;
  href: string;
  subtitle?: string;
}

const severityConfig: Record<KpiSeverity, {
  dot: string;
  iconBg: string;
  iconColor: string;
  valueGlow: string;
  accentLine: string;
}> = {
  critical: {
    dot: 'bg-[#FF3B30]',
    iconBg: 'bg-gradient-to-br from-[#FF3B30]/10 to-[#FF6961]/5',
    iconColor: 'text-[#FF3B30]/70',
    valueGlow: 'text-[#1D1D1F]',
    accentLine: 'from-[#FF3B30]/20 via-[#FF3B30]/5 to-transparent',
  },
  warning: {
    dot: 'bg-[#FF9500]',
    iconBg: 'bg-gradient-to-br from-[#FF9500]/10 to-[#FFAC33]/5',
    iconColor: 'text-[#FF9500]/70',
    valueGlow: 'text-[#1D1D1F]',
    accentLine: 'from-[#FF9500]/20 via-[#FF9500]/5 to-transparent',
  },
  neutral: {
    dot: 'bg-[#8E8E93]',
    iconBg: 'bg-gradient-to-br from-[#8E8E93]/10 to-[#AEAEB2]/5',
    iconColor: 'text-[#8E8E93]/70',
    valueGlow: 'text-[#1D1D1F]',
    accentLine: 'from-[#8E8E93]/10 via-transparent to-transparent',
  },
  success: {
    dot: 'bg-[#34C759]',
    iconBg: 'bg-gradient-to-br from-[#34C759]/10 to-[#30D158]/5',
    iconColor: 'text-[#34C759]/70',
    valueGlow: 'text-[#1D1D1F]',
    accentLine: 'from-[#34C759]/15 via-[#34C759]/3 to-transparent',
  },
};

export function ActionableKpiCard({
  title,
  value,
  icon: Icon,
  severity,
  actionLabel,
  href,
  subtitle,
}: ActionableKpiCardProps) {
  const config = severityConfig[severity];

  return (
    <Link
      href={href}
      className="group block glass-card-hover p-6 relative overflow-hidden"
    >
      {/* Subtle top accent gradient */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r',
        config.accentLine
      )} />

      {/* Top row: title + icon */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-[7px] h-[7px] rounded-full ring-[3px] ring-current/10', config.dot)} />
          <p className="text-[12px] font-bold uppercase tracking-widest text-[#86868B]">
            {title}
          </p>
        </div>
        <div className={cn(
          'w-10 h-10 rounded-[14px] flex items-center justify-center bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]',
          'transition-transform duration-300 group-hover:scale-105',
        )}>
          <Icon className={cn('w-[19px] h-[19px]', config.iconColor)} />
        </div>
      </div>

      {/* Metric */}
      <p className={cn(
        'font-display text-[34px] font-black leading-none tracking-tight tabular-nums',
        config.valueGlow,
        value > 0 && 'animate-number-pop'
      )}>
        {value}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-[11px] text-[#AEAEB2] mt-2 font-medium tracking-[0.01em]">{subtitle}</p>
      )}

      {/* Action */}
      <div className="mt-5 pt-4 border-t border-black/[0.04]">
        <span className="text-[13px] font-medium text-[#86868B] group-hover:text-[#1D1D1F] transition-colors duration-200">
          {actionLabel}
          <span className="inline-block ml-1.5 transition-transform duration-200 group-hover:translate-x-1">→</span>
        </span>
      </div>
    </Link>
  );
}
