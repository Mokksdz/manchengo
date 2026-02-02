'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SupplierRiskIndicatorMini — Indicateur risque fournisseur
 * 
 * Affiché seulement si nécessaire (retards passés)
 * Cliquable → drawer historique fournisseur (lecture seule)
 */

interface SupplierRiskIndicatorMiniProps {
  delayCount: number;
  supplierName: string;
  onClick?: () => void;
}

export function SupplierRiskIndicatorMini({
  delayCount,
  supplierName: _supplierName,
  onClick,
}: SupplierRiskIndicatorMiniProps) {
  if (delayCount === 0) {
    return null;
  }

  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold',
        'bg-amber-100 text-amber-800 border border-amber-200',
        onClick && 'hover:bg-amber-200 transition-colors cursor-pointer'
      )}
    >
      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
      <span>
        Fournisseur déjà en retard ({delayCount} fois ce mois)
      </span>
    </Component>
  );
}
