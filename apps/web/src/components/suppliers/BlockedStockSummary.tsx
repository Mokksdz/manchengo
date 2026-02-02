'use client';

import { Package, AlertOctagon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * BlockedStockSummary — Affiche uniquement le stock PROBLÉMATIQUE
 * 
 * ❌ Pas de stock sain
 * ❌ Pas de chiffres inutiles
 */

export type BlockedMpStatus = 'RUPTURE' | 'CRITICAL' | 'LOW';

export interface BlockedMp {
  id: number;
  code: string;
  name: string;
  status: BlockedMpStatus;
  daysRemaining?: number;
}

interface BlockedStockSummaryProps {
  blockedMps: BlockedMp[];
  onViewMp?: (mpId: number) => void;
}

const statusConfig: Record<BlockedMpStatus, {
  label: string;
  icon: typeof AlertOctagon;
  iconColor: string;
  textColor: string;
}> = {
  RUPTURE: {
    label: 'rupture',
    icon: AlertOctagon,
    iconColor: 'text-red-500',
    textColor: 'text-red-600',
  },
  CRITICAL: {
    label: 'critique',
    icon: AlertOctagon,
    iconColor: 'text-orange-500',
    textColor: 'text-orange-600',
  },
  LOW: {
    label: 'sous seuil',
    icon: Clock,
    iconColor: 'text-amber-500',
    textColor: 'text-amber-600',
  },
};

export function BlockedStockSummary({ blockedMps, onViewMp }: BlockedStockSummaryProps) {
  if (blockedMps.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-5 h-5 text-red-500" />
        <h4 className="font-bold text-[#1D1D1F]">Matières premières bloquées</h4>
        <span className="ml-auto px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
          {blockedMps.length}
        </span>
      </div>
      
      <div className="space-y-2">
        {blockedMps.map((mp) => {
          const config = statusConfig[mp.status];
          const StatusIcon = config.icon;
          
          return (
            <button
              key={mp.id}
              onClick={() => onViewMp?.(mp.id)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#FAFAFA] transition-colors text-left"
            >
              <StatusIcon className={cn('w-4 h-4 flex-shrink-0', config.iconColor)} />
              <span className="font-medium text-[#1D1D1F] flex-1">{mp.name}</span>
              <span className={cn('text-sm font-semibold', config.textColor)}>
                {mp.status === 'LOW' && mp.daysRemaining !== undefined
                  ? `${mp.daysRemaining}j restants`
                  : config.label
                }
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
