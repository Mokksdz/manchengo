'use client';

import { authFetch } from '@/lib/api';
import { toast } from 'sonner';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useFocusTrap, useEscapeKey } from '@/lib/hooks/use-focus-trap';
import { FileText, Plus, X, Eye, FileDown, CheckCircle, Search } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';
import { KeyboardHint } from '@/components/ui/keyboard-hint';
import { ConfirmDialog } from '@/components/ui/modal';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';

interface Invoice {
  id: number;
  reference: string;
  date: string;
  client: { id: number; name: string; code: string; nif?: string };
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  timbreFiscal: number;
  timbreRatePercent?: number;
  netToPay: number;
  paymentMethod: string;
  status: string;
  lines?: InvoiceLine[];
}

interface InvoiceLine {
  productPfId: number;
  productName?: string;
  productPf?: { code: string; name: string; unit: string };
  quantity: number;
  unitPriceHt: number;
  lineHt: number;
}

const paymentMethods = [
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'VIREMENT', label: 'Virement' },
];

// Status values must match Prisma InvoiceStatus enum
const invoiceStatuses = [
  { value: 'DRAFT', label: 'Brouillon', color: 'bg-black/5 text-[#86868B]' },
  { value: 'PAID', label: 'Payée', color: 'bg-[#34C759]/10 text-[#34C759]' },
  { value: 'CANCELLED', label: 'Annulée', color: 'bg-[#FF3B30]/10 text-[#FF3B30]' },
];

/**
 * Calcule le taux de timbre fiscal selon la législation algérienne
 * - TTC <= 30 000 DA -> 1%
 * - 30 000 < TTC <= 100 000 DA -> 1.5%
 * - TTC > 100 000 DA -> 2%
 */
function calculateTimbreRate(totalTtc: number): number {
  if (totalTtc <= 3000000) return 1;
  if (totalTtc <= 10000000) return 1.5;
  return 2;
}

function getStatusStyle(status: string): string {
  return invoiceStatuses.find(s => s.value === status)?.color || 'bg-black/5 text-[#86868B]';
}

