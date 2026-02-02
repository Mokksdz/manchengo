'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock, CheckCircle, Play, Package, Box, AlertTriangle,
  ChevronRight, Calendar, TrendingUp, Bell, Target, X, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ProductionCriticalBanner,
  SupplyRisksPanel,
  ProductionsAtRiskPanel,
  type SupplyRisksData,
  type ProductionsAtRiskData,
} from '@/components/production';

interface ProductionOrder {
  id: number;
  reference: string;
  productName: string;
  productCode: string;
  quantity: number;
  quantityProduced: number;
  batchCount: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  user: string;
}

interface DashboardKpis {
  today: { completed: number; inProgress: number; pending: number; totalProduced: number };
  week: { completed: number; totalProduced: number; avgYield: number; lowYieldCount: number };
  month: { completed: number; totalProduced: number };
  activeOrders: number;
  blockedOrders: number;
}

interface ProductionAlert {
  id: string;
  type: 'DLC_PROCHE' | 'RENDEMENT_FAIBLE' | 'ORDRE_BLOQUE' | 'STOCK_PF_BAS';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  link?: string;
}

interface AlertsData {
  total: number;
  critical: number;
  warning: number;
  alerts: ProductionAlert[];
}

interface StockPfItem {
  id: number;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  status: 'ok' | 'bas' | 'rupture';
  coverage: number;
}

interface CalendarDay {
  date: string;
  dayName: string;
  orders: ProductionOrder[];
  totalOrders: number;
  pending: number;
  inProgress: number;
  completed: number;
}

const statusConfig = {
  PENDING: { label: 'En attente', color: 'glass-status-pill glass-tint-orange', icon: Clock, bg: 'bg-[#FF9500]' },
  IN_PROGRESS: { label: 'En cours', color: 'glass-status-pill glass-tint-blue', icon: Play, bg: 'bg-[#007AFF]' },
  COMPLETED: { label: 'Terminé', color: 'glass-status-pill glass-tint-emerald', icon: CheckCircle, bg: 'bg-[#34C759]' },
  CANCELLED: { label: 'Annulé', color: 'glass-status-pill glass-tint-red', icon: Clock, bg: 'bg-[#FF3B30]' },
};

const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

interface ProductionDashboardTabProps {
  kpis: DashboardKpis | null;
  alertsData: AlertsData | null;
  stockPf: StockPfItem[];
  calendarData: CalendarDay[];
  orders: ProductionOrder[];
  supplyRisks: SupplyRisksData | null;
  isLoadingSupplyRisks: boolean;
  showSupplyRisksDetails: boolean;
  onToggleSupplyRisksDetails: (show: boolean) => void;
  productionsAtRisk: ProductionsAtRiskData | null;
  isLoadingAtRisk: boolean;
  lastSupplyAnalysis: Date | null;
  approManager: { id: number; name: string } | null;
  onNavigateToCalendar: () => void;
  onNavigateToOrders: () => void;
}

