'use client';

import { cn } from '@/lib/utils';

/**
 * SupplierReliabilityScore — Score de fiabilité visuel
 * 
 * Barre colorée:
 * 🔴 < 60
 * 🟠 60–80
 * 🟢 > 80
 */

interface SupplierReliabilityScoreProps {
  score: number;
  showLabel?: boolean;
}

export function SupplierReliabilityScore({ 
  score, 
  showLabel = true 
}: SupplierReliabilityScoreProps) {
  const clampedScore = Math.min(100, Math.max(0, score));
  
  const getColor = () => {
    if (clampedScore >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-100' };
    if (clampedScore >= 60) return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-100' };
    return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-100' };
  };

  const colors = getColor();

  return (
    <div className="flex items-center gap-3">
      {showLabel && (
        <span className="text-xs font-medium text-[#86868B] uppercase tracking-wide">
          Fiabilité
        </span>
      )}
      
      {/* Score bar */}
      <div className={cn('flex-1 h-2.5 rounded-full overflow-hidden', colors.bg)}>
        <div 
          className={cn('h-full rounded-full transition-all duration-500', colors.bar)}
          style={{ width: `${clampedScore}%` }}
        />
      </div>
      
      {/* Score value */}
      <div className={cn(
        'flex items-baseline gap-0.5 font-bold text-lg tabular-nums',
        colors.text
      )}>
        <span>{clampedScore}</span>
        <span className="text-xs font-normal text-[#AEAEB2]">/100</span>
      </div>
    </div>
  );
}
