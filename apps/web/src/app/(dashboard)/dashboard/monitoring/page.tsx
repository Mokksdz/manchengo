'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/api';
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Smartphone,
  Package,
  DollarSign,
  Shield,
  Clock,
  TrendingUp,
  Bell,
  Eye,
  X,
} from 'lucide-react';
import { useRequireRole } from '@/lib/hooks/use-require-role';
import { Skeleton } from '@/components/ui/skeleton-loader';

/**
 * Monitoring Dashboard Page
 *
 * Admin-only page for system monitoring:
 * - Real-time KPIs (sync, stock, fiscal, security)
 * - Active alerts with status management
 * - Alert acknowledgment and closure
 */

interface Kpis {
  sync: {
    totalDevices: number;
    activeDevices: number;
    offlineDevices: number;
    syncEventsToday: number;
    pendingEvents: number;
    recentSyncFailures: number;
    syncHealthPercent: number;
  };
  stock: {
    totalMpProducts: number;
    totalPfProducts: number;
    totalMpQuantity: number;
    totalPfQuantity: number;
    lowStockMp: number;
    lowStockPf: number;
    expiringLots: number;
    stockHealthPercent: number;
  };
  fiscal: {
    todayInvoiceCount: number;
    todaySalesHt: number;
    todaySalesTtc: number;
    todayTva: number;
    todayTimbre: number;
    todayCashSales: number;
    cashPercent: number;
    monthInvoiceCount: number;
    monthSalesHt: number;
    monthTva: number;
    cashWithoutStamp: number;
  };
  security: {
    activeUsers: number;
    blockedUsers: number;
    revokedDevices: number;
    accessDeniedToday: number;
    failedLoginsToday: number;
    successfulLoginsToday: number;
    accessDeniedLastHour: number;
    failedLoginsLastHour: number;
    securityHealthPercent: number;
  };
  generatedAt: string;
}

interface Alert {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED';
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  threshold: number | null;
  value: number | null;
  createdAt: string;
  ackedAt: string | null;
  closedAt: string | null;
}

const severityColors = {
  INFO: 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/20',
  WARNING: 'bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/20',
  CRITICAL: 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20',
};

const severityIcons = {
  INFO: AlertCircle,
  WARNING: AlertTriangle,
  CRITICAL: XCircle,
};

const statusColors = {
  OPEN: 'bg-[#FF3B30]',
  ACKNOWLEDGED: 'bg-[#FF9500]',
  CLOSED: 'bg-[#34C759]',
};

