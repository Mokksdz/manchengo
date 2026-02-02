'use client';

import { memo } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DecisionStatus } from './DecisionStatusPill';

/**
 * PrimaryDecisionAction — UNE SEULE action par ligne
 * 
 * RÈGLE: Pas de menu dropdown, pas de double CTA
 * CTA toujours à droite, rouge uniquement pour BLOCKING
 */

export type UserRole = 'APPRO' | 'ADMIN' | 'PRODUCTION' | 'COMMERCIAL' | 'COMPTABLE';

interface PrimaryDecisionActionProps {
  status: DecisionStatus;
  productId: number;
  productName: string;
  userRole: UserRole;
}

const actionConfig: Record<DecisionStatus, {
  labelAppro: string;
  labelAdmin: string;
  icon: typeof Plus;
  href: (productId: number) => string;
  style: string;
  hoverStyle: string;
} | null> = {
  BLOCKING: {
    labelAppro: 'Créer BC URGENT',
    labelAdmin: 'Créer BC URGENT',
    icon: Plus,
    href: (id) => `/dashboard/appro/bons/nouveau?mpId=${id}&urgent=true`,
    style: 'bg-rose-600 text-white border-rose-700 shadow-apple-hover',
    hoverStyle: 'hover:bg-rose-700',
  },
  RUPTURE: {
    labelAppro: 'Créer BC',
    labelAdmin: 'Analyser / Débloquer',
    icon: Plus,
    href: (id) => `/dashboard/appro/bons/nouveau?mpId=${id}`,
    style: 'bg-orange-500 text-white border-orange-600',
    hoverStyle: 'hover:bg-orange-600',
  },
  LOW: {
    labelAppro: 'Planifier BC',
    labelAdmin: 'Planifier BC',
    icon: Calendar,
    href: (id) => `/dashboard/appro/bons/nouveau?mpId=${id}`,
    style: 'bg-amber-100 text-amber-800 border-amber-300',
    hoverStyle: 'hover:bg-amber-200',
  },
  OK: null, // Aucun bouton
};

export const PrimaryDecisionAction = memo(function PrimaryDecisionAction({
  status,
  productId,
  productName,
  userRole
}: PrimaryDecisionActionProps) {
  const config = actionConfig[status];
  
  if (!config) {
    return null;
  }

  const isAdmin = userRole === 'ADMIN';
  const label = isAdmin ? config.labelAdmin : config.labelAppro;
  const Icon = config.icon;

  return (
    <Link
      href={config.href(productId)}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
        config.style,
        config.hoverStyle,
        status === 'BLOCKING' && 'animate-pulse'
      )}
      title={`${label} pour ${productName}`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
      <ArrowRight className="w-3.5 h-3.5 ml-1" />
    </Link>
  );
});