function getStatusLabel(status: string): string {
  return invoiceStatuses.find(s => s.value === status)?.label || status;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilterInv, setStatusFilterInv] = useState<'ALL' | 'DRAFT' | 'PAID' | 'CANCELLED'>('ALL');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Invoice detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{id: number; status: string} | null>(null);

  // Focus trap and escape key for detail modal
  const detailModalRef = useFocusTrap<HTMLDivElement>(showDetailModal);
  const closeDetailModal = useCallback(() => setShowDetailModal(false), []);
  useEscapeKey(closeDetailModal, showDetailModal);

  // Load invoices from backend
  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (statusFilterInv !== 'ALL') params.set('status', statusFilterInv);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await authFetch(`/admin/invoices?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const result = await res.json();
        setInvoices(result.data || []);
        setMeta(result.meta || { total: 0, page: 1, totalPages: 1 });
      }
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilterInv, searchQuery]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'n', handler: () => { router.push('/dashboard/invoices/new'); }, description: 'Nouvelle facture' },
    { key: 'r', handler: () => { loadInvoices(); }, description: 'Actualiser les donnees' },
    { key: '/', handler: () => { searchInputRef.current?.focus(); }, description: 'Rechercher' },
  ]);

  // View invoice detail
  const viewInvoiceDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await authFetch(`/admin/invoices/${id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedInvoice(data);
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error('Failed to load invoice:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const changeInvoiceStatus = (id: number, newStatus: string) => {
    if (newStatus === 'PAID' || newStatus === 'CANCELLED') {
      setConfirmAction({ id, status: newStatus });
      return;
    }
    doChangeStatus(id, newStatus);
  };

  const doChangeStatus = async (id: number, newStatus: string) => {
    try {
      const res = await authFetch(`/admin/invoices/${id}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (selectedInvoice?.id === id) {
          setSelectedInvoice(updated);
        }
        loadInvoices();
      } else {
        const err = await res.json().catch(() => ({ message: 'Erreur lors du changement de statut' }));
        toast.error(err.message || 'Erreur lors du changement de statut');
      }
    } catch (err) {
      console.error('Failed to change status:', err);
    }
  };

  const downloadPdf = async (id: number, reference?: string) => {
    try {
      const res = await authFetch(`/exports/invoice/${id}/pdf`, { credentials: 'include' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const filename = reference ? `Facture-${reference}.pdf` : `Facture-${id}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      toast.error(err instanceof Error ? err.message : 'Erreur lors du telechargement du PDF');
    }
  };

  // Suppress unused warning for loadingDetail (used for future loading state)
  void loadingDetail;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#007AFF]/20 to-[#007AFF]/10 flex items-center justify-center shadow-lg shadow-[#007AFF]/10">
              <FileText className="w-6 h-6 text-[#007AFF]" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-[#1D1D1F] tracking-tight">Factures</h1>
              <p className="text-[13px] text-[#86868B]">{meta.total} facture{meta.total !== 1 ? 's' : ''} au total</p>
            </div>
          </div>
          <button onClick={() => router.push('/dashboard/invoices/new')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#007AFF] text-white text-sm font-semibold rounded-full hover:bg-[#0056D6] shadow-lg shadow-[#007AFF]/25 transition-all active:scale-[0.97]">
            <Plus className="w-4 h-4" />
            Nouvelle facture
            <KeyboardHint shortcut="N" />
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="glass-bg space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-36 rounded-full" />
          </div>
          <SkeletonTable rows={5} columns={6} />
        </div>
      ) : (
        <>
          <div className="glass-card overflow-hidden">
            {/* Search & Filter */}
            <div className="px-5 py-3 border-b border-black/[0.04] bg-white/40 backdrop-blur-sm flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher par reference ou client..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-10 py-2 text-sm rounded-full bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] placeholder:text-[#86868B]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <KeyboardHint shortcut="/" />
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(['ALL', 'DRAFT', 'PAID', 'CANCELLED'] as const).map((s) => {
                  const labels: Record<string, string> = { ALL: 'Tous', DRAFT: 'Brouillon', PAID: 'Payee', CANCELLED: 'Annulee' };
                  return (
                    <button
                      key={s}
                      onClick={() => { setStatusFilterInv(s); setPage(1); }}
                      className={statusFilterInv === s
                        ? 'px-3 py-1.5 text-xs font-semibold rounded-full bg-[#007AFF] text-white shadow-sm transition-all'
                        : 'px-3 py-1.5 text-xs font-medium rounded-full text-[#86868B] bg-white/60 border border-black/[0.04] hover:bg-white/80 transition-all'
                      }
                    >
                      {labels[s]}
                    </button>
                  );
                })}
              </div>
            </div>
            <table className="w-full">
              <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
                <tr>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Reference</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Client</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Net a payer</th>
                  <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Statut</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="group hover:bg-white/60 transition-colors">
                    <td className="px-5 py-4 text-[14px] text-[#1D1D1F]">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#EC7620]" />
                        <span className="font-mono text-sm font-medium">{invoice.reference}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[14px] text-[#86868B]">{formatDate(invoice.date)}</td>
                    <td className="px-5 py-4 text-[14px] text-[#1D1D1F] font-medium">{invoice.client?.name || '-'}</td>
                    <td className="px-5 py-4 text-[14px] text-[#1D1D1F] text-right font-semibold">{formatCurrency(invoice.netToPay)}</td>
                    <td className="px-5 py-4 text-[14px] text-[#1D1D1F] text-center">
                      <span className={`glass-status-pill inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${getStatusStyle(invoice.status)}`}>
                        {getStatusLabel(invoice.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[14px] text-[#1D1D1F] text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => viewInvoiceDetail(invoice.id)}
                          className="p-2 rounded-xl text-[#86868B] hover:text-[#007AFF] hover:bg-[#007AFF]/10 transition-all"
                          title="Voir details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {invoice.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => changeInvoiceStatus(invoice.id, 'PAID')}
                              className="p-2 rounded-xl text-[#86868B] hover:text-[#34C759] hover:bg-[#34C759]/10 transition-all"
                              title="Valider et marquer payee"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => changeInvoiceStatus(invoice.id, 'CANCELLED')}
                              className="p-2 rounded-xl text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
                              title="Annuler la facture"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => downloadPdf(invoice.id, invoice.reference)}
                          className="p-2 rounded-xl text-[#86868B] hover:text-[#007AFF] hover:bg-[#007AFF]/10 transition-all"
                          title="Telecharger PDF"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <FileText className="w-12 h-12 text-[#86868B]/40 mx-auto mb-3" />
                      <p className="text-[#86868B] font-medium">Aucune facture trouvee</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Invoice Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto py-8">
          <div ref={detailModalRef} role="dialog" aria-modal="true" aria-labelledby="detail-invoice-title" className="relative w-full bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 animate-scale-in max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
              <div>
                <h2 id="detail-invoice-title" className="text-lg font-semibold text-[#1D1D1F]">Facture {selectedInvoice.reference}</h2>
                <span className={`glass-status-pill inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(selectedInvoice.status)}`}>
                  {getStatusLabel(selectedInvoice.status)}
                </span>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-[8px]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="glass-card p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-[13px] font-medium text-[#86868B] mb-1">Client</h3>
                    <p className="font-medium">{selectedInvoice.client.name}</p>
                    <p className="text-[13px] text-[#86868B]">{selectedInvoice.client.code}</p>
                    {selectedInvoice.client.nif && (
                      <p className="text-[13px] text-[#86868B]">NIF: {selectedInvoice.client.nif}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[13px] font-medium text-[#86868B] mb-1">Date</h3>
                    <p>{formatDate(selectedInvoice.date)}</p>
                    <h3 className="text-[13px] font-medium text-[#86868B] mb-1 mt-2">Mode de paiement</h3>
                    <p>{paymentMethods.find(m => m.value === selectedInvoice.paymentMethod)?.label || selectedInvoice.paymentMethod}</p>
                  </div>
                </div>
              </div>

              {selectedInvoice.lines && selectedInvoice.lines.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-medium text-[#86868B] mb-2">Lignes</h3>
                  <div className="glass-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
                        <tr>
                          <th className="px-3 py-2 text-left">Produit</th>
                          <th className="px-3 py-2 text-right">Qte</th>
                          <th className="px-3 py-2 text-right">Prix HT</th>
                          <th className="px-3 py-2 text-right">Total HT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedInvoice.lines.map((line, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">{line.productPf?.name || line.productName}</td>
                            <td className="px-3 py-2 text-right">{line.quantity}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(line.unitPriceHt)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(line.lineHt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="glass-card p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Total HT</span>
                  <span>{formatCurrency(selectedInvoice.totalHt)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span>TVA (19%)</span>
                  <span>{formatCurrency(selectedInvoice.totalTva)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Total TTC</span>
                  <span>{formatCurrency(selectedInvoice.totalTtc)}</span>
                </div>
                {selectedInvoice.timbreFiscal > 0 && (
                  <div className="flex justify-between text-sm mb-1 text-[#FF9500]">
                    <span>Timbre fiscal ({selectedInvoice.timbreRatePercent || calculateTimbreRate(selectedInvoice.totalTtc)}%)</span>
                    <span>{formatCurrency(selectedInvoice.timbreFiscal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-black/[0.04] pt-2 mt-2">
                  <span>Net a payer</span>
                  <span>{formatCurrency(selectedInvoice.netToPay)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-black/[0.04]">
                <div className="flex gap-2">
                  {selectedInvoice.status === 'DRAFT' && (
                    <>
                      <button
                        onClick={() => changeInvoiceStatus(selectedInvoice.id, 'PAID')}
                        className="px-4 py-2 bg-[#34C759] text-white text-sm rounded-full hover:bg-[#2DB44D] font-semibold transition-all shadow-lg shadow-[#34C759]/25"
                      >
                        Valider & Payer
                      </button>
                      <button
                        onClick={() => changeInvoiceStatus(selectedInvoice.id, 'CANCELLED')}
                        className="px-4 py-2 bg-[#FF3B30]/10 text-[#FF3B30] text-sm rounded-full hover:bg-[#FF3B30]/20 font-semibold transition-all"
                      >
                        Annuler facture
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={() => downloadPdf(selectedInvoice.id, selectedInvoice.reference)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 text-[#86868B] text-sm rounded-full hover:bg-black/10 font-medium transition-all"
                >
                  <FileDown className="w-4 h-4" />
                  Telecharger PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => { if (confirmAction) { doChangeStatus(confirmAction.id, confirmAction.status); setConfirmAction(null); } }}
        title={confirmAction?.status === 'PAID' ? 'Valider cette facture ?' : 'Annuler cette facture ?'}
        message={confirmAction?.status === 'PAID' ? 'Le stock PF sera deduit. Cette action est irreversible.' : 'Cette action est irreversible.'}
        variant={confirmAction?.status === 'PAID' ? 'primary' : 'danger'}
        confirmLabel={confirmAction?.status === 'PAID' ? 'Valider & Payer' : 'Annuler la facture'}
      />
    </div>
  );
}
