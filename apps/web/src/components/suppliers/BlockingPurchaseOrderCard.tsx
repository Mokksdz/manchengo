'use client';

import { FileText, Clock, AlertTriangle, Send, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/components/appro/CriticalActionBanner';

/**
 * BlockingPurchaseOrderCard — BC bloquant dans la chaîne
 * 
 * CTA dépend du rôle:
 * - APPRO → Envoyer / Relancer
 * - ADMIN → Forcer / Annuler
 */

export type BlockingBcStatus = 'NOT_SENT' | 'SENT' | 'DELAYED';

export interface BlockingPurchaseOrder {
  id: number;
  reference: string;
  status: BlockingBcStatus;
  expectedDeliveryDate?: string;
  daysUntilDelivery?: number;
  blockingMpCount: number;
}

interface BlockingPurchaseOrderCardProps {
  order: BlockingPurchaseOrder;
  userRole: UserRole;
  onAction?: () => void;
}

const statusConfig: Record<BlockingBcStatus, {
  label: string;
  bg: string;
  text: string;
  icon: typeof Clock;
}> = {
  NOT_SENT: {
    label: '🔴 NON ENVOYÉ',
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: AlertTriangle,
  },
  SENT: {
    label: '🟡 ENVOYÉ',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: Clock,
  },
  DELAYED: {
    label: '🔴 EN RETARD',
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: AlertTriangle,
  },
};

export function BlockingPurchaseOrderCard({ 
  order, 
  userRole,
  onAction 
}: BlockingPurchaseOrderCardProps) {
  const config = statusConfig[order.status];
  const StatusIcon = config.icon;
  const isAdmin = userRole === 'ADMIN';

  const getActionLabel = () => {
    if (order.status === 'NOT_SENT') {
      return isAdmin ? 'Forcer envoi' : 'Envoyer maintenant';
    }
    if (order.status === 'DELAYED') {
      return isAdmin ? 'Escalader' : 'Relancer fournisseur';
    }
    return isAdmin ? 'Suivre' : 'Relancer';
  };

  const ActionIcon = order.status === 'NOT_SENT' ? Send : Phone;

  return (
    <div className="glass-card-hover rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-[#1D1D1F]">{order.reference}</h4>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-semibold',
                config.bg,
                config.text
              )}>
                {config.label}
              </span>
            </div>
            
            <div className="mt-2 flex items-center gap-4 text-sm text-[#6E6E73]">
              {order.daysUntilDelivery !== undefined && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Livraison : {order.daysUntilDelivery > 0 
                    ? `J+${order.daysUntilDelivery}` 
                    : order.daysUntilDelivery === 0 
                      ? "Aujourd'hui" 
                      : `J${order.daysUntilDelivery}`
                  }
                </span>
              )}
              <span className="flex items-center gap-1 text-red-600 font-semibold">
                <StatusIcon className="w-3.5 h-3.5" />
                Bloque : {order.blockingMpCount} MP
              </span>
            </div>
          </div>
        </div>

        {onAction && (
          <button
            onClick={onAction}
            className={cn(
              'flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              order.status === 'NOT_SENT' || order.status === 'DELAYED'
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            )}
          >
            <ActionIcon className="w-4 h-4" />
            {getActionLabel()}
          </button>
        )}
      </div>
    </div>
  );
}
