'use client';

import { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StockSummaryCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon: React.ElementType;
  color: 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'gray';
  onClick?: () => void;
}

const colorClasses = {
  red: {
    bg: 'bg-red-50 hover:bg-red-100',
    border: 'border-red-200',
    icon: 'text-red-600 bg-red-100',
    value: 'text-red-700',
  },
  orange: {
    bg: 'bg-orange-50 hover:bg-orange-100',
    border: 'border-orange-200',
    icon: 'text-orange-600 bg-orange-100',
    value: 'text-orange-700',
  },
  amber: {
    bg: 'bg-amber-50 hover:bg-amber-100',
    border: 'border-amber-200',
    icon: 'text-amber-600 bg-amber-100',
    value: 'text-amber-700',
  },
  green: {
    bg: 'bg-green-50 hover:bg-green-100',
    border: 'border-green-200',
    icon: 'text-green-600 bg-green-100',
    value: 'text-green-700',
  },
  blue: {
    bg: 'bg-blue-50 hover:bg-blue-100',
    border: 'border-blue-200',
    icon: 'text-blue-600 bg-blue-100',
    value: 'text-blue-700',
  },
  gray: {
    bg: 'bg-[#FAFAFA] hover:bg-[#F5F5F5]',
    border: 'border-[#F0F0F0]',
    icon: 'text-[#6E6E73] bg-[#F5F5F5]',
    value: 'text-[#1D1D1F]',
  },
};

export const StockSummaryCard = memo(function StockSummaryCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  color,
  onClick,
}: StockSummaryCardProps) {
  const classes = colorClasses[color];

  return (
    <Card
      className={`
        ${classes.bg} ${classes.border} 
        transition-all duration-200 
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#6E6E73]">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`font-display text-[28px] font-black tracking-tight tabular-nums leading-none ${classes.value}`}>
                {value}
              </span>
              {trend && trendValue && (
                <span className={`
                  flex items-center gap-0.5 text-xs font-medium
                  ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-[#86868B]'}
                `}>
                  {trend === 'up' ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : trend === 'down' ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  {trendValue}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-[#86868B] mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${classes.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
