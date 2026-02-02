'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminStockMp, useAdminSuppliers, queryKeys } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import {
  Droplets, Plus,
  Package, TrendingDown, Flame,
  Search, RefreshCw
} from 'lucide-react';
import {
  DecisionStatusPill,
  getDecisionStatus,
  StockVsThreshold,
  ImpactProductionCompact,
  PrimaryDecisionAction,
  type DecisionStatus,
  type UserRole,
  // Extracted modals for optimization
  ReceptionModal,
  InventoryModal,
  HistoryModal,
  type Supplier,
  type StockMpItem as StockMpItemType,
} from '@/components/stock';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// Types réutilisés depuis les composants extraits
type StockMpItem = StockMpItemType & {
  productId: number;
  totalStock?: number;
  currentStock: number;
  status: 'OK' | 'ALERTE' | 'RUPTURE';
  impactProduction?: number;
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

export default function StockMpPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Data fetching via React Query
  const { data: stockMpData, isLoading: isLoadingStock, refetch } = useAdminStockMp();
  const { data: suppliersData } = useAdminSuppliers();

  const stockMp: StockMpItem[] = useMemo(() => (stockMpData as StockMpItem[] | undefined) ?? [], [stockMpData]);
  const suppliers: Supplier[] = useMemo(() => (suppliersData as Supplier[] | undefined) ?? [], [suppliersData]);

  // Local UI state
  const [showReceptionModal, setShowReceptionModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockMpItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BLOCKING' | 'RUPTURE' | 'LOW' | 'OK'>('ALL');

  const canCreateSupplier = user?.role === 'ADMIN' || user?.role === 'APPRO';
  const canCreateReception = user?.role === 'ADMIN' || user?.role === 'APPRO';

  const isLoading = isLoadingStock;

  // Compute stats from data — status comes from backend
  const stats = useMemo(() => {
    const alerte = stockMp.filter((item: StockMpItem) => item.status === 'ALERTE').length;
    const rupture = stockMp.filter((item: StockMpItem) => item.status === 'RUPTURE').length;
    return { total: stockMp.length, alerte, rupture };
  }, [stockMp]);

  const handleReceptionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminStockMp });
    queryClient.invalidateQueries({ queryKey: queryKeys.adminSuppliers });
  };

  // Handle new supplier creation - invalidate suppliers cache
  const handleSupplierCreated = (_newSupplier: Supplier) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminSuppliers });
  };

  return (
    <div className="glass-bg space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">
            Matières Premières
          </h1>
          <p className="text-[13px] text-[#86868B] mt-1">
            Lait, sel, présure, ferments
            {stats.rupture > 0 && (
              <span className="ml-2 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-pulse" />
                <span className="text-[#FF3B30] font-medium">{stats.rupture} en rupture</span>
              </span>
            )}
            {stats.rupture === 0 && stats.alerte === 0 && (
              <span className="ml-2 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                <span className="text-[#34C759] font-medium">Stocks OK</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-full glass-card transition-all text-[#86868B] hover:text-[#1D1D1F]"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {canCreateReception && (
            <button
              onClick={() => setShowReceptionModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-[#333336] transition-all font-medium text-[13px] shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Réception MP
            </button>
          )}
        </div>
      </div>

      {/* Modal Réception */}
      <ReceptionModal
        isOpen={showReceptionModal}
        onClose={() => setShowReceptionModal(false)}
        onSuccess={handleReceptionSuccess}
        suppliers={suppliers}
        products={stockMp}
        onSupplierCreated={handleSupplierCreated}
        isAdmin={canCreateSupplier}
      />

      {/* Modal Inventaire (ADMIN) */}
      <InventoryModal
        isOpen={showInventoryModal}
        onClose={() => {
          setShowInventoryModal(false);
          setSelectedProduct(null);
        }}
        onSuccess={handleReceptionSuccess}
        product={selectedProduct}
      />

      {/* Modal Historique */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
      />

      {/* ─── KPI Strip ─── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#86868B] uppercase tracking-wide">Actions urgentes</p>
              <p className="text-[28px] font-bold text-[#1D1D1F] mt-1">{stats.rupture}</p>
            </div>
            <div className="flex items-center gap-2">
              {stats.rupture > 0 && <span className="w-2 h-2 rounded-full bg-[#FF3B30] animate-pulse" />}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#FF3B30]/10 to-[#FF6482]/10">
                <Flame className="w-5 h-5 text-[#FF3B30]" />
              </div>
            </div>
          </div>
          {stats.rupture > 0 && (
            <p className="text-[11px] text-[#FF3B30] font-medium mt-2">Production impactée</p>
          )}
        </div>

        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#86868B] uppercase tracking-wide">Sous seuil</p>
              <p className="text-[28px] font-bold text-[#1D1D1F] mt-1">{stats.alerte}</p>
            </div>
            <div className="flex items-center gap-2">
              {stats.alerte > 0 && <span className="w-2 h-2 rounded-full bg-[#FF9500]" />}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#FF9500]/10 to-[#FFCC00]/10">
                <TrendingDown className="w-5 h-5 text-[#FF9500]" />
              </div>
            </div>
          </div>
          {stats.alerte > 0 && (
            <p className="text-[11px] text-[#FF9500] font-medium mt-2">À anticiper</p>
          )}
        </div>

        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#86868B] uppercase tracking-wide">Total MP</p>
              <p className="text-[28px] font-bold text-[#1D1D1F] mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#007AFF]/10 to-[#5AC8FA]/10">
              <Package className="w-5 h-5 text-[#007AFF]" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Info Note ─── */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF] mt-2 flex-shrink-0" />
          <p className="text-[13px] text-[#86868B] leading-relaxed">
            Les matières premières <span className="text-[#1D1D1F] font-medium">sortent uniquement via Production</span> et
            entrent via les achats/réceptions fournisseurs.
          </p>
        </div>
      </div>

      {/* ─── Decision Table ─── */}
      {isLoading ? (
        <div className="glass-card flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-black/[0.06] border-t-[#1D1D1F] rounded-full animate-spin" />
            <p className="text-[12px] text-[#86868B]">Chargement...</p>
          </div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Filtre rapide */}
          <div className="px-5 py-3 border-b border-black/[0.04] flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7C7CC]" />
              <input
                type="text"
                placeholder="Rechercher une MP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[13px] border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/15 focus:border-[#007AFF] placeholder:text-[#C7C7CC] transition-all"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {(['ALL', 'BLOCKING', 'RUPTURE', 'LOW', 'OK'] as const).map((s) => {
                const labels: Record<string, string> = { ALL: 'Tous', BLOCKING: 'Bloquant', RUPTURE: 'Rupture', LOW: 'Sous seuil', OK: 'OK' };
                const count = s === 'ALL' ? stockMp.length : stockMp.filter(i => getDecisionStatus(i.currentStock, i.minStock, i.impactProduction ?? 0) === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-3 py-1.5 text-[12px] font-medium rounded-full transition-all',
                      statusFilter === s
                        ? 'bg-[#1D1D1F] text-white shadow-sm'
                        : 'bg-white/60 text-[#86868B] border border-black/[0.06] hover:bg-black/[0.03]'
                    )}
                  >
                    {labels[s]} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <table className="w-full">
            <thead className="border-b border-black/[0.04]">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider w-56">Statut</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Produit</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Stock vs Seuil</th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Impact</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {stockMp
                .filter((item) => {
                  const matchesSearch = !searchQuery ||
                    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.code.toLowerCase().includes(searchQuery.toLowerCase());
                  const stock = item.currentStock ?? item.totalStock ?? 0;
                  const status = getDecisionStatus(stock, item.minStock, item.impactProduction ?? 0);
                  const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
                  return matchesSearch && matchesStatus;
                })
                .map((item) => {
                  const stock = item.currentStock ?? item.totalStock ?? 0;
                  const impactProduction = item.impactProduction ?? 0;
                  const decisionStatus = getDecisionStatus(stock, item.minStock, impactProduction);
                  return { ...item, stock, impactProduction, decisionStatus };
                })
                // Tri par priorité: BLOCKING > RUPTURE > LOW > OK
                .sort((a, b) => {
                  const priority: Record<DecisionStatus, number> = { BLOCKING: 0, RUPTURE: 1, LOW: 2, OK: 3 };
                  return priority[a.decisionStatus] - priority[b.decisionStatus];
                })
                .map((item) => (
                  <tr key={item.productId || item.id} className="hover:bg-white/40 transition-colors">
                    {/* STATUT */}
                    <td className="px-5 py-4">
                      <DecisionStatusPill status={item.decisionStatus} />
                    </td>

                    {/* PRODUIT */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-black/[0.03] flex items-center justify-center">
                          <Droplets className="w-4 h-4 text-[#86868B]" />
                        </div>
                        <div>
                          <span className="font-semibold text-[14px] text-[#1D1D1F]">{item.name}</span>
                          <p className="text-[11px] text-[#86868B] font-mono">{item.code}</p>
                        </div>
                      </div>
                    </td>

                    {/* STOCK VS SEUIL */}
                    <td className="px-5 py-4 text-right">
                      <StockVsThreshold
                        currentStock={item.stock}
                        minStock={item.minStock}
                        unit={item.unit}
                      />
                    </td>

                    {/* IMPACT PRODUCTION */}
                    <td className="px-5 py-4 text-center">
                      <ImpactProductionCompact
                        recipeCount={item.impactProduction}
                        onClick={() => {
                          setSelectedProduct(item);
                          setShowHistoryModal(true);
                        }}
                      />
                    </td>

                    {/* ACTION PRINCIPALE */}
                    <td className="px-5 py-4 text-right">
                      <PrimaryDecisionAction
                        status={item.decisionStatus}
                        productId={item.productId || item.id || 0}
                        productName={item.name}
                        userRole={(user?.role as UserRole) || 'APPRO'}
                      />
                    </td>
                  </tr>
                ))}
              {stockMp.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-black/[0.03] rounded-full flex items-center justify-center mx-auto mb-3">
                      <Droplets className="w-6 h-6 text-[#C7C7CC]" />
                    </div>
                    <p className="font-medium text-[#86868B] text-[14px]">Aucune matière première trouvée</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
