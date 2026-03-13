'use client';

import { apiFetch, apiFetchRaw } from '@/lib/api';
import { toast } from 'sonner';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, AlertTriangle } from 'lucide-react';
import { KeyboardHint } from '@/components/ui/keyboard-hint';
import { ConfirmDialog } from '@/components/ui/modal';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';
import type { Invoice, StatusFilter } from '@/components/invoices/types';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { InvoiceDetailModal } from '@/components/invoices/InvoiceDetailModal';
import { InvoiceEditModal } from '@/components/invoices/InvoiceEditModal';

const log = createLogger('Invoices');

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilterInv, setStatusFilterInv] = useState<StatusFilter>('ALL');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Invoice detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{id: number; status: string} | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);

  // Fiscal validation error modal
  const [fiscalError, setFiscalError] = useState<string | null>(null);

  // Load invoices from backend
  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (statusFilterInv !== 'ALL') params.set('status', statusFilterInv);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const result = await apiFetch<{ data: Invoice[]; meta: typeof meta }>(`/admin/invoices?${params}`);
      setInvoices(result.data || []);
      setMeta(result.meta || { total: 0, page: 1, totalPages: 1 });
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
      const data = await apiFetch<Invoice>(`/admin/invoices/${id}`);
      setSelectedInvoice(data);
      setShowDetailModal(true);
    } catch (err) {
      log.error('Failed to load invoice', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Erreur lors du chargement de la facture');
    } finally {
      setLoadingDetail(false);
    }
  };

  const changeInvoiceStatus = (id: number, newStatus: string) => {
    const validStatuses = ['DRAFT', 'VALIDATED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];
    if (!validStatuses.includes(newStatus)) return;
    if (newStatus === 'PAID' || newStatus === 'CANCELLED') {
      setConfirmAction({ id, status: newStatus });
      return;
    }
    doChangeStatus(id, newStatus);
  };

  const doChangeStatus = async (id: number, newStatus: string) => {
    try {
      const updated = await apiFetch<Invoice>(`/admin/invoices/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      if (selectedInvoice?.id === id) {
        setSelectedInvoice(updated);
      }
      loadInvoices();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du changement de statut';
      // Show fiscal validation errors in a dedicated modal
      if (message.includes('coordonnees fiscales') || message.includes('Champs manquants')) {
        setFiscalError(message);
      } else {
        toast.error(message);
      }
    }
  };

  const downloadPdf = async (id: number, reference?: string) => {
    try {
      const res = await apiFetchRaw(`/exports/invoice/${id}/pdf`);
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

  // Open edit modal: fetch full invoice then show the modal
  const openEditModal = async (invoice: Invoice) => {
    try {
      const data = await apiFetch<Invoice>(`/admin/invoices/${invoice.id}`);
      setEditInvoice(data);
      setShowEditModal(true);
      setShowDetailModal(false);
    } catch {
      /* silent */
    }
  };

  // Handle edit from table row (which only has summary data)
  const handleTableEdit = async (invoice: Invoice) => {
    try {
      const data = await apiFetch<Invoice>(`/admin/invoices/${invoice.id}`);
      openEditModal(data);
    } catch {
      /* silent */
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
      <InvoiceTable
        invoices={invoices}
        meta={meta}
        isLoading={isLoading}
        searchQuery={searchQuery}
        statusFilter={statusFilterInv}
        searchInputRef={searchInputRef}
        onSearchChange={(q) => { setSearchQuery(q); setPage(1); }}
        onStatusFilterChange={(s) => { setStatusFilterInv(s); setPage(1); }}
        onPageChange={setPage}
        onViewDetail={viewInvoiceDetail}
        onEdit={handleTableEdit}
        onChangeStatus={changeInvoiceStatus}
        onDownloadPdf={downloadPdf}
      />

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          open={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          onEdit={openEditModal}
          onChangeStatus={changeInvoiceStatus}
          onDownloadPdf={downloadPdf}
        />
      )}

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => { if (confirmAction) { doChangeStatus(confirmAction.id, confirmAction.status); setConfirmAction(null); } }}
        title={confirmAction?.status === 'PAID' ? 'Marquer cette facture comme payee ?' : 'Annuler cette facture ?'}
        message={confirmAction?.status === 'PAID' ? 'Le stock PF sera deduit. Cette action est irreversible.' : 'Cette action est irreversible.'}
        variant={confirmAction?.status === 'PAID' ? 'primary' : 'danger'}
        confirmLabel={confirmAction?.status === 'PAID' ? 'Marquer payee' : 'Annuler la facture'}
      />

      {/* Fiscal Validation Error Modal */}
      {fiscalError && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setFiscalError(null)}>
          <div className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/20 animate-scale-in p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FF3B30]/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#FF3B30]" />
              </div>
              <h3 className="font-display text-[17px] font-bold text-[#1D1D1F]">Donnees fiscales incompletes</h3>
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

      {/* Edit Invoice Modal */}
      {editInvoice && (
        <InvoiceEditModal
          invoice={editInvoice}
          open={showEditModal}
          onClose={() => { setShowEditModal(false); setEditInvoice(null); }}
          onSaved={loadInvoices}
        />
      )}
    </div>
  );
}
