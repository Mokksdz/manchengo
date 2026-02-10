'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { History, ArrowLeft, Package, ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton-loader';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface InvoiceLine {
  id: number;
  product: { code: string; name: string; unit: string };
  quantity: number;
  unitPriceHt: number;
  lineHt: number;
}

interface Invoice {
  id: number;
  reference: string;
  date: string;
  status: string;
  paymentMethod: string;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  netToPay: number;
  lines: InvoiceLine[];
}

interface HistoryData {
  client: { id: number; code: string; name: string; type: string };
  pagination: { page: number; limit: number; total: number; totalPages: number };
  totals: { invoices: number; totalQuantity: number; totalHt: number; totalTva: number; totalTtc: number; netToPay: number };
  invoices: Invoice[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const MONTHS = [
  { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' }, { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' }, { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' }, { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' }, { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

const typeConfig: Record<string, { label: string; color: string }> = {
  DISTRIBUTEUR: { label: 'Distributeur', color: 'bg-[#007AFF]/10 text-[#007AFF]' },
  GROSSISTE: { label: 'Grossiste', color: 'bg-[#AF52DE]/10 text-[#AF52DE]' },
  SUPERETTE: { label: 'Superette', color: 'bg-[#34C759]/10 text-[#34C759]' },
  FAST_FOOD: { label: 'Fast Food', color: 'bg-[#FF9500]/10 text-[#FF9500]' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADING STATE
// ═══════════════════════════════════════════════════════════════════════════════

function HistorySkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="w-12 h-12 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>

      {/* Filters skeleton */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Totals skeleton */}
      <div className="glass-card p-4">
        <div className="flex gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-32" />
          ))}
        </div>
      </div>

      {/* Invoice cards skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-black/[0.04]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-5 w-28" />
              </div>
            </div>
            <div className="p-4 space-y-2">
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT HISTORY PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ClientHistoriquePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<{
    year: number | undefined;
    month: number | undefined;
    from: string;
    to: string;
  }>({ year: currentYear, month: undefined, from: '', to: '' });
  const [page, setPage] = useState(1);

  const loadHistory = useCallback(async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (filters.year) searchParams.set('year', String(filters.year));
      if (filters.month) searchParams.set('month', String(filters.month));
      if (filters.from) searchParams.set('from', filters.from);
      if (filters.to) searchParams.set('to', filters.to);
      searchParams.set('page', String(page));
      searchParams.set('limit', '10');

      const res = await authFetch(`/admin/clients/${clientId}/history?${searchParams}`, { credentials: 'include' });
      if (res.ok) {
        setHistoryData(await res.json());
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, filters, page]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Initial loading state
  if (isLoading && !historyData) {
    return (
      <div className="space-y-6 animate-slide-up">
        {/* Back button */}
        <button
          onClick={() => router.push('/dashboard/clients')}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#86868B] hover:text-[#007AFF] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux clients
        </button>
        <HistorySkeleton />
      </div>
    );
  }

