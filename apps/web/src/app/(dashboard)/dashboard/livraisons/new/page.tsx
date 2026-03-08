'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, ArrowLeft, CheckCircle, Loader2, MapPin, Calendar, FileText } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

const log = createLogger('NewBL');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface InvoiceForBL {
  id: number;
  reference: string;
  date: string;
  status: string;
  netToPay: number;
  client: { id: number; name: string; code?: string; address?: string };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADING STATE
// ═══════════════════════════════════════════════════════════════════════════════

function CreateBLSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      <div className="glass-card p-6 space-y-4">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="glass-card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function SuccessScreen({ reference, onViewList, onCreateAnother }: {
  reference: string;
  onViewList: () => void;
  onCreateAnother: () => void;
}) {
  return (
    <div className="space-y-6 animate-slide-up">
      <button
        onClick={onViewList}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#86868B] hover:text-[#007AFF] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux bons de livraison
      </button>

      <div className="glass-card p-12 text-center animate-scale-in">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#34C759]/10 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-[#34C759]" />
        </div>
        <h2 className="text-2xl font-bold text-[#1D1D1F] mb-2">Bon de livraison créé avec succès</h2>
        <p className="text-[#86868B] mb-8">
          Le bon de livraison <span className="font-mono font-semibold text-[#EC7620]">{reference}</span> a été créé.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onViewList}
            className="px-6 py-2.5 bg-[#EC7620] text-white text-sm font-semibold rounded-full hover:bg-[#D06A1A] shadow-lg shadow-[#EC7620]/25 transition-all active:scale-[0.97]"
          >
            Voir les bons de livraison
          </button>
          <button
            onClick={onCreateAnother}
            className="px-6 py-2.5 text-[#EC7620] bg-[#EC7620]/10 text-sm font-semibold rounded-full hover:bg-[#EC7620]/20 transition-all active:scale-[0.97]"
          >
            Créer un autre BL
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE BL PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function CreateBLPage() {
  const router = useRouter();

  // Data
  const [invoices, setInvoices] = useState<InvoiceForBL[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Form state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state
  const [createdBL, setCreatedBL] = useState<{ id: string; reference: string } | null>(null);

  // Load validated invoices on mount
  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const result = await apiFetch<{ data: InvoiceForBL[]; meta: { total: number } }>('/admin/invoices?status=VALIDATED&limit=100');
      setInvoices(result.data || []);
    } catch (err) {
      log.error('Failed to load invoices:', err);
      setError('Impossible de charger les factures validées');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle invoice selection — pre-fill address from client
  const handleSelectInvoice = (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId);
    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice?.client?.address) {
      setDeliveryAddress(invoice.client.address);
    } else {
      setDeliveryAddress('');
    }
  };

  // Selected invoice info
  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) {
      setError('Veuillez sélectionner une facture');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string; reference: string }>('/deliveries', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: selectedInvoiceId,
          scheduledDate: scheduledDate || undefined,
          deliveryAddress: deliveryAddress || undefined,
          deliveryNotes: deliveryNotes || undefined,
        }),
      });
      setCreatedBL({ id: created.id, reference: created.reference });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  // Reset form for creating another BL
  const resetForm = () => {
    setSelectedInvoiceId(null);
    setScheduledDate('');
    setDeliveryAddress('');
    setDeliveryNotes('');
    setError(null);
    setCreatedBL(null);
    loadData(); // Reload invoices to get fresh list
  };

  // Show success screen
  if (createdBL) {
    return (
      <SuccessScreen
        reference={createdBL.reference}
        onViewList={() => router.push('/dashboard/livraisons')}
        onCreateAnother={resetForm}
      />
    );
  }

  // Show loading skeleton
  if (isLoadingData) {
    return (
      <div className="space-y-6 animate-slide-up">
        <button
          onClick={() => router.push('/dashboard/livraisons')}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#86868B] hover:text-[#007AFF] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux bons de livraison
        </button>
        <CreateBLSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Nouveau Bon de Livraison"
        subtitle="Créer un bon de livraison à partir d'une facture validée"
        icon={<Truck className="w-5 h-5" />}
        actions={(
          <Button onClick={() => router.push('/dashboard/livraisons')} variant="outline">
            <ArrowLeft className="w-4 h-4" />
            Retour aux bons de livraison
          </Button>
        )}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 text-sm text-[#FF3B30] bg-[#FF3B30]/10 rounded-[28px] border border-[#FF3B30]/20 animate-scale-in">
            {error}
          </div>
        )}

        {/* Invoice Selection */}
        <div className="glass-card p-6">
          <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#EC7620]/10 to-[#EC7620]/5 flex items-center justify-center">
              <FileText className="w-3 h-3 text-[#EC7620]" />
            </div>
            Facture source
          </h2>

          <div>
            <label htmlFor="invoice-select" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">
              Facture validée <span className="text-[#FF3B30]">*</span>
            </label>
            {invoices.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#FF9500]/5 border border-[#FF9500]/10 text-sm text-[#86868B]">
                <p className="font-medium text-[#FF9500]">Aucune facture validée disponible</p>
                <p className="mt-1">Il faut d&apos;abord créer et valider une facture avant de pouvoir créer un bon de livraison.</p>
              </div>
            ) : (
              <select
                id="invoice-select"
                value={selectedInvoiceId || ''}
                onChange={(e) => handleSelectInvoice(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-black/[0.04] rounded-xl text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
                required
              >
                <option value="">-- Sélectionner une facture --</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.reference} — {inv.client.name} — {formatPrice(inv.netToPay)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected invoice summary */}
          {selectedInvoice && (
            <div className="mt-4 p-4 rounded-xl bg-[#EC7620]/5 border border-[#EC7620]/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#1D1D1F]">{selectedInvoice.client.name}</p>
                  {selectedInvoice.client.code && (
                    <p className="text-[13px] text-[#86868B]">{selectedInvoice.client.code}</p>
                  )}
                  {selectedInvoice.client.address && (
                    <p className="text-[13px] text-[#86868B] flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {selectedInvoice.client.address}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[#EC7620] text-lg">{formatPrice(selectedInvoice.netToPay)}</p>
                  <p className="text-[13px] text-[#86868B]">{formatDate(selectedInvoice.date)}</p>
                  <span className="font-mono text-xs text-[#86868B]">{selectedInvoice.reference}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Delivery Details */}
        <div className="glass-card p-6">
          <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5 flex items-center justify-center">
              <Truck className="w-3 h-3 text-[#34C759]" />
            </div>
            Détails de livraison
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scheduled date */}
            <div>
              <label htmlFor="scheduled-date" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Date prévue de livraison
              </label>
              <input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-black/[0.04] rounded-xl text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
              />
            </div>

            {/* Delivery address */}
            <div>
              <label htmlFor="delivery-address" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">
                <MapPin className="w-3.5 h-3.5 inline mr-1" />
                Adresse de livraison
              </label>
              <input
                id="delivery-address"
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Adresse du client (auto-remplie)"
                className="w-full px-4 py-2.5 border border-black/[0.04] rounded-xl text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all placeholder:text-[#86868B]"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label htmlFor="delivery-notes" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">
              Notes de livraison
            </label>
            <textarea
              id="delivery-notes"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Instructions spéciales pour le livreur..."
              rows={3}
              className="w-full px-4 py-2.5 border border-black/[0.04] rounded-xl text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all placeholder:text-[#86868B] resize-none"
            />
          </div>
        </div>

        {/* Recap */}
        {selectedInvoice && (
          <div className="glass-card p-6">
            <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4">Récapitulatif</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm py-1">
                <span className="text-[#6E6E73]">Facture</span>
                <span className="font-mono font-medium text-[#1D1D1F]">{selectedInvoice.reference}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-[#6E6E73]">Client</span>
                <span className="font-medium text-[#1D1D1F]">{selectedInvoice.client.name}</span>
              </div>
              {deliveryAddress && (
                <div className="flex justify-between text-sm py-1">
                  <span className="text-[#6E6E73]">Adresse</span>
                  <span className="font-medium text-[#1D1D1F] text-right max-w-[60%]">{deliveryAddress}</span>
                </div>
              )}
              {scheduledDate && (
                <div className="flex justify-between text-sm py-1">
                  <span className="text-[#6E6E73]">Date prévue</span>
                  <span className="font-medium text-[#1D1D1F]">{formatDate(scheduledDate)}</span>
                </div>
              )}
              <div className="border-t border-black/[0.06] pt-3 mt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-[#1D1D1F]">Montant</span>
                  <span className="text-[#EC7620]">{formatPrice(selectedInvoice.netToPay)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/livraisons')}
            className="px-6 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || !selectedInvoiceId}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#EC7620] text-white rounded-full hover:bg-[#D06A1A] disabled:opacity-50 font-semibold transition-all shadow-lg shadow-[#EC7620]/25 active:scale-[0.97]"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Création en cours...' : 'Créer le bon de livraison'}
          </button>
        </div>
      </form>
    </div>
  );
}
