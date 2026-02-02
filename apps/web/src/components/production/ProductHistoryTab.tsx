'use client';

import { Factory, Clock, CheckCircle, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionOrder {
  id: number;
  reference: string;
  batchCount: number;
  targetQuantity: number;
  quantityProduced: number;
  status: string;
  yieldPercentage: number | null;
  completedAt: string | null;
  user: { firstName: string; lastName: string };
  lots: { id: number; lotNumber: string; quantityInitial: number }[];
}

interface HistoryData {
  pagination: { page: number; limit: number; total: number; totalPages: number };
  totals: { completedOrders: number; totalProduced: number; avgYield: number };
  orders: ProductionOrder[];
}

interface HistoryFilters {
  year: number | undefined;
  month: number | undefined;
}

const MONTHS = [
  { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' }, { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' }, { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' }, { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' }, { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' },
];

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'En attente', color: 'bg-gradient-to-br from-[#FF9500]/15 to-[#FF9500]/5 text-[#FF9500]', icon: Clock },
  IN_PROGRESS: { label: 'En cours', color: 'bg-gradient-to-br from-[#007AFF]/15 to-[#007AFF]/5 text-[#007AFF]', icon: Play },
  COMPLETED: { label: 'Terminé', color: 'bg-gradient-to-br from-[#34C759]/15 to-[#34C759]/5 text-[#34C759]', icon: CheckCircle },
  CANCELLED: { label: 'Annulé', color: 'bg-gradient-to-br from-[#FF3B30]/15 to-[#FF3B30]/5 text-[#FF3B30]', icon: Clock },
};

const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

interface ProductHistoryTabProps {
  productUnit: string;
  historyData: HistoryData | null;
  historyLoading: boolean;
  filters: HistoryFilters;
  onFiltersChange: (filters: HistoryFilters) => void;
  historyPage: number;
  onPageChange: (page: number) => void;
}

export function ProductHistoryTab({
  productUnit, historyData, historyLoading, filters, onFiltersChange, historyPage, onPageChange
}: ProductHistoryTabProps) {
  return (
    <div className="glass-card overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b border-black/[0.04] bg-black/[0.03]">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] mb-1">Année</label>
            <select
              value={filters.year || ''}
              onChange={(e) => onFiltersChange({ ...filters, year: e.target.value ? Number(e.target.value) : undefined, month: undefined })}
              className="px-3 py-2 border border-black/[0.06] rounded-xl text-sm bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#AF52DE]/30"
            >
              <option value="">Toutes</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] mb-1">Mois</label>
            <select
              value={filters.month || ''}
              onChange={(e) => onFiltersChange({ ...filters, month: e.target.value ? Number(e.target.value) : undefined })}
              disabled={!filters.year}
              className="px-3 py-2 border border-black/[0.06] rounded-xl text-sm bg-white/60 backdrop-blur-sm disabled:bg-black/[0.03] focus:outline-none focus:ring-2 focus:ring-[#AF52DE]/30"
            >
              <option value="">Tous</option>
              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Totals */}
      {historyData && (
        <div className="px-6 py-3 bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 border-b border-[#AF52DE]/10">
          <div className="flex items-center gap-8 text-sm">
            <div>
              <span className="text-[#6E6E73]">Productions:</span>{' '}
              <span className="font-semibold text-[#1D1D1F]">{historyData.totals.completedOrders}</span>
            </div>
            <div>
              <span className="text-[#6E6E73]">Quantité produite:</span>{' '}
              <span className="font-semibold text-[#1D1D1F]">{historyData.totals.totalProduced} {productUnit}</span>
            </div>
            <div>
              <span className="text-[#6E6E73]">Rendement moyen:</span>{' '}
              <span className="font-semibold text-[#AF52DE]">{historyData.totals.avgYield.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {historyLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#AF52DE]" />
          </div>
        ) : historyData?.orders.length === 0 ? (
          <div className="text-center py-12 text-[#86868B]">
            <Factory className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune production trouvée pour cette période</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historyData?.orders.map((order) => {
              const status = statusConfig[order.status] || statusConfig.PENDING;
              const StatusIcon = status.icon;
              return (
                <div key={order.id} className="border border-black/[0.04] rounded-[14px] p-4 hover:bg-white/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-medium text-[#AF52DE]">{order.reference}</span>
                      <span className={cn('glass-status-pill px-2.5 py-1 text-xs rounded-full flex items-center gap-1', status.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{order.quantityProduced} / {order.targetQuantity} {productUnit}</p>
                      {order.yieldPercentage && (
                        <p className="text-sm text-[#86868B]">Rendement: {order.yieldPercentage.toFixed(1)}%</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm text-[#86868B]">
                    <span>{order.batchCount} batch(s)</span>
                    <span>•</span>
                    <span>{order.user.firstName} {order.user.lastName}</span>
                    {order.completedAt && (
                      <>
                        <span>•</span>
                        <span>{formatDate(order.completedAt)}</span>
                      </>
                    )}
                  </div>
                  {order.lots.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {order.lots.map((lot) => (
                        <span key={lot.id} className="glass-pill px-2 py-1 bg-black/[0.03] rounded-full text-xs font-mono">
                          {lot.lotNumber}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {historyData && historyData.pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-[#86868B]">
              Page {historyData.pagination.page} sur {historyData.pagination.totalPages}
              {' '}({historyData.pagination.total} résultats)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(historyPage - 1)}
                disabled={historyPage <= 1}
                className="px-3 py-1 border border-black/[0.06] rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange(historyPage + 1)}
                disabled={historyPage >= historyData.pagination.totalPages}
                className="px-3 py-1 border border-black/[0.06] rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
