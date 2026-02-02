'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ImpactIndicatorMini — Indicateur d'impact production compact
 * 
 * Affiché seulement si impact > 0
 * Format: 🔥 Bloque X recettes
 * Cliquable → ouvre drawer (lecture seule)
 */

interface ImpactIndicatorMiniProps {
  recipeCount: number;
  onClick?: () => void;
}

export function ImpactIndicatorMini({ recipeCount, onClick }: ImpactIndicatorMiniProps) {
  if (recipeCount === 0) {
    return null;
  }

  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold',
        'bg-rose-100 text-rose-700 border border-rose-200',
        onClick && 'hover:bg-rose-200 transition-colors cursor-pointer'
      )}
    >
      <Flame className="w-3.5 h-3.5 text-rose-500" />
      <span>Bloque {recipeCount} recette{recipeCount > 1 ? 's' : ''}</span>
    </Component>
  );
}
