'use client';

import { useEffect, useState, useCallback } from 'react';
import { History, X, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api';
import { createLogger } from '@/lib/logger';

const log = createLogger('ClientHistoryModal');

interface Client {
  id: number;
  code: string;
  name: string;
}

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

const formatPrice = (cents: number) => new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 2 }).format(cents / 100);
const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const MONTHS = [
  { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' }, { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' }, { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' }, { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' }, { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

interface ClientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
}

export function ClientHistoryModal({ isOpen, onClose, client }: ClientHistoryModalProps) {
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<{
    year: number | undefined;
    month: number | undefined;
    from: string;
    to: string;
  }>({ year: currentYear, month: undefined, from: '', to: '' });
  const [page, setPage] = useState(1);

  const loadHistory = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.set('year', String(filters.year));
      if (filters.month) params.set('month', String(filters.month));
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      params.set('page', String(page));
      params.set('limit', '10');

      const res = await authFetch(`/admin/clients/${client.id}/history?${params}`, { credentials: 'include' });
      if (res.ok) setHistoryData(await res.json());
    } catch (error) {
      log.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [client, filters, page]);

  useEffect(() => {
    if (isOpen && client) loadHistory();
  }, [isOpen, client, loadHistory]);

  useEffect(() => { setPage(1); }, [filters]);

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="client-history-modal-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/20 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04] bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007AFF]/20 to-[#007AFF]/10 flex items-center justify-center">
              <History className="w-5 h-5 text-[#007AFF]" />
            </div>
            <div>
              <h2 id="client-history-modal-title" className="text-lg font-semibold text-[#1D1D1F]">Historique Ventes</h2>
              <p className="text-sm text-[#6E6E73]">{client.name} ({client.code})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5 transition-all" aria-label="Fermer"><X className="w-6 h-6" /></button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6E6E73] mb-1">Année</label>
              <select value={filters.year || ''} onChange={(e) => setFilters({ ...filters, year: e.target.value ? Number(e.target.value) : undefined, month: undefined })} className="px-3 py-2 border border-black/[0.04] rounded-xl text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]">
                <option value="">Toutes</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6E6E73] mb-1">Mois</label>
              <select value={filters.month || ''} onChange={(e) => setFilters({ ...filters, month: e.target.value ? Number(e.target.value) : undefined })} disabled={!filters.year} className="px-3 py-2 border border-black/[0.04] rounded-xl text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] disabled:bg-black/5 disabled:text-[#86868B]">
                <option value="">Tous</option>
                {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="border-l border-black/[0.04] pl-4">
              <label className="block text-xs font-medium text-[#6E6E73] mb-1">Du</label>
              <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value, year: undefined, month: undefined })} className="px-3 py-2 border border-black/[0.04] rounded-xl text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6E6E73] mb-1">Au</label>
              <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value, year: undefined, month: undefined })} className="px-3 py-2 border border-black/[0.04] rounded-xl text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]" />
            </div>
            <button onClick={() => setFilters({ year: currentYear, month: undefined, from: '', to: '' })} className="px-3 py-2 text-sm font-medium text-[#86868B] hover:text-[#007AFF] rounded-xl hover:bg-[#007AFF]/10 transition-all">Réinitialiser</button>
          </div>
        </div>

        {/* Totals */}
        {historyData && (
          <div className="px-6 py-3 bg-[#007AFF]/5 border-b border-[#007AFF]/10 backdrop-blur-sm">
            <div className="flex items-center gap-8 text-sm">
              <div><span className="text-[#6E6E73]">Factures:</span> <span className="font-semibold text-[#1D1D1F]">{historyData.totals.invoices}</span></div>
              <div><span className="text-[#6E6E73]">Quantité:</span> <span className="font-semibold text-[#1D1D1F]">{historyData.totals.totalQuantity.toLocaleString()}</span></div>
              <div><span className="text-[#6E6E73]">Total HT:</span> <span className="font-semibold text-[#1D1D1F]">{formatPrice(historyData.totals.totalHt)}</span></div>
              <div><span className="text-[#6E6E73]">Net à payer:</span> <span className="font-semibold text-[#007AFF]">{formatPrice(historyData.totals.netToPay)}</span></div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-[3px] border-[#007AFF]/20 border-t-[#007AFF] rounded-full animate-spin" /></div>
          ) : historyData?.invoices.length === 0 ? (
            <div className="text-center py-16"><Package className="w-12 h-12 mx-auto mb-3 text-[#86868B]/40" /><p className="text-[#86868B] font-medium">Aucune facture trouvée pour cette période</p></div>
          ) : (
            <div className="space-y-4">
              {historyData?.invoices.map((invoice) => (
                <div key={invoice.id} className="glass-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-medium text-[#007AFF]">{invoice.reference}</span>
                      <span className="text-sm text-[#6E6E73]">{formatDate(invoice.date)}</span>
                      <span className={cn('px-2 py-0.5 text-xs rounded-full', invoice.status === 'PAID' ? 'bg-[#34C759]/10 text-[#34C759]' : invoice.status === 'DRAFT' ? 'bg-black/5 text-[#86868B]' : invoice.status === 'CANCELLED' ? 'bg-[#FF3B30]/10 text-[#FF3B30]' : 'bg-yellow-100 text-yellow-700')}>
                        {invoice.status === 'PAID' ? 'Payée' : invoice.status === 'DRAFT' ? 'Brouillon' : invoice.status === 'CANCELLED' ? 'Annulée' : invoice.status}
                      </span>
                    </div>
                    <div className="text-right"><p className="font-semibold">{formatPrice(invoice.netToPay)}</p><p className="text-xs text-[#86868B]">{invoice.paymentMethod === 'ESPECES' ? 'Espèces' : invoice.paymentMethod === 'CHEQUE' ? 'Chèque' : invoice.paymentMethod === 'VIREMENT' ? 'Virement' : invoice.paymentMethod}</p></div>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-white/30 backdrop-blur-sm"><tr><th className="px-4 py-2 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Produit</th><th className="px-4 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Qté</th><th className="px-4 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">P.U. HT</th><th className="px-4 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Total HT</th></tr></thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {invoice.lines.map((line) => (
                        <tr key={line.id}><td className="px-4 py-2"><span className="font-mono text-xs text-[#86868B] mr-2">{line.product.code}</span>{line.product.name}</td><td className="px-4 py-2 text-right">{line.quantity} {line.product.unit}</td><td className="px-4 py-2 text-right">{formatPrice(line.unitPriceHt)}</td><td className="px-4 py-2 text-right font-medium">{formatPrice(line.lineHt)}</td></tr>
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
          <div className="px-6 py-3 border-t border-black/[0.04] bg-white/40 backdrop-blur-sm flex items-center justify-between">
            <span className="text-sm text-[#6E6E73]">Page {historyData.pagination.page} sur {historyData.pagination.totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-xl border border-black/[0.04] bg-white/60 hover:bg-white/80 disabled:opacity-40 transition-all" aria-label="Page précédente"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage((p) => Math.min(historyData.pagination.totalPages, p + 1))} disabled={page === historyData.pagination.totalPages} className="p-2 rounded-xl border border-black/[0.04] bg-white/60 hover:bg-white/80 disabled:opacity-40 transition-all" aria-label="Page suivante"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
