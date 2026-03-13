'use client';

import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

/* ─── IRS Gauge Component ─── */
function IrsGauge({ value, status }: { value: number; status: string }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value, 100) / 100;
  const offset = circumference * (1 - progress);

  const statusConfig: Record<string, { color: string; gradient: string; label: string; bg: string }> = {
    SAIN: {
      color: '#34C759',
      gradient: 'url(#gaugeGradientSain)',
      label: 'Sain',
      bg: 'from-[#34C759]/8 to-[#30D158]/3',
    },
    SURVEILLANCE: {
      color: '#FF9500',
      gradient: 'url(#gaugeGradientSurv)',
      label: 'Surveillance',
      bg: 'from-[#FF9500]/8 to-[#FFAC33]/3',
    },
    CRITIQUE: {
      color: '#FF3B30',
      gradient: 'url(#gaugeGradientCrit)',
      label: 'Critique',
      bg: 'from-[#FF3B30]/8 to-[#FF6961]/3',
    },
  };

  const config = statusConfig[status] || statusConfig.SAIN;

  return (
    <div className="flex items-center gap-5">
      <div className="relative w-[100px] h-[100px]">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id="gaugeGradientSain" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34C759" />
              <stop offset="100%" stopColor="#30D158" />
            </linearGradient>
            <linearGradient id="gaugeGradientSurv" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF9500" />
              <stop offset="100%" stopColor="#FFAC33" />
            </linearGradient>
            <linearGradient id="gaugeGradientCrit" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF3B30" />
              <stop offset="100%" stopColor="#FF6961" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.04)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Progress */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={config.gradient}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="irs-gauge-ring"
            style={{ animation: 'gauge-fill 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[34px] font-black tracking-tight tabular-nums leading-none text-[#1D1D1F]">
            {value}
          </span>
          <span className="text-[9px] font-medium text-[#AEAEB2] uppercase tracking-[0.08em] mt-0.5">
            IRS
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: config.color }} />
          <span className="text-[13px] font-semibold text-[#1D1D1F]">
            {config.label}
          </span>
        </div>
        <p className="text-[12px] text-[#AEAEB2] leading-relaxed">
          Indice de Risque Stock
        </p>
      </div>
    </div>
  );
}

/* ─── IRS Gauge Panel Props ─── */
export interface IrsGaugePanelProps {
  irsValue: number;
  irsStatus: string;
  mpCritiques: number;
  bcEnRetard: number;
  alertesCritiques: number;
}

/**
 * IrsGaugePanel — IRS gauge visualization with mini stat pills
 *
 * Displays the Indice de Risque Stock gauge alongside key summary metrics.
 */
export function IrsGaugePanel({
  irsValue,
  irsStatus,
  mpCritiques,
  bcEnRetard,
  alertesCritiques,
}: IrsGaugePanelProps) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between">
        <IrsGauge value={irsValue} status={irsStatus} />
        <div className="hidden sm:flex items-center gap-6">
          {/* Mini stat pills */}
          <div className="text-center">
            <p className={cn('font-display text-[28px] font-black tracking-tight tabular-nums leading-none text-[#1D1D1F]', mpCritiques > 0 && 'animate-number-pop')}>{mpCritiques}</p>
            <p className="text-[11px] text-[#AEAEB2] mt-0.5">MP critiques</p>
          </div>
          <div className="w-[1px] h-8 bg-black/[0.04]" />
          <div className="text-center">
            <p className={cn('font-display text-[28px] font-black tracking-tight tabular-nums leading-none text-[#1D1D1F]', bcEnRetard > 0 && 'animate-number-pop')}>{bcEnRetard}</p>
            <p className="text-[11px] text-[#AEAEB2] mt-0.5">BC en retard</p>
          </div>
          <div className="w-[1px] h-8 bg-black/[0.04]" />
          <div className="text-center">
            <p className={cn('font-display text-[28px] font-black tracking-tight tabular-nums leading-none text-[#1D1D1F]', alertesCritiques > 0 && 'animate-number-pop')}>{alertesCritiques}</p>
            <p className="text-[11px] text-[#AEAEB2] mt-0.5">Alertes</p>
          </div>
        </div>
        <div className="hidden sm:block">
          <Activity className="w-5 h-5 text-[#D1D1D6]" />
        </div>
      </div>
    </div>
  );
}
