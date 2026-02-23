'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CHAÎNE D'IMPACT FOURNISSEURS — DONNÉES RÉELLES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * FOURNISSEUR → BON DE COMMANDE → MATIÈRES PREMIÈRES → PRODUCTIONS BLOQUÉES
 * 
 * ⚠️ ZÉRO MOCK DATA — Toutes les données viennent de l'API
 * Si les données sont indisponibles, un état explicite est affiché
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  suppliers, 
  type SupplierImpact as SupplierImpactApi, 
  type SupplierImpactChain as SupplierImpactChainApi,
  type SupplierRiskLevel,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  RefreshCw,
  Link2,
  AlertOctagon,
  AlertTriangle,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { SupplierImpactChainView } from '@/components/suppliers';
import type { UserRole } from '@/components/appro/CriticalActionBanner';
import { createLogger } from '@/lib/logger';

const log = createLogger('SupplierImpact');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — Adaptés depuis l'API
// ═══════════════════════════════════════════════════════════════════════════════

interface ChainData {
  supplier: {
    id: number;
    code: string;
    name: string;
    reliabilityScore: number;
    riskLevel: SupplierRiskLevel;
    incidentsLast30Days: number;
  };
  blockingOrders: {
    id: number;
    reference: string;
    status: 'NOT_SENT' | 'SENT' | 'DELAYED';
    daysUntilDelivery: number | null;
    blockingMpCount: number;
  }[];
  blockedMps: {
    id: number;
    code: string;
    name: string;
    status: 'RUPTURE' | 'CRITICAL' | 'LOW';
    daysRemaining?: number;
  }[];
  impactedProductions: {
    id: number;
    recipeName: string;
    status: 'BLOCKED' | 'AT_RISK';
  }[];
}

/**
 * Transforme les données API en format attendu par le composant
 */
function transformChainData(apiData: SupplierImpactChainApi): ChainData {
  return {
    supplier: {
      id: apiData.supplier.id,
      code: apiData.supplier.code,
      name: apiData.supplier.name,
      reliabilityScore: apiData.supplier.reliabilityScore,
      riskLevel: apiData.supplier.riskLevel,
      incidentsLast30Days: apiData.supplier.incidentsLast30Days,
    },
    blockingOrders: apiData.purchaseOrders.map(bc => ({
      id: parseInt(bc.id) || 0,
      reference: bc.reference,
      status: bc.isDelayed ? 'DELAYED' : (bc.status === 'DRAFT' ? 'NOT_SENT' : 'SENT'),
      daysUntilDelivery: bc.daysUntilDelivery,
      blockingMpCount: bc.blockingMpCount,
    })),
    blockedMps: apiData.blockedMaterials.map(mp => ({
      id: mp.id,
      code: mp.code,
      name: mp.name,
      status: mp.status,
      daysRemaining: mp.daysRemaining ?? undefined,
    })),
    impactedProductions: apiData.impactedRecipes.map(recipe => ({
      id: recipe.id,
      recipeName: recipe.name,
      status: recipe.status,
    })),
  };
}

/**
 * ImpactCard — Carte d'impact fournisseur (données réelles)
 */