export function ProductionDashboardTab({
  kpis, alertsData, stockPf, calendarData, orders,
  supplyRisks, isLoadingSupplyRisks, showSupplyRisksDetails, onToggleSupplyRisksDetails,
  productionsAtRisk, isLoadingAtRisk, lastSupplyAnalysis, approManager,
  onNavigateToCalendar, onNavigateToOrders
}: ProductionDashboardTabProps) {
  const router = useRouter();

  return (
    <div className="p-6 space-y-6">
      <ProductionCriticalBanner
        data={supplyRisks}
        isLoading={isLoadingSupplyRisks}
        onShowDetails={() => onToggleSupplyRisksDetails(true)}
      />

      {showSupplyRisksDetails && supplyRisks && (
        <div className="relative animate-slide-up">
          <button onClick={() => onToggleSupplyRisksDetails(false)} className="absolute top-4 right-4 z-10 p-2 bg-white/60 backdrop-blur-xl rounded-full hover:bg-white/80 transition-all" aria-label="Fermer les détails">
            <X className="w-5 h-5 text-[#6E6E73]" />
          </button>
          <SupplyRisksPanel data={supplyRisks} isLoading={isLoadingSupplyRisks} />
        </div>
      )}

      <ProductionsAtRiskPanel
        data={productionsAtRisk}
        isLoading={isLoadingAtRisk}
        maxVisible={5}
        lastRefresh={lastSupplyAnalysis}
        approManagerName={approManager?.name}
        approManagerId={approManager?.id}
      />

      {kpis && (
        <div className="grid grid-cols-5 gap-4">
          {/* Today - dark hero card with purple accent */}
          <div className="bg-[#1D1D1F] rounded-[20px] p-5 text-white animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#AF52DE]/30 to-[#AF52DE]/10 rounded-xl flex items-center justify-center"><Target className="w-5 h-5" /></div>
              <span className="text-white/80 text-sm">Aujourd&apos;hui</span>
            </div>
            <p className="text-3xl font-bold">{kpis.today.completed}</p>
            <p className="text-white/70 text-sm">productions terminées</p>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="glass-pill bg-white/15 backdrop-blur-sm text-white/90">{kpis.today.inProgress} en cours</span>
              <span className="glass-pill bg-white/15 backdrop-blur-sm text-white/90">{kpis.today.pending} en attente</span>
            </div>
          </div>

          {/* Week */}
          <div className="glass-card p-5 animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#007AFF]/10 to-[#007AFF]/5 rounded-xl flex items-center justify-center"><TrendingUp className="w-5 h-5 text-[#007AFF]" /></div>
              <span className="text-[#86868B] text-sm">Cette semaine</span>
            </div>
            <p className="text-3xl font-bold text-[#1D1D1F]">{kpis.week.completed}</p>
            <p className="text-[#86868B] text-sm">{kpis.week.totalProduced} unités</p>
            <div className="mt-3 flex items-center gap-1 text-sm">
              <span className={cn('glass-status-pill', kpis.week.avgYield >= 95 ? 'glass-tint-emerald' : kpis.week.avgYield >= 85 ? 'glass-tint-orange' : 'glass-tint-red')}>
                Rendement {kpis.week.avgYield}%
              </span>
            </div>
          </div>

          {/* Month */}
          <div className="glass-card p-5 animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5 rounded-xl flex items-center justify-center"><CheckCircle className="w-5 h-5 text-[#34C759]" /></div>
              <span className="text-[#86868B] text-sm">Ce mois</span>
            </div>
            <p className="text-3xl font-bold text-[#1D1D1F]">{kpis.month.completed}</p>
            <p className="text-[#86868B] text-sm">{kpis.month.totalProduced} unités produites</p>
          </div>

          {/* Active */}
          <div className="glass-card p-5 animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 rounded-xl flex items-center justify-center"><Clock className="w-5 h-5 text-[#FF9500]" /></div>
              <span className="text-[#86868B] text-sm">Actifs</span>
            </div>
            <p className="text-3xl font-bold text-[#FF9500]">{kpis.activeOrders}</p>
            <p className="text-[#86868B] text-sm">ordres en attente/cours</p>
          </div>

          {/* Blocked */}
          <div className={cn('rounded-[20px] p-5 animate-slide-up', kpis.blockedOrders > 0 ? 'glass-decision-card glass-tint-red' : 'glass-card')}>
            <div className="flex items-center gap-3 mb-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', kpis.blockedOrders > 0 ? 'bg-gradient-to-br from-[#FF3B30]/15 to-[#FF3B30]/5' : 'bg-gradient-to-br from-black/[0.04] to-black/[0.02]')}>
                <AlertTriangle className={cn('w-5 h-5', kpis.blockedOrders > 0 ? 'text-[#FF3B30]' : 'text-[#AEAEB2]')} />
              </div>
              <span className="text-[#86868B] text-sm">Bloqués</span>
            </div>
            <p className={cn('text-3xl font-bold', kpis.blockedOrders > 0 ? 'text-[#FF3B30]' : 'text-[#AEAEB2]')}>{kpis.blockedOrders}</p>
            <p className="text-[#86868B] text-sm">en attente {'>'} 24h</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alertsData && alertsData.total > 0 && (
        <div className="glass-card overflow-hidden animate-slide-up">
          <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between">
            <h2 className="font-semibold text-[#1D1D1F] flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#FF9500]" />Alertes Production
              <span className="glass-pill bg-[#FF9500]/10 text-[#FF9500] text-xs">{alertsData.total}</span>
            </h2>
            <div className="flex items-center gap-2">
              {alertsData.critical > 0 && <span className="glass-status-pill glass-tint-red text-xs font-medium">{alertsData.critical} critiques</span>}
              {alertsData.warning > 0 && <span className="glass-status-pill glass-tint-orange text-xs font-medium">{alertsData.warning} avertissements</span>}
            </div>
          </div>
          <div className="divide-y divide-black/[0.04] max-h-80 overflow-y-auto">
            {alertsData.alerts.slice(0, 8).map((alert) => (
              <Link key={alert.id} href={alert.link || '#'} className="flex items-center gap-4 px-5 py-4 hover:bg-white/40 transition-colors">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', alert.severity === 'critical' ? 'bg-gradient-to-br from-[#FF3B30]/15 to-[#FF3B30]/5' : 'bg-gradient-to-br from-[#FF9500]/15 to-[#FF9500]/5')}>
                  {alert.type === 'DLC_PROCHE' && <Calendar className={cn('w-5 h-5', alert.severity === 'critical' ? 'text-[#FF3B30]' : 'text-[#FF9500]')} />}
                  {alert.type === 'RENDEMENT_FAIBLE' && <TrendingUp className={cn('w-5 h-5', alert.severity === 'critical' ? 'text-[#FF3B30]' : 'text-[#FF9500]')} />}
                  {alert.type === 'ORDRE_BLOQUE' && <Clock className={cn('w-5 h-5', alert.severity === 'critical' ? 'text-[#FF3B30]' : 'text-[#FF9500]')} />}
                  {alert.type === 'STOCK_PF_BAS' && <Package className={cn('w-5 h-5', alert.severity === 'critical' ? 'text-[#FF3B30]' : 'text-[#FF9500]')} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1D1D1F] truncate">{alert.title}</p>
                  <p className="text-sm text-[#86868B] truncate">{alert.description}</p>
                </div>
                <span className={cn('glass-status-pill text-xs font-medium', alert.severity === 'critical' ? 'glass-tint-red' : 'glass-tint-orange')}>
                  {alert.severity === 'critical' ? 'Critique' : 'Attention'}
                </span>
                <ChevronRight className="w-5 h-5 text-[#AEAEB2] flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Stock Produits Finis */}
        <div className="glass-card overflow-hidden animate-slide-up">
          <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between">
            <h2 className="font-semibold text-[#1D1D1F] flex items-center gap-2"><Box className="w-5 h-5 text-[#AF52DE]" />Stock Produits Finis</h2>
            <Link href="/dashboard/stock/pf" className="text-sm text-[#AF52DE] hover:text-[#AF52DE]/80 flex items-center gap-1 transition-colors">Voir tout <ExternalLink className="w-4 h-4" /></Link>
          </div>
          <div className="divide-y divide-black/[0.04] max-h-72 overflow-y-auto">
            {stockPf.slice(0, 6).map((pf) => (
              <div key={pf.id} className="flex items-center gap-4 px-5 py-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', pf.status === 'rupture' ? 'bg-gradient-to-br from-[#FF3B30]/15 to-[#FF3B30]/5' : pf.status === 'bas' ? 'bg-gradient-to-br from-[#FF9500]/15 to-[#FF9500]/5' : 'bg-gradient-to-br from-[#34C759]/15 to-[#34C759]/5')}>
                  <Package className={cn('w-5 h-5', pf.status === 'rupture' ? 'text-[#FF3B30]' : pf.status === 'bas' ? 'text-[#FF9500]' : 'text-[#34C759]')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1D1D1F] truncate">{pf.name}</p>
                  <p className="text-sm text-[#86868B]">{pf.code}</p>
                </div>
                <div className="text-right">
                  <p className={cn('font-bold', pf.status === 'rupture' ? 'text-[#FF3B30]' : pf.status === 'bas' ? 'text-[#FF9500]' : 'text-[#1D1D1F]')}>{pf.currentStock} {pf.unit}</p>
                  <div className="w-16 h-1.5 bg-black/[0.06] rounded-full mt-1">
                    <div className={cn('h-full rounded-full', pf.status === 'rupture' ? 'bg-[#FF3B30]' : pf.status === 'bas' ? 'bg-[#FF9500]' : 'bg-[#34C759]')} style={{ width: `${Math.min(100, pf.coverage)}%` }} />
                  </div>
                </div>
                <span className={cn('glass-status-pill text-xs font-medium', pf.status === 'rupture' ? 'glass-tint-red' : pf.status === 'bas' ? 'glass-tint-orange' : 'glass-tint-emerald')}>
                  {pf.status === 'rupture' ? 'Rupture' : pf.status === 'bas' ? 'Bas' : 'OK'}
                </span>
              </div>
            ))}
            {stockPf.length === 0 && <div className="p-8 text-center text-[#86868B]">Aucun produit fini</div>}
          </div>
        </div>

        {/* Planning 7 jours */}
        <div className="glass-card overflow-hidden animate-slide-up">
          <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between">
            <h2 className="font-semibold text-[#1D1D1F] flex items-center gap-2"><Calendar className="w-5 h-5 text-[#007AFF]" />Planning 7 jours</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-[#86868B]">
                <span className="w-2 h-2 rounded-full bg-[#34C759]" /> OK
                <span className="w-2 h-2 rounded-full bg-[#FF9500] ml-2" /> Risque
                <span className="w-2 h-2 rounded-full bg-[#FF3B30] ml-2" /> Bloqué
              </div>
              <button onClick={onNavigateToCalendar} className="text-sm text-[#AF52DE] hover:text-[#AF52DE]/80 flex items-center gap-1 ml-2 transition-colors">Détails <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {calendarData.slice(0, 7).map((day, i) => {
                const dayDate = new Date(day.date).toDateString();
                const dayRisks = productionsAtRisk?.productions.filter(p => new Date(p.plannedDate).toDateString() === dayDate) || [];
                const hasCritical = dayRisks.some(p => p.riskLevel === 'CRITICAL');
                const hasWarning = dayRisks.some(p => p.riskLevel === 'WARNING');
                const riskLevel = hasCritical ? 'CRITICAL' : hasWarning ? 'WARNING' : 'OK';
                const bgClass = riskLevel === 'CRITICAL'
                  ? 'glass-decision-card glass-tint-red border border-[#FF3B30]/20'
                  : riskLevel === 'WARNING'
                    ? 'glass-decision-card glass-tint-orange border border-[#FF9500]/20'
                    : i === 0
                      ? 'bg-[#AF52DE]/[0.06] border border-[#AF52DE]/15 backdrop-blur-sm'
                      : 'bg-white/40 backdrop-blur-sm';

                return (
                  <div key={day.date} className={cn('p-3 rounded-2xl text-center relative transition-all', bgClass)} title={riskLevel !== 'OK' ? `${dayRisks.length} production(s) a risque` : ''}>
                    {riskLevel !== 'OK' && (
                      <div className={cn('absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold', riskLevel === 'CRITICAL' ? 'bg-[#FF3B30]' : 'bg-[#FF9500]')}>{dayRisks.length}</div>
                    )}
                    <p className="text-xs text-[#86868B] uppercase">{day.dayName}</p>
                    <p className={cn('text-sm font-semibold mt-1', riskLevel === 'CRITICAL' ? 'text-[#FF3B30]' : riskLevel === 'WARNING' ? 'text-[#FF9500]' : '')}>{new Date(day.date).getDate()}</p>
                    <div className="mt-2 space-y-1">
                      {riskLevel === 'CRITICAL' && <div className="w-full h-1.5 bg-[#FF3B30] rounded-full" />}
                      {riskLevel === 'WARNING' && !hasCritical && <div className="w-full h-1.5 bg-[#FF9500] rounded-full" />}
                      {day.inProgress > 0 && <div className="w-full h-1.5 bg-[#007AFF]/60 rounded-full" />}
                      {day.pending > 0 && riskLevel === 'OK' && <div className="w-full h-1.5 bg-[#34C759]/60 rounded-full" />}
                      {day.completed > 0 && <div className="w-full h-1.5 bg-[#34C759]/60 rounded-full" />}
                    </div>
                    <p className="text-xs text-[#AEAEB2] mt-2">{day.totalOrders || '-'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="glass-card overflow-hidden animate-slide-up">
        <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between">
          <h2 className="font-semibold text-[#1D1D1F] flex items-center gap-2"><Clock className="w-5 h-5 text-[#86868B]" />Derniers ordres</h2>
          <button onClick={onNavigateToOrders} className="text-sm text-[#AF52DE] hover:text-[#AF52DE]/80 flex items-center gap-1 transition-colors">Voir tous <ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="divide-y divide-black/[0.04]">
          {orders.slice(0, 5).map((order) => {
            const status = statusConfig[order.status];
            const StatusIcon = status.icon;
            return (
              <div key={order.id} onClick={() => router.push(`/dashboard/production/order/${order.id}`)} className="flex items-center gap-4 px-5 py-4 hover:bg-white/40 cursor-pointer transition-colors">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', status.color)}><StatusIcon className="w-5 h-5" /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2"><span className="font-mono font-medium text-[#AF52DE]">{order.reference}</span><span className={cn('glass-status-pill text-xs font-medium', status.color)}>{status.label}</span></div>
                  <p className="text-sm text-[#86868B]">{order.productName} • {order.batchCount} batch</p>
                </div>
                <div className="text-right text-sm"><p className="font-medium">{order.quantityProduced}/{order.quantity}</p><p className="text-[#AEAEB2]">{formatDate(order.createdAt)}</p></div>
                <ChevronRight className="w-5 h-5 text-[#AEAEB2]" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
