'use client';

import { authFetch } from '@/lib/api';
import { toast } from 'sonner';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useFocusTrap, useEscapeKey } from '@/lib/hooks/use-focus-trap';
import { FileText, Plus, X, Eye, FileDown, CheckCircle, Search, Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';
import { KeyboardHint } from '@/components/ui/keyboard-hint';
import { ConfirmDialog } from '@/components/ui/modal';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

const log = createLogger('Invoices');

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

interface Client {
  id: number;
  code: string;
  name: string;
  nif?: string;
}

interface ProductPf {
  id: number;
  code: string;
  name: string;
  priceHt: number;
  unit: string;
}

interface EditFormLine {
  productPfId: number;
  productName?: string;
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
 * Les montants sont en centimes (1 DA = 100 centimes)
 * - TTC <= 30 000 DA (3 000 000 centimes) -> 1%
 * - 30 000 < TTC <= 100 000 DA (10 000 000 centimes) -> 1.5%
 * - TTC > 100 000 DA -> 2%
 */
import { calculateTimbreRatePercent, calculateTimbreRate } from '@/lib/fiscal-rules';
import { formatPrice } from '@/lib/format';

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

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null);
  const [editClientId, setEditClientId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('ESPECES');
  const [editLines, setEditLines] = useState<EditFormLine[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editClients, setEditClients] = useState<Client[]>([]);
  const [editProducts, setEditProducts] = useState<ProductPf[]>([]);
  const [editDataLoading, setEditDataLoading] = useState(false);

  // Fiscal validation error modal
  const [fiscalError, setFiscalError] = useState<string | null>(null);

  // Focus trap and escape key for detail modal
  const detailModalRef = useFocusTrap<HTMLDivElement>(showDetailModal);
  const closeDetailModal = useCallback(() => setShowDetailModal(false), []);
  useEscapeKey(closeDetailModal, showDetailModal);

  const editModalRef = useFocusTrap<HTMLDivElement>(showEditModal);
  const closeEditModal = useCallback(() => { setShowEditModal(false); setEditError(null); }, []);
  useEscapeKey(closeEditModal, showEditModal);

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
      log.error('Failed to load invoices', { error: err instanceof Error ? err.message : String(err) });
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
      log.error('Failed to load invoice', { error: err instanceof Error ? err.message : String(err) });
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
        const message = err.message || 'Erreur lors du changement de statut';
        // Show fiscal validation errors in a dedicated modal
        if (message.includes('coordonnées fiscales') || message.includes('Champs manquants')) {
          setFiscalError(message);
        } else {
          toast.error(message);
        }
      }
    } catch (err) {
      log.error('Failed to change status', { error: err instanceof Error ? err.message : String(err) });
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
      log.error('Failed to download PDF', { error: err instanceof Error ? err.message : String(err) });
      toast.error(err instanceof Error ? err.message : 'Erreur lors du telechargement du PDF');
    }
  };

  // Suppress unused warning for loadingDetail (used for future loading state)
  void loadingDetail;

  // ── Edit invoice functions ──────────────────────────────────────────────

  const openEditModal = async (invoice: Invoice) => {
    setEditInvoiceId(invoice.id);
    setEditClientId(invoice.client.id);
    setEditDate(invoice.date.split('T')[0]);
    setEditPaymentMethod(invoice.paymentMethod);
    setEditLines(
      (invoice.lines || []).map((l) => ({
        productPfId: l.productPfId,
        productName: l.productPf?.name || l.productName,
        quantity: l.quantity,
        unitPriceHt: l.unitPriceHt,
        lineHt: l.lineHt,
      }))
    );
    setEditError(null);
    setShowEditModal(true);
    setShowDetailModal(false);

    // Load clients and products for dropdowns
    setEditDataLoading(true);
    try {
      const [clientsRes, productsRes] = await Promise.all([
        authFetch('/admin/clients', { credentials: 'include' }),
        authFetch('/admin/stock/pf', { credentials: 'include' }),
      ]);
      if (clientsRes.ok) setEditClients(await clientsRes.json());
      if (productsRes.ok) setEditProducts(await productsRes.json());
    } catch (err) {
      log.error('Failed to load edit data', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setEditDataLoading(false);
    }
  };

  const editAddLine = () => {
    if (editProducts.length === 0) return;
    const usedIds = new Set(editLines.map((l) => l.productPfId));
    const available = editProducts.find((p) => !usedIds.has(p.id)) || editProducts[0];
    setEditLines([
      ...editLines,
      {
        productPfId: available.id,
        productName: available.name,
        quantity: 1,
        unitPriceHt: available.priceHt,
        lineHt: available.priceHt,
      },
    ]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editUpdateLine = (index: number, field: string, value: any) => {
    const newLines = [...editLines];
    if (field === 'productPfId') {
      const product = editProducts.find((p) => p.id === value);
      if (product) {
        newLines[index] = {
          ...newLines[index],
          productPfId: value,
          productName: product.name,
          unitPriceHt: product.priceHt,
          lineHt: product.priceHt * newLines[index].quantity,
        };
      }
    } else if (field === 'quantity') {
      const qty = Math.max(1, Math.round(value));
      newLines[index].quantity = qty;
      newLines[index].lineHt = newLines[index].unitPriceHt * qty;
    } else if (field === 'unitPriceHt') {
      const price = Math.max(0, value);
      newLines[index].unitPriceHt = price;
      newLines[index].lineHt = price * newLines[index].quantity;
    }
    setEditLines(newLines);
  };

  const editRemoveLine = (index: number) => {
    setEditLines(editLines.filter((_, i) => i !== index));
  };

  // Edit totals
  const editTotalHt = editLines.reduce((sum, l) => sum + l.lineHt, 0);
  const editTotalTva = Math.round(editTotalHt * 0.19);
  const editTotalTtc = editTotalHt + editTotalTva;
  const editTimbreRate = editPaymentMethod === 'ESPECES' ? calculateTimbreRate(editTotalTtc) : 0;
  const editTimbreFiscal = Math.round(editTotalTtc * editTimbreRate);
  const editNetToPay = editTotalTtc + editTimbreFiscal;

  const handleEditSubmit = async () => {
    if (!editInvoiceId || !editClientId || editLines.length === 0) {
      setEditError('Sélectionnez un client et ajoutez au moins une ligne');
      return;
    }
    const invalidLine = editLines.find((l) => l.quantity <= 0 || l.unitPriceHt <= 0);
    if (invalidLine) {
      setEditError('Chaque ligne doit avoir une quantité > 0 et un prix unitaire HT > 0');
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const res = await authFetch(`/admin/invoices/${editInvoiceId}/edit`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: editClientId,
          date: editDate,
          paymentMethod: editPaymentMethod,
          lines: editLines.map((l) => ({
            productPfId: l.productPfId,
            quantity: l.quantity,
            unitPriceHt: l.unitPriceHt,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: 'Erreur lors de la modification' }));
        throw new Error(data.message || 'Erreur lors de la modification');
      }
      toast.success('Facture modifiée avec succès');
      setShowEditModal(false);
      loadInvoices();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Factures"
        subtitle={`${meta.total} facture${meta.total !== 1 ? 's' : ''} au total`}
        icon={<FileText className="w-5 h-5" />}
        actions={
          <Button onClick={() => router.push('/dashboard/invoices/new')} variant="amber">
            <Plus className="w-4 h-4" />
            Nouvelle facture
            <KeyboardHint shortcut="N" />
          </Button>
        }
      />

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
                              onClick={async () => {
                                const res = await authFetch(`/admin/invoices/${invoice.id}`, { credentials: 'include' });
                                if (res.ok) { const data = await res.json(); openEditModal(data); }
                              }}
                              className="p-2 rounded-xl text-[#86868B] hover:text-[#FF9500] hover:bg-[#FF9500]/10 transition-all"
                              title="Modifier la facture"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
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
          <div ref={detailModalRef} role="dialog" aria-modal="true" aria-labelledby="detail-invoice-title" className="relative w-full bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/20 animate-scale-in max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
              <div>
                <h2 id="detail-invoice-title" className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Facture {selectedInvoice.reference}</h2>
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
                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-1">Client</h3>
                    <p className="font-medium">{selectedInvoice.client.name}</p>
                    <p className="text-[13px] text-[#86868B]">{selectedInvoice.client.code}</p>
                    {selectedInvoice.client.nif && (
                      <p className="text-[13px] text-[#86868B]">NIF: {selectedInvoice.client.nif}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-1">Date</h3>
                    <p>{formatDate(selectedInvoice.date)}</p>
                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-1 mt-2">Mode de paiement</h3>
                    <p>{paymentMethods.find(m => m.value === selectedInvoice.paymentMethod)?.label || selectedInvoice.paymentMethod}</p>
                  </div>
                </div>
              </div>

              {selectedInvoice.lines && selectedInvoice.lines.length > 0 && (
                <div>
                  <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Lignes</h3>
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
                    <span>Timbre fiscal ({selectedInvoice.timbreRatePercent || calculateTimbreRatePercent(selectedInvoice.totalTtc)}%)</span>
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
                        onClick={() => openEditModal(selectedInvoice)}
                        className="px-4 py-2 bg-[#FF9500]/10 text-[#FF9500] text-sm rounded-full hover:bg-[#FF9500]/20 font-semibold transition-all"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Pencil className="w-3.5 h-3.5" />
                          Modifier
                        </span>
                      </button>
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

      {/* ── Fiscal Validation Error Modal ────────────────────────────────── */}
      {fiscalError && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/20 animate-scale-in p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FF3B30]/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#FF3B30]" />
              </div>
              <h3 className="font-display text-[17px] font-bold text-[#1D1D1F]">Données fiscales incomplètes</h3>
            </div>
            <p className="text-sm text-[#6E6E73] mb-6 leading-relaxed">{fiscalError}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setFiscalError(null)}
                className="px-4 py-2 text-sm font-medium text-[#86868B] hover:bg-black/5 rounded-full transition-all"
              >
                Fermer
              </button>
              <button
                onClick={() => { setFiscalError(null); router.push('/dashboard/clients'); }}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#007AFF] rounded-full hover:bg-[#0056D6] transition-all shadow-lg shadow-[#007AFF]/25"
              >
                Modifier la fiche client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Invoice Modal ───────────────────────────────────────────── */}
      {showEditModal && editInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto py-8">
          <div ref={editModalRef} role="dialog" aria-modal="true" aria-labelledby="edit-invoice-title" className="relative w-full max-w-3xl bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/20 animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
              <h2 id="edit-invoice-title" className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#FF9500]" />
                Modifier la facture
              </h2>
              <button onClick={closeEditModal} className="p-1 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-[8px]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Error */}
              {editError && (
                <div className="flex items-center gap-2 p-3 text-sm text-[#FF3B30] bg-[#FF3B30]/10 rounded-xl border border-[#FF3B30]/20">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {editError}
                </div>
              )}

              {editDataLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#007AFF]" />
                </div>
              ) : (
                <>
                  {/* Client, Date, Payment Method */}
                  <div className="glass-card p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">Client</label>
                        <select
                          value={editClientId || ''}
                          onChange={(e) => setEditClientId(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-black/[0.04] rounded-xl text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
                        >
                          <option value="">Sélectionner</option>
                          {editClients.map((c) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">Date</label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full px-3 py-2 border border-black/[0.04] rounded-xl text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">Mode de paiement</label>
                        <select
                          value={editPaymentMethod}
                          onChange={(e) => setEditPaymentMethod(e.target.value)}
                          className="w-full px-3 py-2 border border-black/[0.04] rounded-xl text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
                        >
                          {paymentMethods.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Lines */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[13px] font-semibold text-[#6E6E73] uppercase tracking-wider">Lignes</h3>
                      <button
                        type="button"
                        onClick={editAddLine}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#007AFF] bg-[#007AFF]/10 rounded-full hover:bg-[#007AFF]/20 transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        Ajouter
                      </button>
                    </div>
                    <div className="glass-card overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
                          <tr>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Produit</th>
                            <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider w-20">Qté</th>
                            <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider w-28">Prix HT (DA)</th>
                            <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider w-28">Total HT</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.04]">
                          {editLines.map((line, idx) => (
                            <tr key={idx} className="hover:bg-white/40 transition-colors">
                              <td className="px-3 py-2">
                                <select
                                  value={line.productPfId}
                                  onChange={(e) => editUpdateLine(idx, 'productPfId', Number(e.target.value))}
                                  className="w-full px-2 py-1.5 border border-black/[0.04] rounded-lg text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                                >
                                  {editProducts.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={line.quantity}
                                  onChange={(e) => editUpdateLine(idx, 'quantity', Number(e.target.value))}
                                  className="w-full px-2 py-1.5 border border-black/[0.04] rounded-lg text-right text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                                  min={1}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={line.unitPriceHt / 100}
                                  onChange={(e) => editUpdateLine(idx, 'unitPriceHt', Math.round(Number(e.target.value) * 100))}
                                  className="w-full px-2 py-1.5 border border-black/[0.04] rounded-lg text-right text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                                  step="0.01"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-[#1D1D1F]">{formatPrice(line.lineHt)}</td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => editRemoveLine(idx)}
                                  className="p-1 rounded-lg text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {editLines.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-3 py-6 text-center text-[#AEAEB2] text-sm">
                                Aucune ligne — cliquez "Ajouter" pour commencer
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="glass-card p-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6E6E73]">Total HT</span>
                        <span className="font-medium">{formatPrice(editTotalHt)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6E6E73]">TVA (19%)</span>
                        <span className="font-medium">{formatPrice(editTotalTva)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6E6E73]">Total TTC</span>
                        <span className="font-medium">{formatPrice(editTotalTtc)}</span>
                      </div>
                      {editTimbreFiscal > 0 && (
                        <div className="flex justify-between text-sm text-[#FF9500]">
                          <span>Timbre fiscal ({editTimbreRate * 100}%)</span>
                          <span className="font-medium">{formatPrice(editTimbreFiscal)}</span>
                        </div>
                      )}
                      <div className="border-t border-black/[0.06] pt-2 mt-2">
                        <div className="flex justify-between font-bold text-base">
                          <span>Net à payer</span>
                          <span className="text-[#007AFF]">{formatPrice(editNetToPay)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={closeEditModal}
                      className="px-5 py-2 text-sm font-medium text-[#86868B] hover:bg-black/5 rounded-full transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleEditSubmit}
                      disabled={editSaving || editLines.length === 0 || !editClientId}
                      className="px-5 py-2 text-sm font-semibold text-white bg-[#FF9500] rounded-full hover:bg-[#E68600] disabled:opacity-50 transition-all shadow-lg shadow-[#FF9500]/25"
                    >
                      {editSaving ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Enregistrement...
                        </span>
                      ) : (
                        'Enregistrer les modifications'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
