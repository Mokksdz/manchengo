'use client';

import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { useEffect, useState, useCallback, useRef } from 'react';
import { formatDate } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import { useFocusTrap, useEscapeKey } from '@/lib/hooks/use-focus-trap';
import {
  Truck, Plus, X, Eye, Search, Ban, CheckCircle, Loader2,
  MapPin, Calendar, FileText, Package,
} from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';
import { KeyboardHint } from '@/components/ui/keyboard-hint';
import { ConfirmDialog, PromptDialog } from '@/components/ui/modal';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

const log = createLogger('Livraisons');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Delivery {
  id: string;
  reference: string;
  invoiceId: number;
  clientId: number;
  qrCode: string;
  status: 'PENDING' | 'VALIDATED' | 'DELIVERED' | 'CANCELLED';
  scheduledDate: string | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  validatedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  client: { id: number; name: string; address?: string };
  invoice: { id: number; reference: string; netToPay?: number };
}

interface DeliveryDetail extends Delivery {
  recipientName: string | null;
  client: { id: number; name: string; code?: string; address?: string; phone?: string };
  invoice: {
    id: number;
    reference: string;
    netToPay: number;
    totalHt: number;
    totalTva: number;
    totalTtc: number;
    timbreFiscal: number;
    lines: {
      productPf: { code: string; name: string; unit: string };
      quantity: number;
      unitPriceHt: number;
      lineHt: number;
    }[];
  };
}

