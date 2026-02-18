'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ÉCRAN 1 — STOCK MP V1 SAFE (VUE DÉCISIONNELLE CENTRALE)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * QUESTION UNIQUE: "Sur quoi dois-je agir maintenant ?"
 *
 * C'EST L'ÉCRAN CENTRAL DU PRODUIT
 *
 * RÈGLES V1 SAFE:
 * - Colonnes: MP | ÉTAT | STOCK | JOURS | BC EN COURS | IMPACT | ACTION
 * - Une seule action possible par ligne
 * - BLOQUANT → "Créer BC URGENT"
 * - À COMMANDER → "Créer Demande"
 * - OK → Pas de bouton
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { appro, StockMpWithState, SupplierPerformance } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Package,
  AlertOctagon,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Search,
  ArrowUpDown,
  RefreshCw,
  Factory,
  Timer,
  ShieldAlert,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton, SkeletonKpiGrid, SkeletonTable } from '@/components/ui/skeleton-loader';
import { StatCard } from '@/components/ui/stat-card';
import { ResponsiveTable, Column } from '@/components/ui/responsive-table';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANTS UI
// ═══════════════════════════════════════════════════════════════════════════════

function StateBadge({ state }: { state: string }) {
  const config: Record<string, { bg: string; text: string; label: string; icon: typeof AlertTriangle }> = {
    BLOQUANT_PRODUCTION: { bg: 'bg-rose-100 border border-rose-200', text: 'text-rose-700', label: 'BLOQUANT', icon: AlertOctagon },
    RUPTURE: { bg: 'bg-rose-50', text: 'text-rose-600', label: 'RUPTURE', icon: XCircle },
    A_COMMANDER: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'À COMMANDER', icon: Clock },
    SOUS_SEUIL: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'SOUS SEUIL', icon: AlertTriangle },
    SAIN: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'SAIN', icon: CheckCircle },
  };
  const { bg, text, label, icon: Icon } = config[state] || config.SAIN;

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold', bg, text)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function CriticiteBadge({ criticite }: { criticite: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    BLOQUANTE: { bg: 'bg-rose-100', text: 'text-rose-700' },
    HAUTE: { bg: 'bg-orange-100', text: 'text-orange-700' },
    MOYENNE: { bg: 'bg-amber-100', text: 'text-amber-700' },
    FAIBLE: { bg: 'bg-[#F5F5F5]', text: 'text-[#6E6E73]' },
  };
  const { bg, text } = config[criticite] || config.FAIBLE;

  return (
    <span className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold', bg, text)}>
      {criticite}
    </span>
  );
}

