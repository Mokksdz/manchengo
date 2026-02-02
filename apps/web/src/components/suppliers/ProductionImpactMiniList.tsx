'use client';

import { Factory, AlertOctagon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ProductionImpactMiniList — Productions impactées
 * 
 * 🔴 Bloqué — production impossible
 * 🟠 À risque — production menacée
 */

export type ProductionImpactStatus = 'BLOCKED' | 'AT_RISK';

export interface ProductionImpact {
  id: number;
  recipeName: string;
  status: ProductionImpactStatus;
}

interface ProductionImpactMiniListProps {
  productions: ProductionImpact[];
  onViewProduction?: (productionId: number) => void;
}

const statusConfig: Record<ProductionImpactStatus, {
  label: string;
  icon: typeof AlertOctagon;
  iconColor: string;
  textColor: string;
  bgColor: string;
}> = {
  BLOCKED: {
    label: 'bloqué',
    icon: AlertOctagon,
    iconColor: 'text-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
  },
  AT_RISK: {
    label: 'à risque',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
  },
};

export function ProductionImpactMiniList({ productions, onViewProduction }: ProductionImpactMiniListProps) {
  if (productions.length === 0) {
    return null;
  }

  const blockedCount = productions.filter(p => p.status === 'BLOCKED').length;
  const atRiskCount = productions.filter(p => p.status === 'AT_RISK').length;

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Factory className="w-5 h-5 text-purple-500" />
        <h4 className="font-bold text-[#1D1D1F]">Productions impactées</h4>
        <div className="ml-auto flex items-center gap-2">
          {blockedCount > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
              {blockedCount} bloquée{blockedCount > 1 ? 's' : ''}
            </span>
          )}
          {atRiskCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
              {atRiskCount} à risque
            </span>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        {productions.map((production) => {
          const config = statusConfig[production.status];
          const StatusIcon = config.icon;
          
          return (
            <button
              key={production.id}
              onClick={() => onViewProduction?.(production.id)}
              className={cn(
                'w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left',
                config.bgColor,
                'hover:opacity-80'
              )}
            >
              <StatusIcon className={cn('w-4 h-4 flex-shrink-0', config.iconColor)} />
              <span className="font-medium text-[#1D1D1F] flex-1">{production.recipeName}</span>
              <span className={cn('text-sm font-semibold', config.textColor)}>
                {config.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