interface InvoiceForBL {
  id: number;
  reference: string;
  date: string;
  status: string;
  netToPay: number;
  client: { id: number; name: string; code?: string; address?: string };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const deliveryStatuses = [
  { value: 'PENDING', label: 'En attente', color: 'bg-[#FF9500]/10 text-[#C93400]' },
  { value: 'VALIDATED', label: 'Valid\u00e9', color: 'bg-[#007AFF]/10 text-[#007AFF]' },
  { value: 'DELIVERED', label: 'Livr\u00e9', color: 'bg-[#34C759]/10 text-[#248A3D]' },
  { value: 'CANCELLED', label: 'Annul\u00e9', color: 'bg-[#FF3B30]/10 text-[#D70015]' },
];

function getStatusStyle(status: string): string {
  return deliveryStatuses.find(s => s.value === status)?.color || 'bg-black/5 text-[#86868B]';
}

function getStatusLabel(status: string): string {
  return deliveryStatuses.find(s => s.value === status)?.label || status;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LivraisonsPage() {
  // ── List state ──
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'VALIDATED' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Detail modal ──
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryDetail | null>(null);
  const detailModalRef = useFocusTrap<HTMLDivElement>(showDetailModal);
  const closeDetailModal = useCallback(() => setShowDetailModal(false), []);
  useEscapeKey(closeDetailModal, showDetailModal);

  // ── Create modal ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [invoicesForBL, setInvoicesForBL] = useState<InvoiceForBL[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotesField] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const createModalRef = useFocusTrap<HTMLDivElement>(showCreateModal);
  const closeCreateModal = useCallback(() => { setShowCreateModal(false); setCreateError(null); }, []);
  useEscapeKey(closeCreateModal, showCreateModal);

  // ── Cancel prompt ──
  const [cancelTarget, setCancelTarget] = useState<{ id: string; reference: string } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── Deliver confirm ──
  const [deliverTarget, setDeliverTarget] = useState<{ id: string; reference: string } | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  const loadDeliveries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const result = await apiFetch<{ data: Delivery[]; meta: typeof meta }>(`/deliveries?${params}`);
      setDeliveries(result.data || []);
      setMeta(result.meta || { total: 0, page: 1, limit: 20, totalPages: 1 });
    } catch (err) {
      log.error('Failed to load deliveries', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Erreur lors du chargement des bons de livraison');
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, searchQuery]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'n', handler: () => openCreateModal(), description: 'Nouveau BL' },
    { key: 'r', handler: () => { loadDeliveries(); }, description: 'Actualiser' },
    { key: '/', handler: () => { searchInputRef.current?.focus(); }, description: 'Rechercher' },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW DETAIL
  // ═══════════════════════════════════════════════════════════════════════════

  const viewDeliveryDetail = async (id: string) => {
    try {
      const data = await apiFetch<DeliveryDetail>(`/deliveries/${id}`);
      setSelectedDelivery(data);
      setShowDetailModal(true);
    } catch (err) {
      log.error('Failed to load delivery', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Erreur lors du chargement du bon de livraison');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE BL
  // ═══════════════════════════════════════════════════════════════════════════

  const openCreateModal = async () => {
    setShowCreateModal(true);
    setSelectedInvoiceId(null);
    setScheduledDate('');
    setDeliveryAddress('');
    setDeliveryNotesField('');
    setCreateError(null);

    setLoadingInvoices(true);
    try {
      const result = await apiFetch<{ data: InvoiceForBL[]; meta: { total: number } }>('/admin/invoices?status=VALIDATED&limit=100');
      setInvoicesForBL(result.data || []);
    } catch (err) {
      log.error('Failed to load invoices', { error: err instanceof Error ? err.message : String(err) });
      setCreateError('Impossible de charger les factures');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleSelectInvoice = (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId);
    const invoice = invoicesForBL.find(i => i.id === invoiceId);
    if (invoice?.client?.address) {
      setDeliveryAddress(invoice.client.address);
    }
  };

  const handleCreateSubmit = async () => {
    if (!selectedInvoiceId) {
      setCreateError('Veuillez s\u00e9lectionner une facture');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      await apiFetch('/deliveries', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: selectedInvoiceId,
          scheduledDate: scheduledDate || undefined,
          deliveryAddress: deliveryAddress || undefined,
          deliveryNotes: deliveryNotes || undefined,
        }),
      });
      toast.success('Bon de livraison cr\u00e9\u00e9 avec succ\u00e8s');
      setShowCreateModal(false);
      loadDeliveries();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erreur lors de la cr\u00e9ation');
    } finally {
      setCreateLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CANCEL BL
  // ═══════════════════════════════════════════════════════════════════════════

  const handleCancel = async (reason: string) => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await apiFetch(`/deliveries/${cancelTarget.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      toast.success(`BL ${cancelTarget.reference} annul\u00e9`);
      setCancelTarget(null);
      setShowDetailModal(false);
      loadDeliveries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'annulation');
    } finally {
      setCancelLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MARK AS DELIVERED
  // ═══════════════════════════════════════════════════════════════════════════

  const handleMarkDelivered = async () => {
    if (!deliverTarget) return;
    try {
      await apiFetch(`/deliveries/${deliverTarget.id}/deliver`, {
        method: 'POST',
      });
      toast.success(`BL ${deliverTarget.reference} marqu\u00e9 comme livr\u00e9`);
      setDeliverTarget(null);
      setShowDetailModal(false);
      loadDeliveries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise \u00e0 jour');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const selectedInvoiceForCreate = invoicesForBL.find(i => i.id === selectedInvoiceId);

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Bons de Livraison"
        subtitle={`${meta.total} bon${meta.total !== 1 ? 's' : ''} de livraison au total`}
        icon={<Truck className="w-5 h-5" />}
        actions={
          <Button onClick={openCreateModal} variant="amber">
            <Plus className="w-4 h-4" />
            Nouveau BL
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
          <SkeletonTable rows={5} columns={7} />
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
                  placeholder="Rechercher par r\u00e9f\u00e9rence ou client..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-10 py-2 text-sm rounded-full bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] placeholder:text-[#86868B]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <KeyboardHint shortcut="/" />
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(['ALL', 'PENDING', 'VALIDATED', 'DELIVERED', 'CANCELLED'] as const).map((s) => {
                  const labels: Record<string, string> = { ALL: 'Tous', PENDING: 'En attente', VALIDATED: 'Valid\u00e9', DELIVERED: 'Livr\u00e9', CANCELLED: 'Annul\u00e9' };
                  return (
                    <button
                      key={s}
                      onClick={() => { setStatusFilter(s); setPage(1); }}
                      className={statusFilter === s
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

            {/* Table */}
            <table className="w-full">
              <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
                <tr>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">R\u00e9f\u00e9rence</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Client</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Facture</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Montant</th>
                  <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Statut</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="group hover:bg-white/60 transition-colors">
                    <td className="px-5 py-4 text-[14px] text-[#1D1D1F]">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-[#EC7620]" />
                        <span className="font-mono text-sm font-medium">{delivery.reference}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[14px] text-[#86868B]">{formatDate(delivery.createdAt)}</td>
                    <td className="px-5 py-4 text-[14px] text-[#1D1D1F] font-medium">{delivery.client?.name || '-'}</td>
                    <td className="px-5 py-4 text-[14px] text-[#86868B]">
                      <span className="font-mono text-xs">{delivery.invoice?.reference || '-'}</span>
                    </td>
                    <td className="px-5 py-4 text-[14px] text-[#1D1D1F] text-right font-semibold">
                      {delivery.invoice?.netToPay ? formatPrice(delivery.invoice.netToPay) : '-'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`glass-status-pill inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${getStatusStyle(delivery.status)}`}>
                        {getStatusLabel(delivery.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => viewDeliveryDetail(delivery.id)}
                          className="p-2 rounded-xl text-[#86868B] hover:text-[#007AFF] hover:bg-[#007AFF]/10 transition-all"
                          title="Voir d\u00e9tails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {delivery.status === 'VALIDATED' && (
                          <button
                            onClick={() => setDeliverTarget({ id: delivery.id, reference: delivery.reference })}
                            className="p-2 rounded-xl text-[#86868B] hover:text-[#34C759] hover:bg-[#34C759]/10 transition-all"
                            title="Marquer livr\u00e9"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {delivery.status === 'PENDING' && (
                          <button
                            onClick={() => setCancelTarget({ id: delivery.id, reference: delivery.reference })}
                            className="p-2 rounded-xl text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
                            title="Annuler le BL"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {deliveries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <Truck className="w-12 h-12 text-[#86868B]/40 mx-auto mb-3" />
                      <p className="text-[#86868B] font-medium">Aucun bon de livraison trouv\u00e9</p>
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* DETAIL MODAL                                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showDetailModal && selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto py-8">
          <div ref={detailModalRef} role="dialog" aria-modal="true" aria-labelledby="detail-bl-title" className="relative w-full bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/20 animate-scale-in max-w-3xl mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
              <div>
                <h2 id="detail-bl-title" className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">BL {selectedDelivery.reference}</h2>
                <span className={`glass-status-pill inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(selectedDelivery.status)}`}>
                  {getStatusLabel(selectedDelivery.status)}
                </span>
              </div>
              <button onClick={closeDetailModal} className="p-1 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-[8px]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Info cards */}
              <div className="glass-card p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-1">Client</h3>
                    <p className="font-medium">{selectedDelivery.client.name}</p>
                    {selectedDelivery.client.code && (
                      <p className="text-[13px] text-[#86868B]">{selectedDelivery.client.code}</p>
                    )}
                    {selectedDelivery.client.phone && (
                      <p className="text-[13px] text-[#86868B]">{selectedDelivery.client.phone}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-1">Facture li\u00e9e</h3>
                    <p className="font-mono text-sm font-medium">{selectedDelivery.invoice.reference}</p>
                  </div>
                </div>
              </div>

              {/* Dates & Address */}
              <div className="glass-card p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[13px]">
                      <Calendar className="w-3.5 h-3.5 text-[#86868B]" />
                      <span className="text-[#86868B]">Cr\u00e9\u00e9 le:</span>
                      <span>{formatDate(selectedDelivery.createdAt)}</span>
                    </div>
                    {selectedDelivery.scheduledDate && (
                      <div className="flex items-center gap-2 text-[13px]">
                        <Calendar className="w-3.5 h-3.5 text-[#FF9500]" />
                        <span className="text-[#86868B]">Pr\u00e9vu le:</span>
                        <span>{formatDate(selectedDelivery.scheduledDate)}</span>
                      </div>
                    )}
                    {selectedDelivery.validatedAt && (
                      <div className="flex items-center gap-2 text-[13px]">
                        <CheckCircle className="w-3.5 h-3.5 text-[#007AFF]" />
                        <span className="text-[#86868B]">Valid\u00e9 le:</span>
                        <span>{formatDate(selectedDelivery.validatedAt)}</span>
                      </div>
                    )}
                    {selectedDelivery.deliveredAt && (
                      <div className="flex items-center gap-2 text-[13px]">
                        <Truck className="w-3.5 h-3.5 text-[#34C759]" />
                        <span className="text-[#86868B]">Livr\u00e9 le:</span>
                        <span>{formatDate(selectedDelivery.deliveredAt)}</span>
                      </div>
                    )}
                    {selectedDelivery.cancelledAt && (
                      <div className="flex items-center gap-2 text-[13px]">
                        <Ban className="w-3.5 h-3.5 text-[#FF3B30]" />
                        <span className="text-[#86868B]">Annul\u00e9 le:</span>
                        <span>{formatDate(selectedDelivery.cancelledAt)}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selectedDelivery.deliveryAddress && (
                      <div>
                        <div className="flex items-center gap-1 text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-1">
                          <MapPin className="w-3 h-3" /> Adresse
                        </div>
                        <p className="text-[13px]">{selectedDelivery.deliveryAddress}</p>
                      </div>
                    )}
                    {selectedDelivery.recipientName && (
                      <div>
                        <div className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-1">Destinataire</div>
                        <p className="text-[13px]">{selectedDelivery.recipientName}</p>
                      </div>
                    )}
                  </div>
                </div>
                {selectedDelivery.deliveryNotes && (
                  <div className="mt-3 pt-3 border-t border-black/[0.04]">
                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-1">Notes</h3>
                    <p className="text-[13px] text-[#3C3C43]">{selectedDelivery.deliveryNotes}</p>
                  </div>
                )}
                {selectedDelivery.cancelReason && (
                  <div className="mt-3 pt-3 border-t border-black/[0.04]">
                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#FF3B30] mb-1">Motif d&apos;annulation</h3>
                    <p className="text-[13px] text-[#FF3B30]">{selectedDelivery.cancelReason}</p>
                  </div>
                )}
              </div>

              {/* Invoice lines */}
              {selectedDelivery.invoice.lines && selectedDelivery.invoice.lines.length > 0 && (
                <div>
                  <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Produits</h3>
                  <div className="glass-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
                        <tr>
                          <th className="px-3 py-2 text-left">Produit</th>
                          <th className="px-3 py-2 text-right">Qt\u00e9</th>
                          <th className="px-3 py-2 text-right">Prix HT</th>
                          <th className="px-3 py-2 text-right">Total HT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedDelivery.invoice.lines.map((line, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-[#86868B]" />
                                <div>
                                  <span className="font-medium">{line.productPf?.name}</span>
                                  <span className="text-[11px] text-[#86868B] ml-2">{line.productPf?.code}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">{line.quantity} {line.productPf?.unit}</td>
                            <td className="px-3 py-2 text-right">{formatPrice(line.unitPriceHt)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatPrice(line.lineHt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Financial summary */}
              <div className="glass-card p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#86868B]">Total HT</span>
                  <span>{formatPrice(selectedDelivery.invoice.totalHt)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#86868B]">TVA (19%)</span>
                  <span>{formatPrice(selectedDelivery.invoice.totalTva)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#86868B]">Total TTC</span>
                  <span>{formatPrice(selectedDelivery.invoice.totalTtc)}</span>
                </div>
                {selectedDelivery.invoice.timbreFiscal > 0 && (
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#86868B]">Timbre fiscal</span>
                    <span>{formatPrice(selectedDelivery.invoice.timbreFiscal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t border-black/[0.08]">
                  <span>Net \u00e0 payer</span>
                  <span className="text-[#EC7620]">{formatPrice(selectedDelivery.invoice.netToPay)}</span>
                </div>
              </div>

              {/* Actions */}
              {(selectedDelivery.status === 'PENDING' || selectedDelivery.status === 'VALIDATED') && (
                <div className="flex justify-end gap-3">
                  {selectedDelivery.status === 'PENDING' && (
                    <Button
                      variant="danger"
                      onClick={() => {
                        setCancelTarget({ id: selectedDelivery.id, reference: selectedDelivery.reference });
                      }}
                    >
                      <Ban className="w-4 h-4" />
                      Annuler ce BL
                    </Button>
                  )}
                  {selectedDelivery.status === 'VALIDATED' && (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setDeliverTarget({ id: selectedDelivery.id, reference: selectedDelivery.reference });
                      }}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Marquer livr\u00e9
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CREATE BL MODAL                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto py-8">
          <div ref={createModalRef} role="dialog" aria-modal="true" aria-labelledby="create-bl-title" className="relative w-full bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/20 animate-scale-in max-w-lg mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
              <h2 id="create-bl-title" className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#EC7620]" />
                Nouveau Bon de Livraison
              </h2>
              <button onClick={closeCreateModal} className="p-1 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-[8px]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Error */}
              {createError && (
                <div className="p-3 rounded-2xl bg-[#FF3B30]/10 text-[#D70015] text-sm font-medium">
                  {createError}
                </div>
              )}

              {/* Invoice selector */}
              <div>
                <label htmlFor="invoice-select" className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                  Facture valid\u00e9e <span className="text-[#FF3B30]">*</span>
                </label>
                {loadingInvoices ? (
                  <div className="flex items-center gap-2 text-sm text-[#86868B]">
                    <Loader2 className="w-4 h-4 animate-spin" /> Chargement des factures...
                  </div>
                ) : invoicesForBL.length === 0 ? (
                  <p className="text-sm text-[#86868B]">Aucune facture valid\u00e9e disponible</p>
                ) : (
                  <select
                    id="invoice-select"
                    value={selectedInvoiceId || ''}
                    onChange={(e) => handleSelectInvoice(Number(e.target.value))}
                    className="w-full px-4 py-2.5 text-sm rounded-2xl bg-white/60 border border-black/[0.06] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                  >
                    <option value="">-- S\u00e9lectionner une facture --</option>
                    {invoicesForBL.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.reference} \u2014 {inv.client.name} \u2014 {formatPrice(inv.netToPay)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Selected invoice info */}
              {selectedInvoiceForCreate && (
                <div className="glass-card p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{selectedInvoiceForCreate.client.name}</p>
                      <p className="text-[13px] text-[#86868B]">{selectedInvoiceForCreate.client.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#EC7620]">{formatPrice(selectedInvoiceForCreate.netToPay)}</p>
                      <p className="text-[13px] text-[#86868B]">{formatDate(selectedInvoiceForCreate.date)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Scheduled date */}
              <div>
                <label htmlFor="scheduled-date" className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                  Date pr\u00e9vue de livraison
                </label>
                <input
                  id="scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-2xl bg-white/60 border border-black/[0.06] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                />
              </div>

              {/* Delivery address */}
              <div>
                <label htmlFor="delivery-address" className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                  <MapPin className="w-3.5 h-3.5 inline mr-1" />
                  Adresse de livraison
                </label>
                <input
                  id="delivery-address"
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Adresse du client (auto-remplie)"
                  className="w-full px-4 py-2.5 text-sm rounded-2xl bg-white/60 border border-black/[0.06] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] placeholder:text-[#86868B]"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="delivery-notes" className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
                  Notes de livraison
                </label>
                <textarea
                  id="delivery-notes"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotesField(e.target.value)}
                  placeholder="Instructions sp\u00e9ciales pour le livreur..."
                  rows={3}
                  className="w-full px-4 py-2.5 text-sm rounded-2xl bg-white/60 border border-black/[0.06] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] placeholder:text-[#86868B] resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={closeCreateModal} disabled={createLoading}>
                  Annuler
                </Button>
                <Button variant="amber" onClick={handleCreateSubmit} disabled={createLoading || !selectedInvoiceId}>
                  {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {createLoading ? 'Cr\u00e9ation...' : 'Cr\u00e9er le BL'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CANCEL PROMPT DIALOG                                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <PromptDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onSubmit={handleCancel}
        title="Annuler ce bon de livraison ?"
        message={`Saisissez le motif d'annulation pour le BL ${cancelTarget?.reference || ''} (minimum 5 caract\u00e8res).`}
        placeholder="Motif d'annulation..."
        multiline
        submitLabel="Confirmer l'annulation"
        variant="danger"
        loading={cancelLoading}
        required
      />

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* DELIVER CONFIRM DIALOG                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <ConfirmDialog
        open={!!deliverTarget}
        onClose={() => setDeliverTarget(null)}
        onConfirm={handleMarkDelivered}
        title="Marquer comme livr\u00e9 ?"
        message={`Confirmer que la livraison ${deliverTarget?.reference || ''} a \u00e9t\u00e9 effectu\u00e9e.`}
        confirmLabel="Confirmer la livraison"
        variant="primary"
      />
    </div>
  );
}
