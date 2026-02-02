'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * StockVsThreshold — Affichage stock vs seuil
 * 
 * Format obligatoire: 50 L / 500 L + Manque: 450 L
 * Rouge si < seuil, Vert si OK
 */

interface StockVsThresholdProps {
  currentStock: number;
  minStock: number;
  unit: string;
}

export const StockVsThreshold = memo(function StockVsThreshold({ currentStock, minStock, unit }: StockVsThresholdProps) {
  const isLow = currentStock < minStock;
  const deficit = minStock - currentStock;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-baseline gap-1">
        <span className={cn(
          'text-lg font-bold tabular-nums',
          currentStock === 0 ? 'text-rose-600' :
          isLow ? 'text-amber-600' : 'text-emerald-600'
        )}>
          {currentStock.toLocaleString('fr-FR')}
        </span>
        <span className="text-sm text-[#AEAEB2]">/</span>
        <span className="text-sm text-[#86868B] tabular-nums">
          {minStock.toLocaleString('fr-FR')}
        </span>
        <span className="text-xs text-[#AEAEB2] uppercase">{unit}</span>
      </div>
      
      {isLow && deficit > 0 && (
        <span className={cn(
          'text-xs font-semibold',
          currentStock === 0 ? 'text-rose-500' : 'text-amber-500'
        )}>
          Manque : {deficit.toLocaleString('fr-FR')} {unit}
        </span>
      )}
    </div>
  );
});
