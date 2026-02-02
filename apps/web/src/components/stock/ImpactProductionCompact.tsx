'use client';

import { memo } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ImpactProductionCompact — Affichage impact production
 * 
 * Format: "Bloque X recettes" (pas "X recette(s) bloquée(s)")
 * Icône 🔥 uniquement si > 0
 * Invisible si impact = 0
 */

interface ImpactProductionCompactProps {
  recipeCount: number;
  onClick?: () => void;
}

export const ImpactProductionCompact = memo(function ImpactProductionCompact({ recipeCount, onClick }: ImpactProductionCompactProps) {
  if (recipeCount === 0) {
    return null;
  }

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold',
        'bg-rose-100 text-rose-700 border border-rose-200',
        onClick && 'hover:bg-rose-200 transition-colors cursor-pointer'
      )}
    >
      <Flame className="w-3.5 h-3.5 text-rose-500" />
      <span>Bloque {recipeCount} recette{recipeCount > 1 ? 's' : ''}</span>
    </Component>
  );
});
