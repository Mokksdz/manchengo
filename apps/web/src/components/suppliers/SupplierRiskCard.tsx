'use client';

import { AlertOctagon, AlertTriangle, CheckCircle, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SupplierReliabilityScore } from './SupplierReliabilityScore';
import { SupplierPerformanceSummary } from './SupplierPerformanceSummary';
import { PrimarySupplierAction } from './PrimarySupplierAction';
import type { UserRole } from '@/components/appro/CriticalActionBanner';

/**
 * SupplierRiskCard — Apple Glass Design
 *
 * RÈGLE: Un fournisseur n'est pas "bon" ou "mauvais"
 * → Il est FIABLE, À RISQUE ou DANGEREUX
 */

export type SupplierRiskLevel =
  | 'CRITICAL'  // 🔴 Retards répétés, prod impactée
  | 'WARNING'   // 🟠 Dérive récente
  | 'STABLE';   // 🟢 Fiable

export interface SupplierPerformanceData {
  id: number;
  code: string;
  name: string;
  // Performance metrics
  bcSent30Days: number;
  bcLate: number;
  deliveryRespectRate: number;
  impactRecipes: number;
  lastIncidentDays?: number;
  // Computed
  reliabilityScore: number;
}

interface SupplierRiskCardProps {
  supplier: SupplierPerformanceData;
  riskLevel: SupplierRiskLevel;
  userRole: UserRole;
  onViewPerformance?: () => void;
  onOpenHistory?: () => void;
}

const riskConfig: Record<SupplierRiskLevel, {
  label: string;
  icon: typeof AlertOctagon;
  pillBg: string;
  pillText: string;
  glassTint: string;
  glowClass: string;
  iconBg: string;
}> = {
  CRITICAL: {
    label: 'FOURNISSEUR A RISQUE',
    icon: AlertOctagon,
    pillBg: 'bg-[#FF3B30]',
    pillText: 'text-white',
    glassTint: 'glass-tint-red',
    glowClass: 'animate-glow-pulse',
    iconBg: 'bg-[#FF3B30]/10',
  },
  WARNING: {
    label: 'SOUS SURVEILLANCE',
    icon: AlertTriangle,
    pillBg: 'bg-[#FF9500]',
    pillText: 'text-white',
    glassTint: 'glass-tint-orange',
    glowClass: '',
    iconBg: 'bg-[#FF9500]/10',
  },
  STABLE: {
    label: 'FIABLE',
    icon: CheckCircle,
    pillBg: 'bg-[#34C759]',
    pillText: 'text-white',
    glassTint: 'glass-tint-emerald',
    glowClass: '',
    iconBg: 'bg-[#34C759]/10',
  },
};

export function SupplierRiskCard({
  supplier,
  riskLevel,
  userRole,
  onViewPerformance,
  onOpenHistory,
}: SupplierRiskCardProps) {
  const config = riskConfig[riskLevel];
  const Icon = config.icon;

  return (
    <div className={cn(
      'glass-decision-card p-5',
      config.glassTint,
      config.glowClass,
    )}>
      <div className="flex items-start gap-4">
        {/* Status Pill */}
        <div className={cn(
          'glass-status-pill flex-shrink-0',
          config.pillBg,
          config.pillText
        )}>
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{config.label}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Fournisseur Name */}
          <div className="flex items-center gap-2.5">
            <div className={cn('w-7 h-7 rounded-[8px] flex items-center justify-center', config.iconBg)}>
              <Truck className="w-3.5 h-3.5 text-[#86868B]" />
            </div>
            <h3 className="text-[17px] font-semibold text-[#1D1D1F] tracking-[-0.01em]">
              {supplier.name}
            </h3>
            <span className="font-mono text-[11px] text-[#AEAEB2] bg-black/[0.03] px-2 py-0.5 rounded-md">
              {supplier.code}
            </span>
          </div>

          {/* Performance Summary */}
          <div className="mt-3">
            <SupplierPerformanceSummary
              bcSent30Days={supplier.bcSent30Days}
              bcLate={supplier.bcLate}
              deliveryRespectRate={supplier.deliveryRespectRate}
              impactRecipes={supplier.impactRecipes}
              lastIncidentDays={supplier.lastIncidentDays}
            />
          </div>

          {/* Reliability Score */}
          <div className="mt-3">
            <SupplierReliabilityScore score={supplier.reliabilityScore} />
          </div>
        </div>

        {/* Action */}
        <div className="flex-shrink-0">
          <PrimarySupplierAction
            riskLevel={riskLevel}
            supplierId={supplier.id}
            userRole={userRole}
            onViewPerformance={onViewPerformance}
            onOpenHistory={onOpenHistory}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Calcule le niveau de risque d'un fournisseur
 */
export function getSupplierRiskLevel(
  delayRate: number,
  blockedProductionCount: number,
  incidentsLast30Days: number
): SupplierRiskLevel {
  if (delayRate > 30 || blockedProductionCount > 0) return 'CRITICAL';
  if (delayRate > 10 || incidentsLast30Days > 0) return 'WARNING';
  return 'STABLE';
}
