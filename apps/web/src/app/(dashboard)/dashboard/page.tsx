'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useDashboardKpis, useSalesChart, useSyncStatus, useProductionDashboard } from '@/hooks/use-api';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import {
  Package,
  Factory,
  DollarSign,
  Smartphone,
  AlertTriangle,
  TrendingUp,
  ClipboardList,
  ShoppingCart,
  Beaker,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { Skeleton, SkeletonKpiGrid } from '@/components/ui/skeleton-loader';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import {
  cardClass,
  cardHeaderClass,
  iconBoxClass,
  iconBoxSmClass,
} from '@/lib/design-system';

export default function DashboardPage() {
  const { user } = useAuth();

  // RBAC: Définir les permissions par rôle
  const canSeeSales = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL';
  const canSeeSync = user?.role === 'ADMIN';
  const isProduction = user?.role === 'PRODUCTION';

  // React Query hooks — conditionally enabled based on role
  const { data: productionDashboard, isLoading: isLoadingProduction } = useProductionDashboard(!!isProduction);
  const { data: kpis, isLoading: isLoadingKpis } = useDashboardKpis(!isProduction);
  const { data: salesChart = [], isLoading: isLoadingSales } = useSalesChart(7, !!canSeeSales && !isProduction);
  const { data: syncStatus = [], isLoading: isLoadingSync } = useSyncStatus(!!canSeeSync && !isProduction);

  const isLoading = isProduction
    ? isLoadingProduction
    : isLoadingKpis || (canSeeSales && isLoadingSales) || (canSeeSync && isLoadingSync);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        {/* KPI cards skeleton */}
        <SkeletonKpiGrid count={4} />
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="glass-card p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD PRODUCTION (100% dédié)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isProduction && productionDashboard) {
    const pd = productionDashboard;
    return (
      <div className="space-y-6 animate-slide-up">
        {/* Header Production */}
        <PageHeader
          title="Dashboard Production"
          subtitle="Suivi de la production et approvisionnement"
          icon={<Factory className="w-6 h-6" />}
          actions={
            <Link href="/dashboard/demandes-mp" className="btn-amber">
              <ShoppingCart className="w-4 h-4" />
              Nouvelle demande MP
            </Link>
          }
        />

        {/* KPI Production */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div className={`${cardClass} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-[#86868B]">Ordres aujourd&apos;hui</p>
                <p className="text-[28px] font-semibold text-[#1D1D1F] mt-1">{pd.production.ordersToday}</p>
              </div>
              <div className={iconBoxClass}>
                <ClipboardList className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className={`${cardClass} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-[#86868B]">En attente</p>
                <p className="text-[28px] font-semibold text-[#F57F17] mt-1">{pd.production.ordersPending}</p>
              </div>
              <div className={iconBoxClass}>
                <Loader2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className={`${cardClass} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-[#86868B]">En cours</p>
                <p className="text-[28px] font-semibold text-[#1565C0] mt-1">{pd.production.ordersInProgress}</p>
              </div>
              <div className={iconBoxClass}>
                <Factory className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className={`${cardClass} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-[#86868B]">Terminés (7j)</p>
                <p className="text-[28px] font-semibold text-[#2E7D32] mt-1">{pd.production.ordersCompleted}</p>
              </div>
              <div className={iconBoxClass}>
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Production + Approvisionnement */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stats Production */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className={`${cardHeaderClass} flex items-center gap-3`}>
              <div className={iconBoxSmClass}>
                <Beaker className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-[#1D1D1F]">Production (7 jours)</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-[#FAFAFA] rounded-[12px]">
                  <p className="text-[28px] font-semibold text-[#1D1D1F]">{pd.production.quantiteProduite}</p>
                  <p className="text-[13px] text-[#86868B]">Quantité produite</p>
                </div>
                <div className="text-center p-4 bg-[#E8F5E9] rounded-[12px]">
                  <p className="text-[28px] font-semibold text-[#2E7D32]">{pd.production.rendementMoyen}%</p>
                  <p className="text-[13px] text-[#86868B]">Rendement moyen</p>
                </div>
              </div>
            </div>
          </div>

          {/* Approvisionnement */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className={`${cardHeaderClass} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={iconBoxSmClass}>
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-[#1D1D1F]">Approvisionnement MP</h3>
              </div>
              <Link href="/dashboard/demandes-mp" className="text-sm text-[#EC7620] hover:text-[#DD5C16] font-medium">
                Voir demandes →
              </Link>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-[#FFF8E1] rounded-[12px]">
                  <p className="text-[22px] font-semibold text-[#F57F17]">{pd.approvisionnement.mpSousSeuil}</p>
                  <p className="text-[11px] text-[#86868B]">MP sous seuil</p>
                </div>
                <div className="text-center p-3 bg-[#FFEBEE] rounded-[12px]">
                  <p className="text-[22px] font-semibold text-[#C62828]">{pd.approvisionnement.mpCritiques}</p>
                  <p className="text-[11px] text-[#86868B]">MP critiques</p>
                </div>
                <div className="text-center p-3 bg-[#E3F2FD] rounded-[12px]">
                  <p className="text-[22px] font-semibold text-[#1565C0]">{pd.approvisionnement.demandesEnvoyees}</p>
                  <p className="text-[11px] text-[#86868B]">Demandes envoyées</p>
                </div>
                <div className="text-center p-3 bg-[#FAFAFA] rounded-[12px]">
                  <p className="text-[22px] font-semibold text-[#6E6E73]">{pd.approvisionnement.demandesEnAttente}</p>
                  <p className="text-[11px] text-[#86868B]">Brouillons</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alertes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alertes MP */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className={`${cardHeaderClass} flex items-center gap-3`}>
              <div className="w-9 h-9 rounded-[10px] bg-[#FFF8E1] flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-[#F57F17]" />
              </div>
              <h3 className="font-semibold text-[#1D1D1F]">Alertes Stock MP</h3>
            </div>
            <div className="p-6">
              {pd.alertes.mpAlertList.length > 0 ? (
                <div className="space-y-2">
                  {pd.alertes.mpAlertList.map((alert, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-[12px] ${
                        alert.status === 'RUPTURE' ? 'bg-[#FFEBEE]' : 'bg-[#FFF8E1]'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-[#1D1D1F]">{alert.name}</p>
                        <p className="text-[11px] text-[#86868B]">{alert.code}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${alert.status === 'RUPTURE' ? 'text-[#C62828]' : 'text-[#F57F17]'}`}>
                          {alert.stock} / {alert.minStock}
                        </p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          alert.status === 'RUPTURE' ? 'bg-[#FFCDD2] text-[#C62828]' : 'bg-[#FFE082] text-[#F57F17]'
                        }`}>
                          {alert.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<CheckCircle className="w-12 h-12" />}
                  title="Aucune alerte stock"
                  className="py-6"
                />
              )}
            </div>
          </div>

          {/* Recettes */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className={`${cardHeaderClass} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={iconBoxSmClass}>
                  <Beaker className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-[#1D1D1F]">Recettes</h3>
              </div>
              <Link href="/dashboard/production/recettes" className="text-sm text-[#EC7620] hover:text-[#DD5C16] font-medium">
                Gérer →
              </Link>
            </div>
            <div className="p-6">
              {pd.alertes.recettesNonConfigurees > 0 ? (
                <div className="bg-[#FFF8E1] border border-[#FFE082] rounded-[12px] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#FFE082]/50 rounded-[10px] flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-[#F57F17]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1D1D1F]">
                        {pd.alertes.recettesNonConfigurees} produit(s) sans recette
                      </p>
                      <p className="text-sm text-[#6E6E73]">
                        Configurez les recettes pour lancer la production
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#E8F5E9] border border-[#A5D6A7] rounded-[12px] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#A5D6A7]/50 rounded-[10px] flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-[#2E7D32]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1D1D1F]">Recettes configurées</p>
                      <p className="text-sm text-[#6E6E73]">Production prête</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD STANDARD (ADMIN, COMMERCIAL, APPRO)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Vue d'ensemble de l'activité"
        icon={<TrendingUp className="w-6 h-6" />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {/* Stock MP */}
        <div className={`${cardClass} p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-[#86868B]">Stock MP</p>
              <p className="text-[28px] font-semibold text-[#1D1D1F] mt-1">
                {(kpis?.stock.mp.total ?? 0).toLocaleString()}
              </p>
              {(kpis?.stock.mp.lowStock || 0) > 0 && (
                <p className="text-sm text-[#F57F17] mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {kpis?.stock.mp.lowStock} en rupture
                </p>
              )}
            </div>
            <div className={iconBoxClass}>
              <Package className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Stock PF */}
        <div className={`${cardClass} p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-[#86868B]">Stock PF</p>
              <p className="text-[28px] font-semibold text-[#1D1D1F] mt-1">
                {(kpis?.stock.pf.total ?? 0).toLocaleString()}
              </p>
              {(kpis?.stock.pf.lowStock || 0) > 0 && (
                <p className="text-sm text-[#F57F17] mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {kpis?.stock.pf.lowStock} en rupture
                </p>
              )}
            </div>
            <div className={iconBoxClass}>
              <Factory className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Ventes du jour */}
        {canSeeSales && (
          <div className={`${cardClass} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-[#86868B]">Ventes du jour</p>
                <p className="text-[28px] font-semibold text-[#1D1D1F] mt-1">
                  {formatCurrency(kpis?.sales.todayAmount || 0)}
                </p>
                <p className="text-[13px] text-[#AEAEB2] mt-1">
                  {kpis?.sales.todayInvoices || 0} factures
                </p>
              </div>
              <div className={iconBoxClass}>
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

        {/* Sync Status */}
        {canSeeSync && (
          <div className={`${cardClass} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-[#86868B]">Synchronisation</p>
                <p className="text-[28px] font-semibold text-[#1D1D1F] mt-1">
                  {kpis?.sync.pendingEvents || 0}
                </p>
                <p className="text-[13px] text-[#AEAEB2] mt-1">
                  événements en attente
                </p>
                {(kpis?.sync.devicesOffline || 0) > 0 && (
                  <p className="text-sm text-[#C62828] mt-1 flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5" />
                    {kpis?.sync.devicesOffline} hors ligne
                  </p>
                )}
              </div>
              <div className={iconBoxClass}>
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        {canSeeSales && (
          <div className={`${cardClass} overflow-hidden`}>
            <div className={cardHeaderClass}>
              <h3 className="font-semibold text-[#1D1D1F]">Ventes (7 derniers jours)</h3>
            </div>
            <div className="p-6">
              <div className="h-64 flex items-end gap-2">
                {salesChart.map((day, i) => {
                  const maxAmount = Math.max(...salesChart.map((d) => d.amount), 1);
                  const height = (day.amount / maxAmount) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-[#EC7620] rounded-t-lg"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-[11px] text-[#86868B] mt-2 font-medium">
                        {new Date(day.date).toLocaleDateString('fr', {
                          weekday: 'short',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Device Sync Status */}
        {canSeeSync && (
          <div className={`${cardClass} overflow-hidden`}>
            <div className={cardHeaderClass}>
              <h3 className="font-semibold text-[#1D1D1F]">État des appareils</h3>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {syncStatus.slice(0, 5).map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 rounded-[12px] hover:bg-[#FAFAFA] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          device.isActive && device.lastSyncAt
                            ? 'bg-[#2E7D32]'
                            : 'bg-[#D1D1D6]'
                        }`}
                      />
                      <div>
                        <p className="font-medium text-sm text-[#1D1D1F]">{device.name}</p>
                        <p className="text-[11px] text-[#86868B]">
                          {device.user.firstName} {device.user.lastName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[#86868B]">
                        {device.lastSyncAt
                          ? formatRelativeTime(device.lastSyncAt)
                          : 'Jamais'}
                      </p>
                    </div>
                  </div>
                ))}
                {syncStatus.length === 0 && (
                  <EmptyState
                    icon={<Smartphone className="w-12 h-12" />}
                    title="Aucun appareil enregistré"
                    className="py-6"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