function ImpactCard({ 
  impact, 
  onViewChain 
}: { 
  impact: SupplierImpactApi; 
  onViewChain: () => void;
}) {
  const riskConfig = {
    CRITICAL: {
      label: '🔴 FOURNISSEUR À RISQUE',
      bg: 'bg-red-600',
      text: 'text-white',
      cardBg: 'bg-[#FFEBEE]',
      border: 'border-red-300',
      btnBg: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200',
    },
    WARNING: {
      label: '🟠 SOUS SURVEILLANCE',
      bg: 'bg-amber-500',
      text: 'text-white',
      cardBg: 'bg-amber-50',
      border: 'border-amber-300',
      btnBg: 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200',
    },
    STABLE: {
      label: '🟢 FIABLE',
      bg: 'bg-emerald-500',
      text: 'text-white',
      cardBg: 'bg-emerald-50',
      border: 'border-emerald-200',
      btnBg: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200',
    },
  };

  const config = riskConfig[impact.riskLevel];

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
          <AlertOctagon className="w-4 h-4" />
          <span className="hidden sm:inline">{config.label}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">
              {impact.supplierName}
            </h3>
            <span className="font-mono text-xs text-[#AEAEB2]">{impact.supplierCode}</span>
            {impact.isMonoSource && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                🔴 Source unique ({impact.monoSourceMpCount} MP)
              </span>
            )}
          </div>

          {/* Impact metrics - DONNÉES RÉELLES */}
          <div className="mt-3 flex items-center gap-6 text-sm">
            {impact.bcBlockingCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[#6E6E73]">
                  BC bloquants : <span className="font-bold text-orange-600">{impact.bcBlockingCount}</span>
                </span>
              </div>
            )}
            {impact.delayedBcCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[#6E6E73]">
                  BC en retard : <span className="font-bold text-red-600">{impact.delayedBcCount}</span>
                </span>
              </div>
            )}
            {impact.blockedMpCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[#6E6E73]">
                  MP impactées : <span className="font-bold text-red-600">{impact.blockedMpCount}</span>
                </span>
              </div>
            )}
            {impact.impactedRecipesCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[#6E6E73]">
                  Recettes bloquées : <span className="font-bold text-purple-600">{impact.impactedRecipesCount}</span>
                </span>
              </div>
            )}
          </div>

          {/* Reliability Score */}
          <div className="mt-3 flex items-center gap-3 max-w-xs">
            <span className="text-[12px] font-bold uppercase tracking-widest text-[#86868B]">Fiabilité</span>
            <div className={cn(
              'flex-1 h-2.5 rounded-full overflow-hidden',
              impact.reliabilityScore >= 80 ? 'bg-emerald-100' : 
              impact.reliabilityScore >= 60 ? 'bg-amber-100' : 'bg-red-100'
            )}>
              <div 
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  impact.reliabilityScore >= 80 ? 'bg-emerald-500' : 
                  impact.reliabilityScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${impact.reliabilityScore}%` }}
              />
            </div>
            <span className={cn(
              'font-bold text-lg tabular-nums',
              impact.reliabilityScore >= 80 ? 'text-emerald-700' : 
              impact.reliabilityScore >= 60 ? 'text-amber-700' : 'text-red-700'
            )}>
              {impact.reliabilityScore}
            </span>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={onViewChain}
          className={cn(
            'flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all',
            config.btnBg
          )}
        >
          <span>Voir chaîne d'impact</span>
          <Link2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function SupplierImpactPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedSupplierId = searchParams.get('supplier');
  
  const [impacts, setImpacts] = useState<SupplierImpactApi[]>([]);
  const [chainData, setChainData] = useState<ChainData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataUnavailable, setDataUnavailable] = useState(false);

  const loadData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);
      setError(null);
      setDataUnavailable(false);
      
      // ⚠️ DONNÉES RÉELLES — Appel API
      const data = await suppliers.getImpacts();
      
      // Filtrer uniquement les fournisseurs avec impact réel
      setImpacts(data.filter(i => 
        i.bcBlockingCount > 0 || 
        i.blockedMpCount > 0 || 
        i.riskLevel !== 'STABLE'
      ));
      
      // Si un fournisseur est sélectionné, charger sa chaîne d'impact
      if (selectedSupplierId) {
        const chainApiData = await suppliers.getImpactChain(parseInt(selectedSupplierId));
        setChainData(transformChainData(chainApiData));
      }
    } catch (err) {
      log.error('Failed to load impacts:', err);
      setError('Impossible de charger les données fournisseurs');
      setDataUnavailable(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedSupplierId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleViewChain = (supplierId: number) => {
    router.push(`/dashboard/appro/fournisseurs/impact?supplier=${supplierId}`);
  };

  const handleCloseChain = () => {
    router.push('/dashboard/appro/fournisseurs/impact');
    setChainData(null);
  };

  const userRole: UserRole = (user?.role as UserRole) || 'APPRO';
  const isAdmin = userRole === 'ADMIN';

  if (isLoading) {
    return (
      <div className="glass-bg space-y-6 animate-fade-in">
        {/* Skeleton header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-60" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>
        {/* Skeleton impact cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-[28px] border border-black/[0.04] bg-white/60 p-5 space-y-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-36 rounded-xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-48" />
                <div className="flex gap-6">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-2.5 w-48 rounded-full" />
              </div>
              <Skeleton className="h-10 w-40 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ⚠️ ÉTAT D'INDISPONIBILITÉ EXPLICITE — Jamais de fallback silencieux
  if (dataUnavailable || error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Chaîne d'Impact"
          subtitle="Données indisponibles"
          icon={<Link2 className="w-6 h-6" />}
          badge={{ text: 'Indisponible', variant: 'warning' }}
          actions={
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/appro/fournisseurs"
                className="p-2.5 bg-[#F5F5F5] rounded-xl hover:bg-[#E5E5E5] transition-all"
              >
                <ArrowLeft className="w-5 h-5 text-[#6E6E73]" />
              </Link>
              <button
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D1D1F] text-white rounded-xl hover:bg-[#333336] transition-all font-medium shadow-apple-hover shadow-[#1D1D1F]/10 disabled:opacity-50"
              >
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                Réessayer
              </button>
            </div>
          }
        />
        
        <div className="bg-amber-50 border-2 border-amber-200 rounded-[28px] p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto" />
          <h2 className="mt-4 font-display text-[17px] font-bold text-amber-900 tracking-tight">Données fournisseur indisponibles</h2>
          <p className="mt-2 text-amber-700 max-w-md mx-auto">
            Les indicateurs d'impact seront visibles dès synchronisation complète avec le serveur.
          </p>
          {error && (
            <p className="mt-4 text-sm text-amber-600 font-mono bg-amber-100 rounded-lg px-4 py-2 inline-block">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  const criticalCount = impacts.filter(i => i.riskLevel === 'CRITICAL').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chaîne d'Impact"
        subtitle={isAdmin 
          ? "Dépendances critiques et arbitrage" 
          : "Origine des blocages fournisseurs"
        }
        icon={<Link2 className="w-6 h-6" />}
        badge={criticalCount > 0 
          ? { text: `${criticalCount} fournisseur${criticalCount > 1 ? 's' : ''} critique${criticalCount > 1 ? 's' : ''}`, variant: 'error' } 
          : { text: 'Aucun blocage', variant: 'success' }
        }
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/appro/fournisseurs"
              className="p-2.5 bg-[#F5F5F5] rounded-xl hover:bg-[#E5E5E5] transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-[#6E6E73]" />
            </Link>
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D1D1F] text-white rounded-xl hover:bg-[#333336] transition-all font-medium shadow-apple-hover shadow-[#1D1D1F]/10 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              Actualiser
            </button>
          </div>
        }
      />

      {/* Chain View (Drawer-style when supplier selected) */}
      {chainData && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseChain} />
          <div className="relative ml-auto w-full max-w-2xl bg-white/92 backdrop-blur-[28px] border border-white/75 shadow-[0_24px_58px_rgba(18,22,33,0.16),inset_0_1px_0_rgba(255,255,255,0.5)] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white/78 backdrop-blur-[20px] border-b border-white/70 px-6 py-4 flex items-center justify-between">
              <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
                <Link2 className="w-5 h-5 text-[#AEAEB2]" />
                Chaîne d'impact
              </h2>
              <button
                onClick={handleCloseChain}
                className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#86868B]" />
              </button>
            </div>
            <div className="p-6">
              <SupplierImpactChainView
                data={{
                  supplierId: chainData.supplier.id,
                  supplierCode: chainData.supplier.code,
                  supplierName: chainData.supplier.name,
                  reliabilityScore: chainData.supplier.reliabilityScore,
                  riskLevel: chainData.supplier.riskLevel,
                  incidentsLast30Days: chainData.supplier.incidentsLast30Days,
                  blockingOrders: chainData.blockingOrders,
                  blockedMps: chainData.blockedMps,
                  impactedProductions: chainData.impactedProductions,
                }}
                userRole={userRole}
                onSendBc={(bcId) => router.push(`/dashboard/appro/bons?bc=${bcId}`)}
                onViewMp={(mpId) => router.push(`/dashboard/stock/mp?mp=${mpId}`)}
                onViewProduction={(productionId) => router.push(`/dashboard/production/${productionId}`)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Impact Cards List */}
      {impacts.length === 0 ? (
        <div className="glass-card rounded-[28px] p-12 text-center">
          <Link2 className="w-16 h-16 text-emerald-300 mx-auto" />
          <p className="mt-4 font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Aucun blocage fournisseur détecté</p>
          <p className="text-[#86868B] mt-2">
            Aucun fournisseur n'impacte actuellement la production.<br />
            <span className="text-xs text-[#AEAEB2]">Données vérifiées en temps réel</span>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Critical Zone */}
          {impacts.filter(i => i.riskLevel === 'CRITICAL').length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertOctagon className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="font-display text-[17px] font-bold text-red-900 tracking-tight">Impact critique</h2>
                  <p className="text-sm text-red-600">Fournisseurs bloquant la production</p>
                </div>
              </div>
              <div className="space-y-3">
                {impacts.filter(i => i.riskLevel === 'CRITICAL').map((impact) => (
                  <ImpactCard
                    key={impact.supplierId}
                    impact={impact}
                    onViewChain={() => handleViewChain(impact.supplierId)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Warning Zone */}
          {impacts.filter(i => i.riskLevel === 'WARNING').length > 0 && (
            <section className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <AlertOctagon className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="font-display text-[17px] font-bold text-amber-900 tracking-tight">Sous surveillance</h2>
                  <p className="text-sm text-amber-600">Risques potentiels à surveiller</p>
                </div>
              </div>
              <div className="space-y-3">
                {impacts.filter(i => i.riskLevel === 'WARNING').map((impact) => (
                  <ImpactCard
                    key={impact.supplierId}
                    impact={impact}
                    onViewChain={() => handleViewChain(impact.supplierId)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