function JoursCouvertureBadge({ jours, leadTime }: { jours: number | null; leadTime: number }) {
  // V1 SAFE: Supprimer "∞" - afficher "—" si pas de données
  if (jours === null) {
    return <span className="text-[#AEAEB2]">—</span>;
  }

  const isUrgent = jours < leadTime;
  const isCritical = jours < 3;

  return (
    <span className={cn(
      'font-bold text-lg',
      isCritical ? 'text-rose-600' : isUrgent ? 'text-amber-600' : 'text-[#1D1D1F]'
    )}>
      {jours.toFixed(0)}j
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTRES
// ═══════════════════════════════════════════════════════════════════════════════

type FilterType = 'all' | 'bloquant' | 'rupture' | 'a_commander' | 'urgent' | 'bloquante';

const FILTERS: { key: FilterType; label: string; icon: typeof AlertOctagon; color: string }[] = [
  { key: 'all', label: 'Toutes', icon: Package, color: 'bg-[#6E6E73]' },
  { key: 'bloquant', label: 'Bloquantes', icon: AlertOctagon, color: 'bg-red-600' },
  { key: 'rupture', label: 'Rupture', icon: XCircle, color: 'bg-red-500' },
  { key: 'a_commander', label: 'À commander', icon: Clock, color: 'bg-amber-500' },
  { key: 'urgent', label: '< 7 jours', icon: Timer, color: 'bg-orange-500' },
  { key: 'bloquante', label: 'Criticité BLOQUANTE', icon: ShieldAlert, color: 'bg-red-700' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ApproStockPage() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') as FilterType || 'all';

  const [stockMp, setStockMp] = useState<StockMpWithState[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtres
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'jours' | 'criticite' | 'state' | 'name'>('state');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const loadData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);

      const [stockData, suppliersData] = await Promise.all([
        appro.getStockMp(),
        appro.getSupplierPerformance(),
      ]);

      setStockMp(Array.isArray(stockData) ? stockData : []);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
    } catch (err) {
      console.error('Failed to load stock:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrage et tri
  const filteredAndSortedMp = useMemo(() => {
    let filtered = [...stockMp];

    // Filtre par type
    switch (activeFilter) {
      case 'bloquant':
        filtered = filtered.filter(mp => mp.state === 'BLOQUANT_PRODUCTION');
        break;
      case 'rupture':
        filtered = filtered.filter(mp => mp.state === 'RUPTURE' || mp.state === 'BLOQUANT_PRODUCTION');
        break;
      case 'a_commander':
        filtered = filtered.filter(mp => mp.state === 'A_COMMANDER' || mp.state === 'SOUS_SEUIL');
        break;
      case 'urgent':
        filtered = filtered.filter(mp => mp.joursCouverture !== null && mp.joursCouverture < 7);
        break;
      case 'bloquante':
        filtered = filtered.filter(mp => mp.criticiteEffective === 'BLOQUANTE');
        break;
    }

    // Filtre par fournisseur
    if (selectedSupplier) {
      filtered = filtered.filter(mp => mp.supplierId === selectedSupplier);
    }

    // Recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(mp =>
        mp.name.toLowerCase().includes(query) ||
        mp.code.toLowerCase().includes(query)
      );
    }

    // Tri
    const stateOrder = { BLOQUANT_PRODUCTION: 0, RUPTURE: 1, A_COMMANDER: 2, SOUS_SEUIL: 3, SAIN: 4 };
    const criticiteOrder = { BLOQUANTE: 0, HAUTE: 1, MOYENNE: 2, FAIBLE: 3 };

    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'state':
          comparison = stateOrder[a.state] - stateOrder[b.state];
          break;
        case 'criticite':
          comparison = criticiteOrder[a.criticiteEffective] - criticiteOrder[b.criticiteEffective];
          break;
        case 'jours':
          const joursA = a.joursCouverture ?? Infinity;
          const joursB = b.joursCouverture ?? Infinity;
          comparison = joursA - joursB;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [stockMp, activeFilter, selectedSupplier, searchQuery, sortBy, sortOrder]);

  // Stats
  const stats = useMemo(() => ({
    total: stockMp.length,
    bloquant: stockMp.filter(mp => mp.state === 'BLOQUANT_PRODUCTION').length,
    rupture: stockMp.filter(mp => mp.state === 'RUPTURE').length,
    aCommander: stockMp.filter(mp => mp.state === 'A_COMMANDER').length,
    urgent: stockMp.filter(mp => mp.joursCouverture !== null && mp.joursCouverture < 7).length,
  }), [stockMp]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Column definitions for ResponsiveTable
  const stockColumns: Column<StockMpWithState>[] = [
    {
      key: 'name',
      header: 'Produit',
      className: 'text-left',
      mobileHidden: true, // shown via mobileCardTitle
      render: (mp) => (
        <div>
          <p className="font-medium text-[#1D1D1F]">{mp.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[#86868B]">{mp.code}</span>
            {mp.supplierName && (
              <span className="text-xs text-[#AEAEB2] flex items-center gap-1">
                <Truck className="w-3 h-3" />
                {mp.supplierName}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'jours',
      header: 'Jours restants',
      className: 'text-center',
      mobileLabel: 'Jours',
      render: (mp) => (
        <div className="text-center">
          <JoursCouvertureBadge jours={mp.joursCouverture} leadTime={mp.leadTimeFournisseur} />
          {mp.joursCouverture !== null && mp.joursCouverture < mp.leadTimeFournisseur && (
            <p className="text-xs text-red-500 mt-1">Lead time: {mp.leadTimeFournisseur}j</p>
          )}
        </div>
      ),
    },
    {
      key: 'criticite',
      header: 'Criticité',
      className: 'text-center',
      render: (mp) => (
        <div className="text-center">
          <CriticiteBadge criticite={mp.criticiteEffective} />
          {mp.criticiteParam !== mp.criticiteEffective && (
            <p className="text-xs text-[#AEAEB2] mt-1">param: {mp.criticiteParam}</p>
          )}
        </div>
      ),
    },
    {
      key: 'state',
      header: 'État',
      className: 'text-center',
      mobileHidden: true, // shown via mobileCardBadge
      render: (mp) => (
        <div className="text-center">
          <StateBadge state={mp.state} />
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      className: 'text-center',
      render: (mp) => (
        <div className="text-center">
          <p className={cn(
            'font-bold',
            mp.currentStock <= 0 ? 'text-red-600' :
            mp.currentStock <= mp.seuilSecurite ? 'text-amber-600' : 'text-[#1D1D1F]'
          )}>
            {mp.currentStock.toLocaleString()}
          </p>
          <p className="text-xs text-[#86868B]">{mp.unit}</p>
          <p className="text-xs text-[#AEAEB2] mt-1">min: {mp.minStock}</p>
        </div>
      ),
    },
    {
      key: 'bc',
      header: 'BC en cours',
      className: 'text-center',
      mobileHidden: true, // shown in footer action context
      render: (mp) => (
        <div className="text-center">
          {mp.bcEnCours ? (
            <Link
              href={`/dashboard/appro/bons/${mp.bcEnCours.id}`}
              className="inline-flex flex-col items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span className="text-xs font-mono font-medium text-blue-700">{mp.bcEnCours.reference}</span>
              <span className="text-xs text-blue-600">
                {mp.bcEnCours.expectedDelivery
                  ? new Date(mp.bcEnCours.expectedDelivery).toLocaleDateString('fr-FR')
                  : 'Sans date'}
              </span>
            </Link>
          ) : (
            <span className="text-[#AEAEB2]">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'impact',
      header: 'Impact Production',
      className: 'text-left',
      mobileLabel: 'Impact',
      render: (mp) => (
        <>
          {mp.usedInRecipes > 0 ? (
            <div className="flex items-center gap-2">
              <Factory className={cn('w-4 h-4', mp.state === 'BLOQUANT_PRODUCTION' ? 'text-red-600' : 'text-[#AEAEB2]')} />
              <span className={cn('text-sm', mp.state === 'BLOQUANT_PRODUCTION' ? 'text-red-600 font-medium' : 'text-[#6E6E73]')}>
                {mp.usedInRecipes} recette(s){mp.state === 'BLOQUANT_PRODUCTION' && ' BLOQUÉE(S)'}
              </span>
            </div>
          ) : (
            <span className="text-sm text-[#AEAEB2]">—</span>
          )}
        </>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      mobileHidden: true, // shown via mobileCardFooter
      render: (mp) => (
        <div className="text-right">
          {mp.bcEnCours ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-blue-600 font-medium">BC en cours</span>
              <Link
                href={`/dashboard/appro/bons/${mp.bcEnCours.id}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200"
              >
                Voir {mp.bcEnCours.reference}
              </Link>
            </div>
          ) : mp.state === 'BLOQUANT_PRODUCTION' || mp.state === 'RUPTURE' ? (
            <Link
              href={`/dashboard/appro/bons/new?mpId=${mp.id}&urgent=true`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 shadow-sm"
            >
              Créer BC URGENT
            </Link>
          ) : mp.state === 'A_COMMANDER' || mp.state === 'SOUS_SEUIL' ? (
            <Link
              href={`/dashboard/appro/bons/new?mpId=${mp.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600"
            >
              Créer BC
            </Link>
          ) : (
            <span className="text-[#AEAEB2]">—</span>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="glass-bg space-y-6 animate-fade-in">
        {/* Skeleton header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        {/* Skeleton KPI cards */}
        <SkeletonKpiGrid count={4} />
        {/* Skeleton table */}
        <SkeletonTable rows={6} columns={8} />
      </div>
    );
  }

  return (
    <div className="glass-bg space-y-6">
      <PageHeader
        title="Stock MP — Vue Décisionnelle"
        subtitle={`${filteredAndSortedMp.length} MP affichées sur ${stockMp.length}`}
        icon={<Package className="w-6 h-6" />}
        badge={stats.bloquant > 0 ? { text: `${stats.bloquant} bloquante(s)`, variant: 'error' } : undefined}
        actions={
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="glass-card-hover inline-flex items-center gap-2 px-4 py-2.5 text-[#1D1D1F] rounded-xl font-medium disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Actualiser
          </button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total MP" value={stats.total} icon={<Package className="w-5 h-5" />} color="default" />
        <StatCard title="Bloquantes" value={stats.bloquant} icon={<AlertOctagon className="w-5 h-5" />} color="red" />
        <StatCard title="Rupture" value={stats.rupture} icon={<XCircle className="w-5 h-5" />} color="amber" />
        <StatCard title="A commander" value={stats.aCommander} icon={<Clock className="w-5 h-5" />} color="blue" />
        <StatCard title="< 7 jours" value={stats.urgent} icon={<Timer className="w-5 h-5" />} color="purple" />
      </div>

      {/* Alerte critique */}
      {stats.bloquant > 0 && (
        <div
          className="glass-card rounded-2xl p-5 flex items-center justify-between"
          style={{ background: 'rgba(255, 235, 238, 0.6)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
              <AlertOctagon className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <p className="font-bold text-lg text-[#1D1D1F]">{stats.bloquant} MP BLOQUANTE(S)</p>
              <p className="text-rose-600">Production impossible - Action immédiate requise</p>
            </div>
          </div>
          <button
            onClick={() => setActiveFilter('bloquant')}
            className="px-5 py-2.5 bg-rose-100 text-rose-700 font-semibold rounded-full hover:bg-rose-200 transition-all"
          >
            Voir uniquement
          </button>
        </div>
      )}

      {/* Filtres */}
      <div className="glass-card p-5 space-y-4">
        {/* Filtres rapides */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => {
            const Icon = filter.icon;
            const count = filter.key === 'all' ? stats.total :
                          filter.key === 'bloquant' ? stats.bloquant :
                          filter.key === 'rupture' ? stats.rupture :
                          filter.key === 'a_commander' ? stats.aCommander :
                          filter.key === 'urgent' ? stats.urgent : 0;

            return (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                  activeFilter === filter.key
                    ? `${filter.color} text-white`
                    : 'bg-white/50 text-[#1D1D1F] hover:bg-white/80'
                )}
              >
                <Icon className="w-4 h-4" />
                {filter.label}
                {count > 0 && filter.key !== 'all' && (
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-xs',
                    activeFilter === filter.key ? 'bg-white/20' : 'bg-black/[0.04]'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Recherche et filtre fournisseur */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher MP..."
              className="w-full pl-10 pr-4 py-2 border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#007AFF]/15 focus:border-[#007AFF]/30 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#AEAEB2]" />
            <select
              value={selectedSupplier || ''}
              onChange={(e) => setSelectedSupplier(e.target.value ? Number(e.target.value) : null)}
              className="px-4 py-2 border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#007AFF]/15 focus:border-[#007AFF]/30 transition-all"
            >
              <option value="">Tous les fournisseurs</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} ({supplier.grade})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <ResponsiveTable<StockMpWithState>
        columns={stockColumns}
        data={filteredAndSortedMp}
        keyExtractor={(mp) => String(mp.id)}
        emptyMessage="Aucune MP correspondant aux filtres"
        sortableHeaders={['name', 'jours', 'criticite', 'state']}
        onHeaderClick={(key) => {
          const sortMap: Record<string, typeof sortBy> = { name: 'name', jours: 'jours', criticite: 'criticite', state: 'state' };
          if (sortMap[key]) handleSort(sortMap[key]);
        }}
        renderHeader={(col) => {
          const isSortable = ['name', 'jours', 'criticite', 'state'].includes(col.key);
          return (
            <div className={cn('flex items-center gap-1', col.key !== 'name' && col.key !== 'impact' && 'justify-center', col.key === 'actions' && 'justify-end')}>
              {col.header}
              {isSortable && <ArrowUpDown className="w-3 h-3" />}
            </div>
          );
        }}
        rowClassName={(mp) => cn(
          mp.state === 'BLOQUANT_PRODUCTION' && 'bg-red-100 border-l-4 border-l-red-600',
          mp.state === 'RUPTURE' && 'bg-red-50 border-l-4 border-l-red-400'
        )}
        cardClassName={(mp) => cn(
          mp.state === 'BLOQUANT_PRODUCTION' && 'border-l-4 border-l-red-600 bg-red-50/40',
          mp.state === 'RUPTURE' && 'border-l-4 border-l-red-400 bg-red-50/20'
        )}
        mobileCardTitle={(mp) => (
          <div>
            <p className="font-medium text-[#1D1D1F]">{mp.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[#86868B]">{mp.code}</span>
              {mp.supplierName && (
                <span className="text-xs text-[#AEAEB2] flex items-center gap-1">
                  <Truck className="w-3 h-3" />
                  {mp.supplierName}
                </span>
              )}
            </div>
          </div>
        )}
        mobileCardBadge={(mp) => <StateBadge state={mp.state} />}
        mobileCardFooter={(mp) => (
          <div className="flex justify-end">
            {mp.bcEnCours ? (
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-blue-600 font-medium">BC en cours</span>
                <Link
                  href={`/dashboard/appro/bons/${mp.bcEnCours.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200"
                >
                  Voir {mp.bcEnCours.reference}
                </Link>
              </div>
            ) : mp.state === 'BLOQUANT_PRODUCTION' || mp.state === 'RUPTURE' ? (
              <Link
                href={`/dashboard/appro/bons/new?mpId=${mp.id}&urgent=true`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 shadow-sm"
              >
                Créer BC URGENT
              </Link>
            ) : mp.state === 'A_COMMANDER' || mp.state === 'SOUS_SEUIL' ? (
              <Link
                href={`/dashboard/appro/bons/new?mpId=${mp.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600"
              >
                Créer BC
              </Link>
            ) : null}
          </div>
        )}
      />

      {/* Légende */}
      <div className="glass-card p-4">
        <p className="text-xs font-medium text-[#86868B] mb-2">LÉGENDE ÉTATS</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <StateBadge state="BLOQUANT_PRODUCTION" />
            <span className="text-xs text-[#6E6E73]">Rupture + utilisée en recette active</span>
          </div>
          <div className="flex items-center gap-2">
            <StateBadge state="RUPTURE" />
            <span className="text-xs text-[#6E6E73]">Stock = 0</span>
          </div>
          <div className="flex items-center gap-2">
            <StateBadge state="A_COMMANDER" />
            <span className="text-xs text-[#6E6E73]">Stock &lt; seuil commande</span>
          </div>
          <div className="flex items-center gap-2">
            <StateBadge state="SOUS_SEUIL" />
            <span className="text-xs text-[#6E6E73]">Stock &lt; seuil sécurité</span>
          </div>
        </div>
      </div>
    </div>
  );
}
