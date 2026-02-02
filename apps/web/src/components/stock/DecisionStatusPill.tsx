'use client';

import { memo } from 'react';
import { AlertOctagon, AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * DecisionStatusPill — Indicateur de statut décisionnel
 * 
 * RÈGLE: UN SEUL statut visible, pas de badge secondaire
 * Élément visuel DOMINANT à gauche de chaque ligne
 */

export type DecisionStatus = 'BLOCKING' | 'RUPTURE' | 'LOW' | 'OK';

interface DecisionStatusPillProps {
  status: DecisionStatus;
  compact?: boolean;
}

const statusConfig: Record<DecisionStatus, {
  label: string;
  shortLabel: string;
  icon: typeof AlertOctagon;
  bg: string;
  text: string;
  border: string;
}> = {
  BLOCKING: {
    label: '🟥 PRODUCTION BLOQUÉE',
    shortLabel: 'BLOQUÉ',
    icon: AlertOctagon,
    bg: 'bg-rose-600',
    text: 'text-white',
    border: 'border-rose-700',
  },
  RUPTURE: {
    label: '🟧 RUPTURE',
    shortLabel: 'RUPTURE',
    icon: AlertTriangle,
    bg: 'bg-orange-500',
    text: 'text-white',
    border: 'border-orange-600',
  },
  LOW: {
    label: '🟨 SOUS SEUIL',
    shortLabel: 'SOUS SEUIL',
    icon: TrendingDown,
    bg: 'bg-amber-400',
    text: 'text-amber-900',
    border: 'border-amber-500',
  },
  OK: {
    label: '🟩 STOCK OK',
    shortLabel: 'OK',
    icon: CheckCircle,
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
};

export const DecisionStatusPill = memo(function DecisionStatusPill({ status, compact = false }: DecisionStatusPillProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  if (compact) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border',
        config.bg,
        config.text,
        config.border
      )}>
        <Icon className="w-3.5 h-3.5" />
        {config.shortLabel}
      </span>
    );
  }

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold border shadow-sm',
      config.bg,
      config.text,
      config.border,
      status === 'BLOCKING' && 'animate-pulse shadow-rose-500/30'
    )}>
      <Icon className="w-4 h-4" />
      <span>{config.label}</span>
    </div>
  );
});

/**
 * Calcule le statut décisionnel à partir des données stock
 */
export function getDecisionStatus(
  stock: number,
  minStock: number,
  impactProduction: number = 0
): DecisionStatus {
  if (stock === 0) return 'RUPTURE';
  if (stock < minStock && impactProduction > 0) return 'BLOCKING';
  if (stock < minStock) return 'LOW';
  return 'OK';
}
