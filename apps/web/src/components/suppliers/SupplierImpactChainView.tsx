'use client';

import { Truck, FileText, Package, Factory, ArrowDown, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SupplierReliabilityScore } from './SupplierReliabilityScore';
import { BlockingPurchaseOrderCard } from './BlockingPurchaseOrderCard';
import { BlockedStockSummary } from './BlockedStockSummary';
import { ProductionImpactMiniList } from './ProductionImpactMiniList';
import type { UserRole } from '@/components/appro/CriticalActionBanner';
import type { SupplierRiskLevel } from './SupplierRiskCard';

/**
 * SupplierImpactChainView — Composant clé de la chaîne d'impact
 * 
 * Affichage vertical strict:
 * 🧑‍🌾 Fournisseur
 *       ↓
 * 📄 Bons de commande
 *       ↓
 * 📦 Matières premières
 *       ↓
 * 🏭 Productions impactées
 */

export interface SupplierChainData {
  // Supplier info
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  reliabilityScore: number;
  riskLevel: SupplierRiskLevel;
  incidentsLast30Days: number;
  
  // Related data — Types flexibles pour compatibilité API
  blockingOrders: Array<{
    id: number;
    reference: string;
    status: 'NOT_SENT' | 'SENT' | 'DELAYED';
    daysUntilDelivery: number | null;
    blockingMpCount: number;
  }>;
  blockedMps: Array<{
    id: number;
    code: string;
    name: string;
    status: 'RUPTURE' | 'CRITICAL' | 'LOW';
    daysRemaining?: number;
  }>;
  impactedProductions: Array<{
    id: number;
    recipeName: string;
    status: 'BLOCKED' | 'AT_RISK';
  }>;
}

interface SupplierImpactChainViewProps {
  data: SupplierChainData;
  userRole: UserRole;
  onSendBc?: (bcId: number) => void;
  onViewMp?: (mpId: number) => void;
  onViewProduction?: (productionId: number) => void;
}

function ChainArrow() {
  return (
    <div className="flex justify-center py-2">
      <div className="flex flex-col items-center">
        <div className="w-0.5 h-4 bg-[#D1D1D6]" />
        <ArrowDown className="w-5 h-5 text-[#AEAEB2]" />
      </div>
    </div>
  );
}

function ChainSection({ 
  icon: Icon, 
  iconBg, 
  iconColor, 
  title, 
  count,
  children 
}: { 
  icon: typeof Truck;
  iconBg: string;
  iconColor: string;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#FAFAFA] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        <h3 className="font-bold text-[#1D1D1F]">{title}</h3>
        {count !== undefined && count > 0 && (
          <span className="ml-auto px-2.5 py-1 bg-[#E5E5E5] text-[#1D1D1F] text-sm font-semibold rounded-lg">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function SupplierImpactChainView({ 
  data, 
  userRole,
  onSendBc,
  onViewMp,
  onViewProduction,
}: SupplierImpactChainViewProps) {
  const riskColors = {
    CRITICAL: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    WARNING: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
    STABLE: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  };
  
  const colors = riskColors[data.riskLevel];

  return (
    <div className="space-y-0">
      {/* ═══════════════════════════════════════════════════════════════════
          🧑‍🌾 FOURNISSEUR
      ═══════════════════════════════════════════════════════════════════ */}
      <ChainSection
        icon={Truck}
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        title="Fournisseur"
      >
        <div className={cn(
          'rounded-xl border-2 p-4',
          colors.bg,
          colors.border
        )}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold text-[#1D1D1F]">{data.supplierName}</h4>
              <p className="text-sm text-[#86868B]">{data.supplierCode}</p>
              
              {data.incidentsLast30Days > 0 && (
                <div className="mt-2 flex items-center gap-2 text-sm text-amber-700">
                  <AlertOctagon className="w-4 h-4" />
                  <span>
                    {data.riskLevel === 'CRITICAL' ? 'Retards répétés' : 'Irrégularités'} — {data.incidentsLast30Days} incident{data.incidentsLast30Days > 1 ? 's' : ''} / 30j
                  </span>
                </div>
              )}
            </div>
            
            <div className="text-right">
              <div className="w-32">
                <SupplierReliabilityScore score={data.reliabilityScore} showLabel={false} />
              </div>
              <p className="text-xs text-[#86868B] mt-1">Fiabilité</p>
            </div>
          </div>
        </div>
      </ChainSection>

      <ChainArrow />

      {/* ═══════════════════════════════════════════════════════════════════
          📄 BONS DE COMMANDE
      ═══════════════════════════════════════════════════════════════════ */}
      <ChainSection
        icon={FileText}
        iconBg="bg-orange-100"
        iconColor="text-orange-600"
        title="Bons de commande"
        count={data.blockingOrders.length}
      >
        {data.blockingOrders.length === 0 ? (
          <p className="text-sm text-[#86868B] italic">Aucun BC bloquant</p>
        ) : (
          <div className="space-y-2">
            {data.blockingOrders.map((order) => (
              <BlockingPurchaseOrderCard
                key={order.id}
                order={{
                  id: order.id,
                  reference: order.reference,
                  status: order.status,
                  daysUntilDelivery: order.daysUntilDelivery ?? undefined,
                  blockingMpCount: order.blockingMpCount,
                }}
                userRole={userRole}
                onAction={onSendBc ? () => onSendBc(order.id) : undefined}
              />
            ))}
          </div>
        )}
      </ChainSection>

      <ChainArrow />

      {/* ═══════════════════════════════════════════════════════════════════
          📦 MATIÈRES PREMIÈRES
      ═══════════════════════════════════════════════════════════════════ */}
      <ChainSection
        icon={Package}
        iconBg="bg-red-100"
        iconColor="text-red-600"
        title="Matières premières"
        count={data.blockedMps.length}
      >
        {data.blockedMps.length === 0 ? (
          <p className="text-sm text-[#86868B] italic">Aucune MP bloquée</p>
        ) : (
          <BlockedStockSummary 
            blockedMps={data.blockedMps} 
            onViewMp={onViewMp}
          />
        )}
      </ChainSection>

      <ChainArrow />

      {/* ═══════════════════════════════════════════════════════════════════
          🏭 PRODUCTIONS IMPACTÉES
      ═══════════════════════════════════════════════════════════════════ */}
      <ChainSection
        icon={Factory}
        iconBg="bg-purple-100"
        iconColor="text-purple-600"
        title="Productions impactées"
        count={data.impactedProductions.length}
      >
        {data.impactedProductions.length === 0 ? (
          <p className="text-sm text-[#86868B] italic">Aucune production impactée</p>
        ) : (
          <ProductionImpactMiniList 
            productions={data.impactedProductions}
            onViewProduction={onViewProduction}
          />
        )}
      </ChainSection>
    </div>
  );
}
