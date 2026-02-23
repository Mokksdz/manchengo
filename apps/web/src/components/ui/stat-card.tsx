'use client';

import React, { memo, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  color?: 'default' | 'purple' | 'blue' | 'emerald' | 'amber' | 'red';
  sparklineData?: string;
  sparklineColor?: string;
  className?: string;
}

const iconColors = {
  default: 'text-[#8E8E93]',
  purple: 'text-[#AF52DE]',
  blue: 'text-[#1565C0]',
  emerald: 'text-[#2E7D32]',
  amber: 'text-[#F57F17]',
  red: 'text-[#C62828]',
};

const defaultSparkColors: Record<string, string> = {
  default: '#8E8E93',
  purple: '#AF52DE',
  blue: '#1565C0',
  emerald: '#2E7D32',
  amber: '#F57F17',
  red: '#C62828',
};

const Sparkline = ({ color, data, id }: { color: string; data: string; id: string }) => (
  <svg width="100%" height="40" viewBox="0 0 120 40" fill="none" className="overflow-visible">
    <defs>
      <linearGradient id={`spark-grad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor={color} stopOpacity="0.2" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d={data}
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      fill="none"
    />
    <path
      d={`${data} L 120 40 L 0 40 Z`}
      fill={`url(#spark-grad-${id})`}
      opacity="0.4"
    />
  </svg>
);

export const StatCard = memo(function StatCard({
  title, value, subtitle, icon, trend, color = 'default', sparklineData, sparklineColor, className
}: StatCardProps) {
  const resolvedSparkColor = sparklineColor || defaultSparkColors[color];
  const uniqueId = title.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className={cn(
      'group relative bg-white/60 backdrop-blur-[40px] border border-white/50 rounded-[32px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:-translate-y-1 hover:shadow-xl transition-all duration-500 overflow-hidden',
      className
    )}>
      <div className="relative z-10 flex justify-between items-start mb-3">
        {icon && (
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
            <div className={iconColors[color]}>{icon}</div>
          </div>
        )}
        {trend && (
          <div className={cn(
            'flex items-center text-[12px] font-bold px-2.5 py-1 rounded-full border border-black/5',
            trend.value > 0 ? 'text-green-600 bg-green-50' : trend.value < 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50'
          )}>
            {trend.value > 0 ? <ArrowUpRight size={14} className="mr-1" /> : trend.value < 0 ? <ArrowDownRight size={14} className="mr-1" /> : <Minus size={14} className="mr-1" />}
            {trend.value > 0 ? '+' : ''}{trend.value}%
          </div>
        )}
      </div>

      <div className="relative z-10 mb-4">
        <p className="text-[12px] text-[#6E6E73] font-bold tracking-widest uppercase mb-1">{title}</p>
        <p className="text-[34px] font-black text-[#1D1D1F] tabular-nums tracking-tight leading-none mb-1 font-display">{value}</p>
        {subtitle && <p className="text-[12px] text-[#86868B] font-medium">{subtitle}</p>}
      </div>

      {sparklineData && (
        <div className="relative z-10 h-10 -mx-2 opacity-60 group-hover:opacity-100 transition-opacity">
          <Sparkline color={resolvedSparkColor} data={sparklineData} id={uniqueId} />
        </div>
      )}
    </div>
  );
});
