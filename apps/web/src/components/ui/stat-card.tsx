'use client';

import { memo, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  color?: 'default' | 'purple' | 'blue' | 'emerald' | 'amber' | 'red';
  className?: string;
}

const iconGradients = {
  default: 'bg-gradient-to-br from-[#8E8E93]/10 to-[#AEAEB2]/5',
  purple: 'bg-gradient-to-br from-[#AF52DE]/10 to-[#BF5AF2]/5',
  blue: 'bg-gradient-to-br from-[#007AFF]/10 to-[#5AC8FA]/5',
  emerald: 'bg-gradient-to-br from-[#34C759]/10 to-[#30D158]/5',
  amber: 'bg-gradient-to-br from-[#FF9500]/10 to-[#FFAC33]/5',
  red: 'bg-gradient-to-br from-[#FF3B30]/10 to-[#FF6961]/5',
};

const iconColors = {
  default: 'text-[#8E8E93]/70',
  purple: 'text-[#AF52DE]/70',
  blue: 'text-[#007AFF]/70',
  emerald: 'text-[#34C759]/70',
  amber: 'text-[#FF9500]/70',
  red: 'text-[#FF3B30]/70',
};

export const StatCard = memo(function StatCard({ title, value, subtitle, icon, trend, color = 'default', className }: StatCardProps) {
  return (
    <div className={cn('glass-card-hover p-6', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] font-medium text-[#86868B] tracking-[0.01em]">{title}</p>
          <p className="text-[28px] font-semibold text-[#1D1D1F] mt-2 tracking-tight tabular-nums">{value}</p>
          {subtitle && <p className="text-[12px] text-[#AEAEB2] mt-1">{subtitle}</p>}
          {trend && (
            <div className={cn(
              'flex items-center gap-1 mt-2 text-[13px] font-medium',
              trend.value > 0 ? 'text-[#34C759]' : trend.value < 0 ? 'text-[#FF3B30]' : 'text-[#86868B]'
            )}>
              {trend.value > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : trend.value < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
              {trend.label && <span className="text-[#AEAEB2] font-normal">{trend.label}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className={cn('w-11 h-11 rounded-[14px] flex items-center justify-center', iconGradients[color])}>
            <div className={iconColors[color]}>{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
});
