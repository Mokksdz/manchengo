'use client';

import Link from 'next/link';
import { ShieldOff, Eye, ShoppingCart, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SupplierRiskLevel } from './SupplierRiskCard';
import type { UserRole } from '@/components/appro/CriticalActionBanner';

/**
 * PrimarySupplierAction — UNE ACTION MAX par fournisseur
 * 
 * RÈGLE: 1 bouton max, visible sans hover
 */

interface PrimarySupplierActionProps {
  riskLevel: SupplierRiskLevel;
  supplierId: number;
  userRole: UserRole;
  onViewPerformance?: () => void;
  onOpenHistory?: () => void;
}

type ActionConfig = {
  labelAppro: string;
  labelAdmin: string;
  icon: typeof Eye;
  href?: (id: number) => string;
  style: string;
  hoverStyle: string;
  action?: 'view' | 'block' | 'order';
} | null;

const actionConfig: Record<SupplierRiskLevel, ActionConfig> = {
  CRITICAL: {
    labelAppro: 'Éviter / Alternatives',
    labelAdmin: 'Bloquer temporairement',
    icon: ShieldOff,
    style: 'bg-red-100 text-red-700 border-red-300',
    hoverStyle: 'hover:bg-red-200',
    action: 'block',
  },
  WARNING: {
    labelAppro: 'Commander avec vigilance',
    labelAdmin: 'Mettre sous surveillance',
    icon: AlertTriangle,
    style: 'bg-amber-100 text-amber-700 border-amber-300',
    hoverStyle: 'hover:bg-amber-200',
    action: 'order',
  },
  STABLE: {
    labelAppro: 'Commander',
    labelAdmin: 'Voir performance',
    icon: ShoppingCart,
    href: (id) => `/dashboard/appro/bons/new?supplierId=${id}`,
    style: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    hoverStyle: 'hover:bg-emerald-200',
  },
};

export function PrimarySupplierAction({ 
  riskLevel, 
  supplierId, 
  userRole,
  onViewPerformance,
  onOpenHistory,
}: PrimarySupplierActionProps) {
  const config = actionConfig[riskLevel];
  
  if (!config) {
    return null;
  }

  const isAdmin = userRole === 'ADMIN';
  const label = isAdmin ? config.labelAdmin : config.labelAppro;
  const Icon = config.icon;

  // For STABLE with APPRO, link to new BC
  if (config.href && !isAdmin) {
    return (
      <Link
        href={config.href(supplierId)}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
          config.style,
          config.hoverStyle
        )}
      >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </Link>
    );
  }

  // Button with callback
  return (
    <button
      onClick={isAdmin ? onViewPerformance : onOpenHistory}
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
