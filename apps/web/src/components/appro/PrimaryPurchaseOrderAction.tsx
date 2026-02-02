'use client';

import Link from 'next/link';
import { Send, Phone, Eye, AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PurchaseOrderDecisionStatus } from './PurchaseOrderDecisionCard';
import type { UserRole } from './CriticalActionBanner';

/**
 * PrimaryPurchaseOrderAction — UNE ACTION MAX par BC
 * 
 * RÈGLE: 1 bouton max, bouton rouge réservé à URGENT_SEND
 * Bouton visible sans hover
 */

interface PrimaryPurchaseOrderActionProps {
  status: PurchaseOrderDecisionStatus;
  orderId: string;
  userRole: UserRole;
  onAction?: () => void;
  onRefresh?: () => void;
}

type ActionConfig = {
  labelAppro: string;
  labelAdmin: string;
  icon: typeof Send;
  href?: (id: string) => string;
  style: string;
  hoverStyle: string;
  action?: 'send' | 'relance' | 'escalade';
} | null;

const actionConfig: Record<PurchaseOrderDecisionStatus, ActionConfig> = {
  URGENT_SEND: {
    labelAppro: 'Envoyer maintenant',
    labelAdmin: 'Forcer envoi',
    icon: Send,
    style: 'bg-rose-600 text-white border-rose-700 shadow-apple-hover',
    hoverStyle: 'hover:bg-rose-700',
    action: 'send',
  },
  NOT_SENT: {
    labelAppro: 'Envoyer BC',
    labelAdmin: 'Valider & envoyer',
    icon: Send,
    style: 'bg-orange-500 text-white border-orange-600',
    hoverStyle: 'hover:bg-orange-600',
    action: 'send',
  },
  AWAITING_SUPPLIER: {
    labelAppro: 'Relancer fournisseur',
    labelAdmin: 'Relancer',
    icon: Phone,
    style: 'bg-blue-100 text-blue-700 border-blue-300',
    hoverStyle: 'hover:bg-blue-200',
    action: 'relance',
  },
  SUPPLIER_DELAY: {
    labelAppro: 'Relancer + alerter',
    labelAdmin: 'Escalader',
    icon: AlertTriangle,
    style: 'bg-red-100 text-red-700 border-red-300',
    hoverStyle: 'hover:bg-red-200',
    action: 'escalade',
  },
  RECEIVED: {
    labelAppro: 'Voir réception',
    labelAdmin: 'Voir réception',
    icon: Eye,
    href: (id) => `/dashboard/appro/bons/${id}`,
    style: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    hoverStyle: 'hover:bg-emerald-200',
  },
  CANCELLED: null, // Aucun bouton
};

export function PrimaryPurchaseOrderAction({ 
  status, 
  orderId, 
  userRole,
  onAction,
  onRefresh,
}: PrimaryPurchaseOrderActionProps) {
  const config = actionConfig[status];
  
  if (!config) {
    return null;
  }

  const isAdmin = userRole === 'ADMIN';
  const label = isAdmin ? config.labelAdmin : config.labelAppro;
  const Icon = config.icon;

  // Lien direct
  if (config.href) {
    return (
      <Link
        href={config.href(orderId)}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
          config.style,
          config.hoverStyle
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
      onClick={onAction || onRefresh}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
        config.style,
        config.hoverStyle,
        status === 'URGENT_SEND' && 'animate-pulse'
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