export default function MonitoringPage() {
  const { hasAccess, isAccessDenied } = useRequireRole(['ADMIN']);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // A28: useCallback to stabilize fetchData reference for interval
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisRes, alertsRes] = await Promise.all([
        authFetch('/monitoring/kpis', { credentials: 'include' }),
        authFetch(`/monitoring/alerts?status=${statusFilter}`, { credentials: 'include' }),
      ]);

      if (!kpisRes.ok || !alertsRes.ok) {
        throw new Error('Failed to fetch monitoring data');
      }

      const kpisData = await kpisRes.json();
      const alertsData = await alertsRes.json();

      setKpis(kpisData);
      setAlerts(alertsData.alerts || []);
      setOpenCount(alertsData.openCount || 0);
      setCriticalCount(alertsData.criticalCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAcknowledge = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await authFetch(`/monitoring/alerts/${alertId}/ack`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({}),
      });
      await fetchData();
    } catch {
      setError('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await authFetch(`/monitoring/alerts/${alertId}/close`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({}),
      });
      await fetchData();
    } catch {
      setError('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // A30: Show access denied message instead of infinite spinner
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        {isAccessDenied ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-[#FF3B30]" />
            </div>
            <p className="text-lg font-semibold text-[#1D1D1F]">Accès interdit</p>
            <p className="text-sm text-[#86868B] mt-1">Redirection vers le dashboard...</p>
          </div>
        ) : (
          <div className="w-8 h-8 loading-spinner" />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF3B30]/20 to-[#FF3B30]/10 flex items-center justify-center shadow-lg shadow-[#FF3B30]/10">
              <Activity className="w-6 h-6 text-[#FF3B30]" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-[#1D1D1F] tracking-tight">Monitoring</h1>
              <p className="text-[13px] text-[#86868B]">{kpis ? `Dernière mise à jour: ${formatDate(kpis.generatedAt)}` : 'Chargement...'}</p>
            </div>
            {criticalCount > 0 && (
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#FF3B30]/10 text-[#FF3B30] animate-pulse">
                {criticalCount} critique{criticalCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF3B30] text-white text-sm font-semibold rounded-full hover:bg-[#D62D22] shadow-lg shadow-[#FF3B30]/25 transition-all active:scale-[0.97] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-2xl text-sm font-medium text-[#FF3B30]">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Sync KPIs */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#007AFF]/10 to-[#007AFF]/5 rounded-xl flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-[#007AFF]" />
                </div>
                <span className="font-semibold text-[#1D1D1F]">Sync</span>
              </div>
              <div className={`text-xl font-bold ${
                kpis.sync.syncHealthPercent >= 80 ? 'text-[#34C759]' :
                kpis.sync.syncHealthPercent >= 50 ? 'text-[#FF9500]' : 'text-[#FF3B30]'
              }`}>
                {kpis.sync.syncHealthPercent}%
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-[#86868B]">Appareils actifs</span><span className="font-medium text-[#1D1D1F]">{kpis.sync.activeDevices}/{kpis.sync.totalDevices}</span></div>
              <div className="flex justify-between"><span className="text-[#86868B]">Hors ligne</span><span className={`font-medium ${kpis.sync.offlineDevices > 0 ? 'text-[#FF9500]' : 'text-[#1D1D1F]'}`}>{kpis.sync.offlineDevices}</span></div>
              <div className="flex justify-between"><span className="text-[#86868B]">En attente</span><span className={`font-medium ${kpis.sync.pendingEvents > 50 ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>{kpis.sync.pendingEvents}</span></div>
            </div>
          </div>

          {/* Stock KPIs */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5 rounded-xl flex items-center justify-center">
                  <Package className="h-5 w-5 text-[#34C759]" />
                </div>
                <span className="font-semibold text-[#1D1D1F]">Stock</span>
              </div>
              <div className={`text-xl font-bold ${
                kpis.stock.stockHealthPercent >= 80 ? 'text-[#34C759]' :
                kpis.stock.stockHealthPercent >= 50 ? 'text-[#FF9500]' : 'text-[#FF3B30]'
              }`}>
                {kpis.stock.stockHealthPercent}%
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-[#86868B]">Stock MP bas</span><span className={`font-medium ${kpis.stock.lowStockMp > 0 ? 'text-[#FF9500]' : 'text-[#1D1D1F]'}`}>{kpis.stock.lowStockMp}</span></div>
              <div className="flex justify-between"><span className="text-[#86868B]">Stock PF bas</span><span className={`font-medium ${kpis.stock.lowStockPf > 0 ? 'text-[#FF9500]' : 'text-[#1D1D1F]'}`}>{kpis.stock.lowStockPf}</span></div>
              <div className="flex justify-between"><span className="text-[#86868B]">Lots expirant</span><span className={`font-medium ${kpis.stock.expiringLots > 0 ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>{kpis.stock.expiringLots}</span></div>
            </div>
          </div>

          {/* Fiscal KPIs */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 rounded-xl flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-[#AF52DE]" />
                </div>
                <span className="font-semibold text-[#1D1D1F]">Fiscal</span>
              </div>
              <div className="text-xl font-bold text-[#AF52DE]">{kpis.fiscal.todayInvoiceCount} fact.</div>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-[#86868B]">CA Aujourd&apos;hui</span><span className="font-medium text-[#1D1D1F]">{formatAmount(kpis.fiscal.todaySalesTtc)}</span></div>
              <div className="flex justify-between"><span className="text-[#86868B]">Espèces</span><span className={`font-medium ${kpis.fiscal.cashPercent > 80 ? 'text-[#FF9500]' : 'text-[#1D1D1F]'}`}>{kpis.fiscal.cashPercent}%</span></div>
              <div className="flex justify-between"><span className="text-[#86868B]">Sans timbre</span><span className={`font-medium ${kpis.fiscal.cashWithoutStamp > 0 ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>{kpis.fiscal.cashWithoutStamp}</span></div>
            </div>
          </div>

          {/* Security KPIs */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5 rounded-xl flex items-center justify-center">
                  <Shield className="h-5 w-5 text-[#FF3B30]" />
                </div>
                <span className="font-semibold text-[#1D1D1F]">Sécurité</span>
              </div>
              <div className={`text-xl font-bold ${kpis.security.securityHealthPercent >= 80 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                {kpis.security.securityHealthPercent}%
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-[#86868B]">Utilisateurs actifs</span><span className="font-medium text-[#1D1D1F]">{kpis.security.activeUsers}</span></div>
              <div className="flex justify-between"><span className="text-[#86868B]">Accès refusés (1h)</span><span className={`font-medium ${kpis.security.accessDeniedLastHour > 5 ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>{kpis.security.accessDeniedLastHour}</span></div>
              <div className="flex justify-between"><span className="text-[#86868B]">Échecs login (1h)</span><span className={`font-medium ${kpis.security.failedLoginsLastHour > 10 ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>{kpis.security.failedLoginsLastHour}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Section */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 flex items-center justify-center">
              <Bell className="w-4 h-4 text-[#FF9500]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1D1D1F]">Alertes</h3>
              <p className="text-[11px] text-[#86868B]">{openCount > 0 ? `${openCount} ouvertes` : 'Aucune alerte ouverte'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 bg-black/5 rounded-full">
            {(['OPEN', 'ACKNOWLEDGED', 'CLOSED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                  statusFilter === status
                    ? 'bg-white text-[#1D1D1F] shadow-sm'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                {status === 'OPEN' ? 'Ouvertes' : status === 'ACKNOWLEDGED' ? 'Vues' : 'Fermées'}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-black/[0.04]">
          {loading && alerts.length === 0 ? (
            <div className="px-6 py-4 space-y-4 animate-fade-in">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-full mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="px-6 py-8 text-center text-[#86868B] flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-[#34C759]/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-[#34C759]" />
              </div>
              Aucune alerte
            </div>
          ) : (
            alerts.map((alert) => {
              const SeverityIcon = severityIcons[alert.severity];
              return (
                <div
                  key={alert.id}
                  className={`px-6 py-4 flex items-start gap-4 ${
                    alert.severity === 'CRITICAL' && alert.status === 'OPEN' ? 'bg-[#FF3B30]/5' : ''
                  }`}
                >
                  {/* Severity Icon */}
                  <div className={`p-2 rounded-xl border ${severityColors[alert.severity]}`}>
                    <SeverityIcon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusColors[alert.status]}`} />
                      <h3 className="font-medium text-[#1D1D1F]">{alert.title}</h3>
                    </div>
                    <p className="text-sm text-[#6E6E73] mt-1">{alert.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[#86868B]">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(alert.createdAt)}
                      </span>
                      {alert.threshold && alert.value && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {alert.value} / {alert.threshold}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {alert.status !== 'CLOSED' && (
                    <div className="flex gap-2">
                      {alert.status === 'OPEN' && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={actionLoading === alert.id}
                          className="p-2 rounded-xl text-[#007AFF] hover:bg-[#007AFF]/10 transition-all disabled:opacity-50"
                          title="Marquer comme vu"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleClose(alert.id)}
                        disabled={actionLoading === alert.id}
                        className="p-2 rounded-xl text-[#86868B] hover:bg-black/5 transition-all disabled:opacity-50"
                        title="Fermer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
