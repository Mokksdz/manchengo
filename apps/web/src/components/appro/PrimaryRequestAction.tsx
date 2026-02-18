'use client';

import Link from 'next/link';
import { Plus, Eye, AlertTriangle, FileText, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RequestDecisionStatus } from './RequestDecisionCard';
import type { UserRole } from './CriticalActionBanner';

/**
 * PrimaryRequestAction — UNE ACTION MAX par demande
 * 
 * RÈGLE: Bouton visible sans hover, rouge uniquement pour BLOCKING
 * Pas de menu "…" par défaut
 */

interface PrimaryRequestActionProps {
  status: RequestDecisionStatus;
  requestId: number;
  userRole: UserRole;
  bcReference?: string;
  bcId?: string;
  onAction?: () => void;
}

type ActionConfig = {
  labelAppro: string;
  labelAdmin: string;
  icon: typeof Plus;
  href?: (id: number) => string;
  style: string;
  hoverStyle: string;
} | null;

const actionConfig: Record<RequestDecisionStatus, ActionConfig> = {
  BLOCKING: {
    labelAppro: 'Créer BC URGENT',
    labelAdmin: 'Créer BC URGENT',
    icon: Plus,
    href: () => `/dashboard/appro/bons/new?urgent=true`,
    style: 'bg-rose-600 text-white border-rose-700 shadow-apple-hover',
    hoverStyle: 'hover:bg-rose-700',
  },
  URGENT: {
    labelAppro: 'Créer BC',
    labelAdmin: 'Créer BC',
    icon: Plus,
    href: () => `/dashboard/appro/bons/new`,
    style: 'bg-orange-500 text-white border-orange-600',
    hoverStyle: 'hover:bg-orange-600',
  },
  PENDING_INFO: {
    labelAppro: 'Compléter infos',
    labelAdmin: 'Voir détails',
    icon: AlertTriangle,
    href: () => `/dashboard/appro/bons`,
    style: 'bg-amber-100 text-amber-800 border-amber-300',
    hoverStyle: 'hover:bg-amber-200',
  },
  WAITING: null, // Aucun bouton
  DONE: {
    labelAppro: 'Voir BC',
    labelAdmin: 'Voir BC',
    icon: Eye,
    style: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    hoverStyle: 'hover:bg-emerald-200',
  },
};

export function PrimaryRequestAction({ 
  status, 
  requestId, 
  userRole,
  bcReference,
  bcId,
  onAction,
}: PrimaryRequestActionProps) {
  const config = actionConfig[status];
  
  if (!config) {
    return null;
  }

  const isAdmin = userRole === 'ADMIN';
  const label = isAdmin ? config.labelAdmin : config.labelAppro;
  const Icon = config.icon;

  // Si DONE et BC existe, lien vers le BC
  if (status === 'DONE' && bcId) {
    return (
      <Link
        href={`/dashboard/appro/bons/${bcId}`}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
          config.style,
          config.hoverStyle
        )}
      >
        <FileText className="w-4 h-4" />
        <span>{bcReference || 'Voir BC'}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  }

  // Lien standard
  const href = config.href?.(requestId);
  
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
          config.style,
          config.hoverStyle,
          status === 'BLOCKING' && 'animate-pulse'
        )}
      >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  }

  // Bouton avec callback
  return (
    <button
      onClick={onAction}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
        config.style,
        config.hoverStyle
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