  const client = historyData?.client;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Back Button */}
      <button
        onClick={() => router.push('/dashboard/clients')}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#86868B] hover:text-[#007AFF] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux clients
      </button>

      {/* Page Header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#007AFF]/20 to-[#007AFF]/10 flex items-center justify-center shadow-lg shadow-[#007AFF]/10">
            <History className="w-6 h-6 text-[#007AFF]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-[#1D1D1F] tracking-tight">Historique Ventes</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[13px] text-[#86868B]">
                {client?.name} ({client?.code})
              </p>
              {client?.type && typeConfig[client.type] && (
                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold', typeConfig[client.type].color)}>
                  {typeConfig[client.type].label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 flex items-center justify-center">
            <Filter className="w-4 h-4 text-[#FF9500]" />
          </div>
          <h2 className="text-sm font-semibold text-[#1D1D1F]">Filtres</h2>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">Année</label>
            <select
              value={filters.year || ''}
              onChange={(e) => setFilters({ ...filters, year: e.target.value ? Number(e.target.value) : undefined, month: undefined })}
              className="px-3 py-2.5 border border-black/[0.04] rounded-xl text-sm bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
            >
              <option value="">Toutes</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">Mois</label>
            <select
              value={filters.month || ''}
              onChange={(e) => setFilters({ ...filters, month: e.target.value ? Number(e.target.value) : undefined })}
              disabled={!filters.year}
              className="px-3 py-2.5 border border-black/[0.04] rounded-xl text-sm bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] disabled:bg-black/5 disabled:text-[#86868B] transition-all"
            >
              <option value="">Tous</option>
              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="border-l border-black/[0.06] pl-4 flex items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6E6E73] mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Du
              </label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value, year: undefined, month: undefined })}
                className="px-3 py-2.5 border border-black/[0.04] rounded-xl text-sm bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6E6E73] mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Au
              </label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value, year: undefined, month: undefined })}
                className="px-3 py-2.5 border border-black/[0.04] rounded-xl text-sm bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
              />
            </div>
          </div>
          <button
            onClick={() => setFilters({ year: currentYear, month: undefined, from: '', to: '' })}
            className="px-4 py-2.5 text-sm font-medium text-[#86868B] hover:text-[#007AFF] rounded-xl hover:bg-[#007AFF]/10 transition-all"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Totals Summary */}
      {historyData?.totals && (
        <div className="glass-card p-4 bg-[#007AFF]/[0.03] border border-[#007AFF]/10 animate-fade-in">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[#6E6E73]">Factures:</span>
              <span className="font-semibold text-[#1D1D1F] bg-white/60 px-2 py-0.5 rounded-lg">{historyData.totals.invoices ?? 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#6E6E73]">Quantité:</span>
              <span className="font-semibold text-[#1D1D1F] bg-white/60 px-2 py-0.5 rounded-lg">{(historyData.totals.totalQuantity ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#6E6E73]">Total HT:</span>
              <span className="font-semibold text-[#1D1D1F] bg-white/60 px-2 py-0.5 rounded-lg">{formatPrice(historyData.totals.totalHt ?? 0)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#6E6E73]">TVA:</span>
              <span className="font-semibold text-[#1D1D1F] bg-white/60 px-2 py-0.5 rounded-lg">{formatPrice(historyData.totals.totalTva ?? 0)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#6E6E73]">Net à payer:</span>
              <span className="font-bold text-[#007AFF] bg-[#007AFF]/10 px-2.5 py-0.5 rounded-lg">{formatPrice(historyData.totals.netToPay ?? 0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Invoice List */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-[3px] border-[#007AFF]/20 border-t-[#007AFF] rounded-full animate-spin" />
          </div>
        ) : historyData?.invoices.length === 0 ? (
          <div className="glass-card p-16 text-center animate-fade-in">
            <Package className="w-14 h-14 mx-auto mb-4 text-[#86868B]/30" />
            <p className="text-[#86868B] font-medium text-lg">Aucune facture trouvée</p>
            <p className="text-[#AEAEB2] text-sm mt-1">Aucune facture pour cette période</p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {historyData?.invoices.map((invoice, index) => (
              <div
                key={invoice.id}
                className="glass-card overflow-hidden animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Invoice Header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-semibold text-[#007AFF]">{invoice.reference}</span>
                    <span className="text-sm text-[#6E6E73]">{formatDate(invoice.date)}</span>
                    <span className={cn(
                      'px-2.5 py-0.5 text-[11px] font-semibold rounded-full',
                      invoice.status === 'PAID' ? 'bg-[#34C759]/10 text-[#34C759]' :
                      invoice.status === 'DRAFT' ? 'bg-black/5 text-[#86868B]' :
                      invoice.status === 'CANCELLED' ? 'bg-[#FF3B30]/10 text-[#FF3B30]' :
                      'bg-[#FF9500]/10 text-[#FF9500]'
                    )}>
                      {invoice.status === 'PAID' ? 'Payée' : invoice.status === 'DRAFT' ? 'Brouillon' : invoice.status === 'CANCELLED' ? 'Annulée' : invoice.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#1D1D1F]">{formatPrice(invoice.netToPay)}</p>
                    <p className="text-[11px] text-[#86868B]">
                      {invoice.paymentMethod === 'ESPECES' ? 'Espèces' :
                       invoice.paymentMethod === 'CHEQUE' ? 'Chèque' :
                       invoice.paymentMethod === 'VIREMENT' ? 'Virement' : invoice.paymentMethod}
                    </p>
                  </div>
                </div>

                {/* Invoice Lines Table */}
                <table className="w-full text-sm">
                  <thead className="bg-white/30 backdrop-blur-sm">
                    <tr>
                      <th className="px-5 py-2 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Produit</th>
                      <th className="px-5 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Quantité</th>
                      <th className="px-5 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">P.U. HT</th>
                      <th className="px-5 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {invoice.lines.map((line) => (
                      <tr key={line.id} className="hover:bg-white/40 transition-colors">
                        <td className="px-5 py-2.5">
                          <span className="font-mono text-[11px] text-[#86868B] mr-2">{line.product.code}</span>
                          <span className="text-[#1D1D1F]">{line.product.name}</span>
                        </td>
                        <td className="px-5 py-2.5 text-right text-[#6E6E73]">
                          {line.quantity} {line.product.unit}
                        </td>
                        <td className="px-5 py-2.5 text-right text-[#6E6E73]">{formatPrice(line.unitPriceHt)}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-[#1D1D1F]">{formatPrice(line.lineHt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {historyData && historyData.pagination.totalPages > 1 && (
        <div className="glass-card px-5 py-3.5 flex items-center justify-between animate-fade-in">
          <span className="text-sm text-[#6E6E73]">
            Page {historyData.pagination.page} sur {historyData.pagination.totalPages}
            <span className="text-[#AEAEB2] ml-2">({historyData.pagination.total} résultats)</span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2.5 rounded-xl border border-black/[0.04] bg-white/60 hover:bg-white/80 disabled:opacity-40 transition-all"
              aria-label="Page précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(historyData.pagination.totalPages, p + 1))}
              disabled={page === historyData.pagination.totalPages}
              className="p-2.5 rounded-xl border border-black/[0.04] bg-white/60 hover:bg-white/80 disabled:opacity-40 transition-all"
              aria-label="Page suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
