'use client';

import { memo } from 'react';
import { AlertOctagon, AlertTriangle, Clock, CheckCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PrimaryRequestAction } from './PrimaryRequestAction';
import { ImpactIndicatorMini } from './ImpactIndicatorMini';
import type { UserRole } from './CriticalActionBanner';

/**
 * RequestDecisionCard — Apple Glass Design
 *
 * RÈGLE: 1 DEMANDE = 1 DÉCISION = 1 ACTION PRINCIPALE
 */

export type RequestDecisionStatus =
  | 'BLOCKING'      // 🟥 Production bloquée
  | 'URGENT'        // 🟧 Commande urgente
  | 'PENDING_INFO'  // 🟨 Infos manquantes
  | 'WAITING'       // ⏳ En attente
  | 'DONE';         // ✅ Traité

export interface RequestData {
  id: number;
  reference: string;
  productName: string;
  quantity: number;
  unit: string;
  impactRecipes: number;
  source: string;
  bcReference?: string;
  bcId?: string;
}

interface RequestDecisionCardProps {
  request: RequestData;
  status: RequestDecisionStatus;
  userRole: UserRole;
  onAction?: () => void;
}

const statusConfig: Record<RequestDecisionStatus, {
  label: string;
  icon: typeof AlertOctagon;
  pillBg: string;
  pillText: string;
  glassTint: string;
  glowClass: string;
}> = {
  BLOCKING: {
    label: 'PRODUCTION BLOQUEE',
    icon: AlertOctagon,
    pillBg: 'bg-[#FF3B30]',
    pillText: 'text-white',
    glassTint: 'glass-tint-red',
    glowClass: 'animate-glow-pulse',
  },
  URGENT: {
    label: 'COMMANDE URGENTE',
    icon: AlertTriangle,
    pillBg: 'bg-[#FF9500]',
    pillText: 'text-white',
    glassTint: 'glass-tint-orange',
    glowClass: '',
  },
  PENDING_INFO: {
    label: 'INFOS MANQUANTES',
    icon: HelpCircle,
    pillBg: 'bg-[#FFCC00]',
    pillText: 'text-[#1D1D1F]',
    glassTint: 'glass-tint-amber',
    glowClass: '',
  },
  WAITING: {
    label: 'EN ATTENTE',
    icon: Clock,
    pillBg: 'bg-[#8E8E93]',
    pillText: 'text-white',
    glassTint: 'glass-tint-neutral',
    glowClass: '',
  },
  DONE: {
    label: 'TRAITE',
    icon: CheckCircle,
    pillBg: 'bg-[#34C759]',
    pillText: 'text-white',
    glassTint: 'glass-tint-emerald',
    glowClass: '',
  },
};

export const RequestDecisionCard = memo(function RequestDecisionCard({
  request,
  status,
  userRole,
  onAction,
}: RequestDecisionCardProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const showImpact = request.impactRecipes > 0;

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
          {/* Product + Quantity */}
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h3 className="text-[17px] font-semibold text-[#1D1D1F] truncate tracking-[-0.01em]">
              {request.productName}
            </h3>
            <span className="text-[#D1D1D6]">—</span>
            <span className="text-[17px] font-semibold text-[#1D1D1F]">
              {request.quantity.toLocaleString('fr-FR')} {request.unit}
            </span>
          </div>

          {/* Impact + Source */}
          <div className="mt-2.5 flex items-center gap-3 flex-wrap">
            {showImpact && (
              <ImpactIndicatorMini recipeCount={request.impactRecipes} />
            )}
            <span className="text-[13px] text-[#86868B]">
              Demande par <span className="font-medium text-[#6E6E73]">{request.source}</span>
            </span>
          </div>
        </div>

        {/* Action */}
        <div className="flex-shrink-0">
          <PrimaryRequestAction
            status={status}
            requestId={request.id}
            userRole={userRole}
            bcReference={request.bcReference}
            bcId={request.bcId}
            onAction={onAction}
          />
        </div>
      </div>
    </div>
  );
});

/**
 * Calcule le statut décisionnel d'une demande
 */
export function getRequestDecisionStatus(
  productionBlocked: boolean,
  isUrgent: boolean,
  missingInfo: boolean,
  bcCreated: boolean,
  bcSent: boolean
): RequestDecisionStatus {
  if (productionBlocked) return 'BLOCKING';
  if (isUrgent) return 'URGENT';
  if (missingInfo) return 'PENDING_INFO';
  if (bcCreated && !bcSent) return 'WAITING';
  if (bcSent) return 'DONE';
  return 'WAITING';
}
