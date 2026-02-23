'use client';

import { TrendingUp, RotateCcw, Calendar, Activity } from 'lucide-react';
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

/* ──── Main ring score — enlarged ──── */
function ScoreRing({ score }: { score: number }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  const color = score >= 80 ? '#10b981' : score >= 60 ? '#FF9500' : score >= 40 ? '#FF9500' : '#FF3B30';
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : 'C';

  return (
    <div className="w-[180px] h-[180px] shrink-0 relative flex items-center justify-center group">
      <div className="absolute inset-0 bg-emerald-400/10 blur-[40px] rounded-full group-hover:bg-emerald-400/20 transition-all" />
      <div className="w-full h-full rounded-full border-[10px] border-emerald-50 relative flex items-center justify-center shadow-inner">
        <div className="text-emerald-700 font-black text-2xl font-display group-hover:scale-110 transition-transform cursor-default">{grade}</div>
        <svg className="absolute inset-0 transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]"
          />
        </svg>
      </div>
    </div>
  );
}

export function ZoneSante({ data, summary }: ZoneSanteProps) {
  const score = summary.healthScore;

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[40px] shadow-sm hover:shadow-lg transition-all p-8 flex flex-col md:flex-row items-center gap-8 h-full">
      {/* Left: text content */}
      <div className="flex-1">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200">
            <Activity size={22} />
          </div>
          <h3 className="font-display text-[20px] font-bold text-[#1D1D1F]">Index Santé</h3>
        </div>

        {/* Large score value */}
        <div className="flex items-end mb-4">
          <p className="text-[64px] font-black text-[#1D1D1F] font-display leading-none tracking-tighter">
            {score}<span className="text-[32px] text-emerald-500">%</span>
          </p>
          <div className="mb-2 ml-4">
            <p className="text-[13px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">+2.4%</p>
            <p className="text-[11px] text-[#86868B] font-medium mt-1">
              {score >= 80 ? 'Score Optimal' : score >= 60 ? 'Score Correct' : 'À améliorer'}
            </p>
          </div>
        </div>

        {/* Gauges */}
        <div className="space-y-3 max-w-[250px]">
          <Gauge value={data.fifoCompliance} label="FIFO" icon={TrendingUp} thresholds={{ good: 95, warning: 80 }} />
          <Gauge value={data.stockRotation} label="Rotation" icon={RotateCcw} thresholds={{ good: 70, warning: 50 }} />
          <Gauge value={data.inventoryFreshness} label="Fraîcheur" icon={Calendar} thresholds={{ good: 80, warning: 60 }} />
        </div>
      </div>

      {/* Right: circular gauge */}
      <ScoreRing score={score} />
    </div>
  );
}
