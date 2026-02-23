'use client';

import { memo } from 'react';
import { AlertOctagon, Send, Clock, AlertTriangle, CheckCircle, XCircle, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PrimaryPurchaseOrderAction } from './PrimaryPurchaseOrderAction';
import { SupplierRiskIndicatorMini } from './SupplierRiskIndicatorMini';
import type { UserRole } from './CriticalActionBanner';

/**
 * PurchaseOrderDecisionCard — Apple Glass Design
 *
 * RÈGLE: 1 BC = 1 ENGAGEMENT = 1 ACTION CLAIRE
 */

export type PurchaseOrderDecisionStatus =
  | 'NOT_SENT'          // 🟧 BC non envoyé
  | 'URGENT_SEND'       // 🟥 Envoi urgent
  | 'AWAITING_SUPPLIER' // ⏳ Fournisseur en attente
  | 'SUPPLIER_DELAY'    // 🔴 Retard fournisseur
  | 'RECEIVED'          // ✅ Réceptionné
  | 'CANCELLED';        // ⚪ Annulé

export interface PurchaseOrderData {
  id: string;
  reference: string;
  supplierName: string;
  totalAmount: number;
  currency: string;
  impactRecipes: number;
  expectedDelivery?: string;
  daysUntilDelivery?: number;
  supplierDelayCount?: number;
}

interface PurchaseOrderDecisionCardProps {
  order: PurchaseOrderData;
  status: PurchaseOrderDecisionStatus;
  userRole: UserRole;
  onAction?: () => void;
  onRefresh?: () => void;
}

const statusConfig: Record<PurchaseOrderDecisionStatus, {
  label: string;
  icon: typeof AlertOctagon;
  pillBg: string;
  pillText: string;
  glassTint: string;
  glowClass: string;
}> = {
  URGENT_SEND: {
    label: 'ENVOI URGENT',
    icon: AlertOctagon,
    pillBg: 'bg-[#FF3B30]',
    pillText: 'text-white',
    glassTint: 'glass-tint-red',
    glowClass: 'animate-glow-pulse',
  },
  NOT_SENT: {
    label: 'BC NON ENVOYE',
    icon: Send,
    pillBg: 'bg-[#FF9500]',
    pillText: 'text-white',
    glassTint: 'glass-tint-orange',
    glowClass: '',
  },
  SUPPLIER_DELAY: {
    label: 'RETARD FOURNISSEUR',
    icon: AlertTriangle,
    pillBg: 'bg-[#FF3B30]',
    pillText: 'text-white',
    glassTint: 'glass-tint-red',
    glowClass: '',
  },
  AWAITING_SUPPLIER: {
    label: 'EN ATTENTE',
    icon: Clock,
    pillBg: 'bg-[#007AFF]',
    pillText: 'text-white',
    glassTint: 'glass-tint-blue',
    glowClass: '',
  },
  RECEIVED: {
    label: 'RECEPTIONNE',
    icon: CheckCircle,
    pillBg: 'bg-[#34C759]',
    pillText: 'text-white',
    glassTint: 'glass-tint-emerald',
    glowClass: '',
  },
  CANCELLED: {
    label: 'ANNULE',
    icon: XCircle,
    pillBg: 'bg-[#8E8E93]',
    pillText: 'text-white',
    glassTint: 'glass-tint-neutral',
    glowClass: '',
  },
};

export const PurchaseOrderDecisionCard = memo(function PurchaseOrderDecisionCard({
  order,
  status,
  userRole,
  onAction,
  onRefresh,
}: PurchaseOrderDecisionCardProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const showImpact = order.impactRecipes > 0;
  const showSupplierRisk = (order.supplierDelayCount ?? 0) > 0;

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
          {/* Fournisseur + Montant */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[8px] bg-black/[0.03] flex items-center justify-center">
                <Truck className="w-3.5 h-3.5 text-[#86868B]" />
              </div>
              <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">
                {order.supplierName}
              </h3>
            </div>
            <span className="font-display text-[17px] font-bold text-[#6E6E73] tracking-tight">
              {order.totalAmount.toLocaleString('fr-FR')} {order.currency}
            </span>
          </div>

          {/* Détails */}
          <div className="mt-2.5 flex items-center gap-4 flex-wrap text-[13px]">
            {/* Impact recettes */}
            {showImpact && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF3B30]/8 text-[#FF3B30] font-semibold text-[12px]">
                Bloque {order.impactRecipes} recette{order.impactRecipes > 1 ? 's' : ''}
              </span>
            )}

            {/* Livraison prévue */}
            {order.expectedDelivery && (
              <span className="text-[#86868B]">
                Livraison : <span className="font-medium text-[#1D1D1F]">
                  {order.daysUntilDelivery !== undefined
                    ? order.daysUntilDelivery === 0
                      ? "Aujourd'hui"
                      : order.daysUntilDelivery > 0
                        ? `J+${order.daysUntilDelivery}`
                        : `J${order.daysUntilDelivery} (retard)`
                    : new Date(order.expectedDelivery).toLocaleDateString('fr-FR')
                  }
                </span>
              </span>
            )}

            {/* Référence BC */}
            <span className="font-mono text-[11px] text-[#AEAEB2] bg-black/[0.03] px-2 py-0.5 rounded-md">
              {order.reference}
            </span>
          </div>

          {/* Indicateur risque fournisseur */}
          {showSupplierRisk && (
            <div className="mt-2.5">
              <SupplierRiskIndicatorMini
                delayCount={order.supplierDelayCount!}
                supplierName={order.supplierName}
              />
            </div>
          )}
        </div>

        {/* Action */}
        <div className="flex-shrink-0">
          <PrimaryPurchaseOrderAction
            status={status}
            orderId={order.id}
            userRole={userRole}
            onAction={onAction}
            onRefresh={onRefresh}
          />
        </div>
      </div>
    </div>
  );
});

/**
 * Calcule le statut décisionnel d'un BC
 */
export function getPurchaseOrderDecisionStatus(
  sent: boolean,
  received: boolean,
  cancelled: boolean,
  productionBlocked: boolean,
  delayDetected: boolean
): PurchaseOrderDecisionStatus {
  if (cancelled) return 'CANCELLED';
  if (received) return 'RECEIVED';
  if (!sent && productionBlocked) return 'URGENT_SEND';
  if (!sent) return 'NOT_SENT';
  if (sent && !received && delayDetected) return 'SUPPLIER_DELAY';
  if (sent && !received) return 'AWAITING_SUPPLIER';
  return 'CANCELLED';
}
