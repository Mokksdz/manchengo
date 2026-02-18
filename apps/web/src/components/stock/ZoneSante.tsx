'use client';

import { TrendingUp, RotateCcw, Calendar, Lock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZoneSante as ZoneSanteType, StockDashboardSummary } from '@/lib/api';

interface ZoneSanteProps {
  data: ZoneSanteType;
  summary: StockDashboardSummary;
}

/* ──── Mini gauge ──── */
function Gauge({ value, label, icon: Icon, thresholds }: {
  value: number;
  label: string;
  icon: React.ElementType;
  thresholds: { good: number; warning: number };
}) {
  const color = value >= thresholds.good ? '#34C759' : value >= thresholds.warning ? '#FF9500' : '#FF3B30';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3 w-3 text-[#C7C7CC]" />
            <span className="text-[12px] font-medium text-[#8E8E93]">{label}</span>
          </div>
          <span className="text-[13px] font-bold text-[#1D1D1F] tabular-nums">
            {value.toFixed(0)}%
          </span>
        </div>
        <div className="h-[4px] bg-[#F0F0F0] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

/* ──── Main ring score ──── */
function ScoreRing({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  const color = score >= 80 ? '#34C759' : score >= 60 ? '#FF9500' : score >= 40 ? '#FF9500' : '#FF3B30';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Correct' : score >= 40 ? 'À surveiller' : 'Critique';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[100px] h-[100px]">
        {/* Background ring */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#F0F0F0" strokeWidth="5" />
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-bold text-[#1D1D1F] tabular-nums leading-none">{score}</span>
          <span className="text-[10px] text-[#C7C7CC] mt-0.5">/100</span>
        </div>
      </div>
      <span className="text-[13px] font-semibold mt-2" style={{ color }}>{label}</span>
    </div>
  );
}

/* ──── Metric pill ──── */
function MetricPill({ label, value, icon: Icon, alert }: {
  label: string;
  value: string;
  icon: React.ElementType;
  alert: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[#F0F0F0] hover:border-[#E5E5E5] transition-colors">
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
        alert ? 'bg-[#FF9500]/8' : 'bg-[#F5F5F7]'
      )}>
        <Icon className={cn('h-4 w-4', alert ? 'text-[#FF9500]' : 'text-[#C7C7CC]')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[#8E8E93]">{label}</p>
        <p className={cn('text-[15px] font-bold tabular-nums', alert ? 'text-[#FF9500]' : 'text-[#1D1D1F]')}>{value}</p>
      </div>
    </div>
  );
}

export function ZoneSante({ data, summary }: ZoneSanteProps) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden h-full flex flex-col">
      {/* Accent bar — always green for health */}
      <div className="h-[3px] bg-gradient-to-r from-[#34C759] to-[#30D158]" />

      {/* Header */}
      <div className="px-5 py-4 border-b border-[#F0F0F0]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#34C759]" />
          <h3 className="text-[15px] font-semibold text-[#1D1D1F]">Santé du stock</h3>
        </div>
        <p className="text-[12px] text-[#8E8E93] mt-0.5 ml-5">Performance & conformité</p>
      </div>

      {/* Content */}
      <div className="flex-1 p-5">
        {/* Score ring — centered hero */}
        <div className="flex justify-center mb-6">
          <ScoreRing score={summary.healthScore} />
        </div>

        {/* Gauges */}
        <div className="space-y-4 mb-5">
          <Gauge value={data.fifoCompliance} label="Conformité FIFO" icon={TrendingUp} thresholds={{ good: 95, warning: 80 }} />
          <Gauge value={data.stockRotation} label="Rotation stock" icon={RotateCcw} thresholds={{ good: 70, warning: 50 }} />
          <Gauge value={data.inventoryFreshness} label="Fraîcheur inventaire" icon={Calendar} thresholds={{ good: 80, warning: 60 }} />
        </div>

        {/* Bottom metrics */}
        <div className="grid grid-cols-2 gap-2">
          <MetricPill
            label="Lots bloqués"
            value={`${data.blockedLotsRatio.toFixed(1)}%`}
            icon={Lock}
            alert={data.blockedLotsRatio > 5}
          />
          <MetricPill
            label="Risque DLC"
            value={`${data.expiryRiskScore.toFixed(1)}%`}
            icon={AlertTriangle}
            alert={data.expiryRiskScore > 20}
          />
        </div>
      </div>
    </div>
  );
}
