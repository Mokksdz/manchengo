'use client';

/**
 * FOURNISSEURS — Radar de fiabilite fournisseur | Apple Glass Design
 *
 * En < 5 secondes, l'utilisateur sait:
 * - sur qui il peut s'appuyer
 * - qui met la production en danger
 * - qui doit etre evite ou bloque
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { appro, SupplierPerformance } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  Truck,
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  RefreshCw,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Link2,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { KeyboardHint } from '@/components/ui/keyboard-hint';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import {
  SupplierRiskCard,
  type SupplierPerformanceData,
  type SupplierRiskLevel,
  getSupplierRiskLevel,
} from '@/components/suppliers';
import type { UserRole } from '@/components/appro/CriticalActionBanner';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function transformToPerformanceData(supplier: SupplierPerformance): SupplierPerformanceData & { riskLevel: SupplierRiskLevel } {
  const tauxRetardPercent = Math.round((supplier.metrics.tauxRetard || 0) * 100);
  const bcSent30Days = supplier.stats?.totalLivraisons || 0;
  const bcLate = supplier.stats?.livraisonsRetard || 0;
  const deliveryRespectRate = 100 - tauxRetardPercent;
  const impactRecipes = 0;
  const lastIncidentDays = undefined;
  const reliabilityScore = supplier.scorePerformance ?? 0;
  const riskLevel = getSupplierRiskLevel(tauxRetardPercent, impactRecipes, bcLate);

  return {
    id: supplier.id,
    code: supplier.code,
    name: supplier.name,
    bcSent30Days,
    bcLate,
    deliveryRespectRate,
    impactRecipes,
    lastIncidentDays,
    reliabilityScore,
    riskLevel,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ApproFournisseursPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllStable, setShowAllStable] = useState(false);

  const loadData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);
      const suppliersData = await appro.getSupplierPerformance();
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts([
    { key: 'n', handler: () => router.push('/dashboard/appro/fournisseurs/nouveau'), description: 'Nouveau fournisseur' },
    { key: 'r', handler: () => loadData(true), description: 'Actualiser les donnees' },
    { key: '/', handler: () => searchInputRef.current?.focus(), description: 'Rechercher' },
  ]);

  if (isLoading) {
    return (
      <div className="glass-bg space-y-6 animate-fade-in">
        {/* Skeleton header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-36 rounded-full" />
          </div>
        </div>
        {/* Skeleton supplier cards */}
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl border border-black/[0.04] bg-white/60 p-5 flex items-center gap-5">
              <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const allSuppliers = suppliers.map(transformToPerformanceData);

  const filteredSuppliers = searchQuery.trim()
    ? allSuppliers.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allSuppliers;

  const zoneCritical = filteredSuppliers.filter(s => s.riskLevel === 'CRITICAL');
  const zoneWarning = filteredSuppliers.filter(s => s.riskLevel === 'WARNING');
  const zoneStable = filteredSuppliers.filter(s => s.riskLevel === 'STABLE');

  const visibleStable = showAllStable ? zoneStable : zoneStable.slice(0, 5);
  const hiddenStableCount = zoneStable.length - visibleStable.length;

  const userRole: UserRole = (user?.role as UserRole) || 'APPRO';
  const isAdmin = userRole === 'ADMIN';

  return (
    <div className="glass-bg space-y-8">
      <PageHeader
        title="Radar Fournisseurs"
        subtitle={isAdmin
          ? "Pilotage dependance et risques"
          : "Fiabilite et choix fournisseurs"
        }
        icon={<Truck className="w-6 h-6" />}
        badge={zoneCritical.length > 0
          ? { text: `${zoneCritical.length} a risque`, variant: 'error' }
          : { text: 'Sous controle', variant: 'success' }
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/appro"
              className="glass-btn p-2.5 rounded-[12px]"
            >
              <ArrowLeft className="w-4.5 h-4.5 text-[#6E6E73]" />
            </Link>
            <Link
              href="/dashboard/appro/fournisseurs/impact"
              className="glass-btn px-3.5 py-2 rounded-[12px] text-[13px] text-[#EC7620] font-medium"
            >
              <Link2 className="w-4 h-4" />
              Chaine d'impact
            </Link>
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="glass-btn p-2.5 rounded-[12px] disabled:opacity-50"
              title="Actualiser (R)"
            >
              <RefreshCw className={cn('w-4.5 h-4.5 text-[#6E6E73]', isRefreshing && 'animate-spin')} />
              <KeyboardHint shortcut="R" />
            </button>
            <Link
              href="/dashboard/appro/fournisseurs/nouveau"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-[#333336] transition-all duration-200 font-medium text-[14px] shadow-lg shadow-[#1D1D1F]/10 hover:shadow-xl hover:shadow-[#1D1D1F]/15 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              Nouveau
              <KeyboardHint shortcut="N" />
            </Link>
          </div>
        }
      />

      {/* Barre de recherche */}
      <div className="glass-search relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#AEAEB2]" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Rechercher un fournisseur par nom ou code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-16 py-3.5 bg-transparent rounded-[16px] text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:outline-none"
        />
        <span className="absolute right-10 top-1/2 -translate-y-1/2">
          <KeyboardHint shortcut="/" />
        </span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/[0.05] flex items-center justify-center hover:bg-black/[0.1] transition-colors"
          >
            <X className="w-3.5 h-3.5 text-[#86868B]" />
          </button>
        )}
      </div>

      {/* ZONE 1 — FOURNISSEURS A RISQUE */}
      {zoneCritical.length > 0 && (
        <section className="animate-slide-up">
          <div className="glass-section-header">
            <div className="glass-section-icon bg-[#FF3B30]/8">
              <AlertOctagon className="w-5 h-5 text-[#FF3B30]" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-[#1D1D1F] tracking-[-0.01em]">Fournisseurs a risque</h2>
              <p className="text-[13px] text-[#FF3B30]">
                {zoneCritical.length} fournisseur{zoneCritical.length > 1 ? 's' : ''} mettant la production en danger
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {zoneCritical.map((supplier, i) => (
              <div key={supplier.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <SupplierRiskCard
                  supplier={supplier}
                  riskLevel={supplier.riskLevel}
                  userRole={userRole}
                  onViewPerformance={() => router.push(`/dashboard/appro/fournisseurs/${supplier.id}`)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ZONE 2 — SOUS SURVEILLANCE */}
      {zoneWarning.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="glass-section-header">
            <div className="glass-section-icon bg-[#FF9500]/8">
              <AlertTriangle className="w-5 h-5 text-[#FF9500]" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-[#1D1D1F] tracking-[-0.01em]">Sous surveillance</h2>
              <p className="text-[13px] text-[#FF9500]">
                {zoneWarning.length} fournisseur{zoneWarning.length > 1 ? 's' : ''} avec irregularites recentes
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {zoneWarning.map((supplier, i) => (
              <div key={supplier.id} className="animate-slide-up" style={{ animationDelay: `${(i * 60) + 100}ms` }}>
                <SupplierRiskCard
                  supplier={supplier}
                  riskLevel={supplier.riskLevel}
                  userRole={userRole}
                  onViewPerformance={() => router.push(`/dashboard/appro/fournisseurs/${supplier.id}`)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ZONE 3 — FOURNISSEURS FIABLES */}
      {zoneStable.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="glass-section-header">
            <div className="glass-section-icon bg-[#34C759]/8">
              <CheckCircle className="w-5 h-5 text-[#34C759]" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-[#1D1D1F] tracking-[-0.01em]">Fournisseurs fiables</h2>
              <p className="text-[13px] text-[#34C759]">{zoneStable.length} fournisseur{zoneStable.length > 1 ? 's' : ''} de confiance</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {visibleStable.map((supplier, i) => (
              <div key={supplier.id} className="animate-slide-up" style={{ animationDelay: `${(i * 40) + 200}ms` }}>
                <SupplierRiskCard
                  supplier={supplier}
                  riskLevel={supplier.riskLevel}
                  userRole={userRole}
                  onViewPerformance={() => router.push(`/dashboard/appro/fournisseurs/${supplier.id}`)}
                />
              </div>
            ))}
            {hiddenStableCount > 0 && (
              <button
                onClick={() => setShowAllStable(true)}
                className="glass-btn w-full py-3.5 rounded-[16px] text-[13px] text-[#86868B] hover:text-[#1D1D1F] justify-center"
              >
                <ChevronDown className="w-4 h-4" />
                Voir {hiddenStableCount} autres fournisseurs fiables
              </button>
            )}
            {showAllStable && zoneStable.length > 5 && (
              <button
                onClick={() => setShowAllStable(false)}
                className="glass-btn w-full py-3.5 rounded-[16px] text-[13px] text-[#86868B] hover:text-[#1D1D1F] justify-center"
              >
                <ChevronUp className="w-4 h-4" />
                Reduire la liste
              </button>
            )}
          </div>
        </section>
      )}

      {/* Etat vide */}
      {allSuppliers.length === 0 && (
        <div className="glass-empty p-16 animate-scale-in">
          <div className="w-16 h-16 rounded-[20px] bg-[#F5F5F5] flex items-center justify-center mx-auto">
            <Truck className="w-8 h-8 text-[#D1D1D6]" />
          </div>
          <p className="mt-5 text-[20px] font-semibold text-[#1D1D1F]">Aucun fournisseur</p>
          <p className="text-[#86868B] mt-1.5 text-[14px]">
            Les fournisseurs apparaitront ici une fois crees.
          </p>
        </div>
      )}
    </div>
  );
}
