'use client';

import { AlertOctagon, AlertTriangle, CheckCircle, Truck, FileText, Package, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SupplierReliabilityScore } from './SupplierReliabilityScore';

import type { SupplierRiskLevel } from './SupplierRiskCard';

/**
 * SupplierImpactCard — Point d'entrée chaîne d'impact
 * 
 * Visible uniquement si impact réel
 * Cliquer ouvre la vue chaîne
 */

export interface SupplierImpact {
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  reliabilityScore: number;
  riskLevel: SupplierRiskLevel;
  blockingBcCount: number;
  blockedMpCount: number;
}

interface SupplierImpactCardProps {
  impact: SupplierImpact;
  onViewChain: () => void;
}

const riskConfig: Record<SupplierRiskLevel, {
  label: string;
  icon: typeof AlertOctagon;
  bg: string;
  text: string;
  cardBg: string;
  border: string;
}> = {
  CRITICAL: {
    label: '🔴 FOURNISSEUR À RISQUE',
    icon: AlertOctagon,
    bg: 'bg-red-600',
    text: 'text-white',
    cardBg: 'bg-[#FFEBEE]',
    border: 'border-red-300',
  },
  WARNING: {
    label: '🟠 SOUS SURVEILLANCE',
    icon: AlertTriangle,
    bg: 'bg-amber-500',
    text: 'text-white',
    cardBg: 'bg-amber-50',
    border: 'border-amber-300',
  },
  STABLE: {
    label: '🟢 FIABLE',
    icon: CheckCircle,
    bg: 'bg-emerald-500',
    text: 'text-white',
    cardBg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
};

export function SupplierImpactCard({ impact, onViewChain }: SupplierImpactCardProps) {
  const config = riskConfig[impact.riskLevel];
  const Icon = config.icon;
  const hasImpact = impact.blockingBcCount > 0 || impact.blockedMpCount > 0;

  // Ne pas afficher si pas d'impact réel
  if (!hasImpact && impact.riskLevel === 'STABLE') {
    return null;
  }

  return (
    <div className={cn(
      'rounded-[28px] border-2 p-5 transition-all',
      config.cardBg,
      config.border,
      impact.riskLevel === 'CRITICAL' && 'shadow-apple-hover'
    )}>
      <div className="flex items-start gap-4">
        {/* Risk Pill */}
        <div className={cn(
          'flex-shrink-0 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm',
          config.bg,
          config.text
        )}>
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{config.label}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Fournisseur Name */}
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#AEAEB2]" />
            <h3 className="text-lg font-bold text-[#1D1D1F]">
              {impact.supplierName}
            </h3>
          </div>

          {/* Impact metrics */}
          <div className="mt-3 flex items-center gap-6 text-sm">
            {impact.blockingBcCount > 0 && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                <span className="text-[#6E6E73]">
                  BC bloquants : <span className="font-bold text-orange-600">{impact.blockingBcCount}</span>
                </span>
              </div>
            )}
            {impact.blockedMpCount > 0 && (
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-red-500" />
                <span className="text-[#6E6E73]">
                  MP impactées : <span className="font-bold text-red-600">{impact.blockedMpCount}</span>
                </span>
              </div>
            )}
          </div>

          {/* Reliability Score */}
          <div className="mt-3 max-w-xs">
            <SupplierReliabilityScore score={impact.reliabilityScore} />
          </div>
        </div>

        {/* Action */}
        <button
          onClick={onViewChain}
          className={cn(
            'flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
            impact.riskLevel === 'CRITICAL' 
              ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
              : impact.riskLevel === 'WARNING'
                ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200'
                : 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
          )}
        >
          <span>Voir chaîne d'impact</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
