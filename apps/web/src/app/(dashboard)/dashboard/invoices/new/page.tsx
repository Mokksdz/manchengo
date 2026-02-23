'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ArrowLeft, Plus, Trash2, CheckCircle, ShoppingCart } from 'lucide-react';
import { authFetch } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Client {
  id: number;
  code: string;
  name: string;
  type: string;
  nif?: string;
}

interface ProductPf {
  id: number;
  code: string;
  name: string;
  priceHt: number;
  unit: string;
}

interface InvoiceLine {
  productPfId: number;
  productName?: string;
  quantity: number;
  unitPriceHt: number;
  lineHt: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const paymentMethods = [
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'VIREMENT', label: 'Virement' },
];

import { calculateTimbreRate } from '@/lib/fiscal-rules';
import { createLogger } from '@/lib/logger';

const log = createLogger('NewInvoice');

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADING STATE
// ═══════════════════════════════════════════════════════════════════════════════

function CreateInvoiceSkeleton() {
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
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="glass-card p-6">
        <Skeleton className="h-6 w-36 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="glass-card p-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function SuccessScreen({ reference, invoiceId: _invoiceId, onViewInvoice, onCreateAnother }: {
  reference: string;
  invoiceId: number;
  onViewInvoice: () => void;
  onCreateAnother: () => void;
}) {
  return (
    <div className="space-y-6 animate-slide-up">
      <button
        onClick={() => onViewInvoice()}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#86868B] hover:text-[#007AFF] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux factures
      </button>

      <div className="glass-card p-12 text-center animate-scale-in">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#34C759]/10 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-[#34C759]" />
        </div>
        <h2 className="text-2xl font-bold text-[#1D1D1F] mb-2">Facture créée avec succès</h2>
        <p className="text-[#86868B] mb-8">
          La facture <span className="font-mono font-semibold text-[#007AFF]">{reference}</span> a été créée en brouillon.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onViewInvoice}
            className="px-6 py-2.5 bg-[#007AFF] text-white text-sm font-semibold rounded-full hover:bg-[#0056D6] shadow-lg shadow-[#007AFF]/25 transition-all active:scale-[0.97]"
          >
            Voir la facture
          </button>
          <button
            onClick={onCreateAnother}
            className="px-6 py-2.5 text-[#007AFF] bg-[#007AFF]/10 text-sm font-semibold rounded-full hover:bg-[#007AFF]/20 transition-all active:scale-[0.97]"
          >
            Créer une autre facture
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE INVOICE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function CreateInvoicePage() {
  const router = useRouter();

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<ProductPf[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Form state
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('ESPECES');
  const [applyTimbre, setApplyTimbre] = useState(true);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state
  const [createdInvoice, setCreatedInvoice] = useState<{ id: number; reference: string } | null>(null);

  // Load clients and products on mount
  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [clientsRes, productsRes] = await Promise.all([
        authFetch('/admin/clients', { credentials: 'include' }),
        authFetch('/admin/stock/pf', { credentials: 'include' }),
      ]);
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
    } catch (error) {
      log.error('Failed to load data:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Line management — sélectionne le premier produit non encore utilisé
  const addLine = () => {
    if (products.length === 0) return;
    const usedIds = new Set(lines.map(l => l.productPfId));
    const availableProduct = products.find(p => !usedIds.has(p.id)) || products[0];
    setLines([...lines, {
      productPfId: availableProduct.id,
      productName: availableProduct.name,
      quantity: 1,
      unitPriceHt: availableProduct.priceHt,
      lineHt: availableProduct.priceHt,
    }]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    if (field === 'productPfId') {
      const product = products.find(p => p.id === value);
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
      const qty = Math.max(1, Math.round(value)); // Force entier >= 1
      newLines[index].quantity = qty;
      newLines[index].lineHt = newLines[index].unitPriceHt * qty;
    } else if (field === 'unitPriceHt') {
      const price = Math.max(0, value); // Force >= 0
      newLines[index].unitPriceHt = price;
      newLines[index].lineHt = price * newLines[index].quantity;
    }
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  // Calculate totals (Algerian fiscal rules - dynamic timbre)
  const totalHt = lines.reduce((sum, l) => sum + l.lineHt, 0);
  const totalTva = Math.round(totalHt * 0.19); // TVA 19%
  const totalTtc = totalHt + totalTva;
  const timbreRate = (applyTimbre && paymentMethod === 'ESPECES') ? calculateTimbreRate(totalTtc) : 0;
  const timbreFiscal = Math.round(totalTtc * timbreRate);
  const netToPay = totalTtc + timbreFiscal;

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || lines.length === 0) {
      setError('Sélectionnez un client et ajoutez au moins une ligne');
      return;
    }
    const invalidLine = lines.find(l => l.quantity <= 0 || l.unitPriceHt <= 0);
    if (invalidLine) {
      setError('Chaque ligne doit avoir une quantité > 0 et un prix unitaire HT > 0');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/admin/invoices', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient,
          paymentMethod,
          applyTimbre,
          lines: lines.map(l => ({
            productPfId: l.productPfId,
            quantity: l.quantity,
            unitPriceHt: l.unitPriceHt,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur lors de la création');
      }
      const created = await res.json();
      setCreatedInvoice({ id: created.id, reference: created.reference });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  // Reset form for creating another invoice
  const resetForm = () => {
    setSelectedClient(null);
    setPaymentMethod('ESPECES');
    setApplyTimbre(true);
    setLines([]);
    setError(null);
    setCreatedInvoice(null);
  };

  // Show success screen
  if (createdInvoice) {
    return (
      <SuccessScreen
        reference={createdInvoice.reference}
        invoiceId={createdInvoice.id}
        onViewInvoice={() => router.push('/dashboard/invoices')}
        onCreateAnother={resetForm}
      />
    );
  }

  // Show loading skeleton
  if (isLoadingData) {
    return (
      <div className="space-y-6 animate-slide-up">
        <button
          onClick={() => router.push('/dashboard/invoices')}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#86868B] hover:text-[#007AFF] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux factures
        </button>
        <CreateInvoiceSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Nouvelle facture"
        subtitle="Créer une nouvelle facture de vente"
        icon={<FileText className="w-5 h-5" />}
        actions={(
          <Button onClick={() => router.push('/dashboard/invoices')} variant="outline">
            <ArrowLeft className="w-4 h-4" />
            Retour aux factures
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

        {/* Client & Payment Method */}
        <div className="glass-card p-6">
          <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#007AFF]/10 to-[#007AFF]/5 flex items-center justify-center">
              <ShoppingCart className="w-3 h-3 text-[#007AFF]" />
            </div>
            Informations générales
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">Client *</label>
              <select
                value={selectedClient || ''}
                onChange={(e) => setSelectedClient(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-black/[0.04] rounded-xl text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
                required
              >
                <option value="">Sélectionner un client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">Mode de paiement *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2.5 border border-black/[0.04] rounded-xl text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
              >
                {paymentMethods.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Timbre Fiscal */}
          {paymentMethod === 'ESPECES' && (
            <label className="flex items-center gap-3 mt-4 p-3 rounded-xl bg-[#FF9500]/5 border border-[#FF9500]/10 cursor-pointer">
              <input
                type="checkbox"
                checked={applyTimbre}
                onChange={(e) => setApplyTimbre(e.target.checked)}
                className="w-4 h-4 rounded border-[#E5E5E5] text-[#007AFF] focus:ring-[#007AFF]/20"
              />
              <span className="text-sm text-[#1D1D1F]">
                Appliquer le timbre fiscal <span className="font-medium text-[#FF9500]">({timbreRate * 100}%)</span>
              </span>
            </label>
          )}
        </div>

        {/* Invoice Lines */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5 flex items-center justify-center">
                <FileText className="w-3 h-3 text-[#34C759]" />
              </div>
              Lignes de facture
            </h2>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#007AFF] bg-[#007AFF]/10 rounded-full hover:bg-[#007AFF]/20 transition-all active:scale-[0.97]"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une ligne
            </button>
          </div>

          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Produit</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider w-24">Quantité</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider w-32">Prix HT (DA)</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider w-32">Total HT</th>
                  <th className="px-4 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-white/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <select
                        value={line.productPfId}
                        onChange={(e) => updateLine(idx, 'productPfId', Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-black/[0.04] rounded-lg text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-black/[0.04] rounded-lg text-right text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                        min={1}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={line.unitPriceHt / 100}
                        onChange={(e) => updateLine(idx, 'unitPriceHt', Math.round(Number(e.target.value) * 100))}
                        className="w-full px-3 py-1.5 border border-black/[0.04] rounded-lg text-right text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                        step="0.01"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-[#1D1D1F]">{formatPrice(line.lineHt)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="p-1.5 rounded-lg text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#AEAEB2]">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Aucune ligne ajoutée</p>
                      <p className="text-xs mt-1">Cliquez sur "Ajouter une ligne" pour commencer</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="glass-card p-6">
          <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4">Récapitulatif</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm py-1">
              <span className="text-[#6E6E73]">Total HT</span>
              <span className="font-medium text-[#1D1D1F]">{formatPrice(totalHt)}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-[#6E6E73]">TVA (19%)</span>
              <span className="font-medium text-[#1D1D1F]">{formatPrice(totalTva)}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-[#6E6E73]">Total TTC</span>
              <span className="font-medium text-[#1D1D1F]">{formatPrice(totalTtc)}</span>
            </div>
            {timbreFiscal > 0 && (
              <div className="flex justify-between text-sm py-1 text-[#FF9500]">
                <span>Timbre fiscal ({timbreRate * 100}%)</span>
                <span className="font-medium">{formatPrice(timbreFiscal)}</span>
              </div>
            )}
            <div className="border-t border-black/[0.06] pt-3 mt-2">
              <div className="flex justify-between text-lg font-bold">
                <span className="text-[#1D1D1F]">Net à payer</span>
                <span className="text-[#007AFF]">{formatPrice(netToPay)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/invoices')}
            className="px-6 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || lines.length === 0 || !selectedClient}
            className="px-6 py-2.5 bg-[#007AFF] text-white rounded-full hover:bg-[#0056D6] disabled:opacity-50 font-semibold transition-all shadow-lg shadow-[#007AFF]/25 active:scale-[0.97]"
          >
            {saving ? 'Création en cours...' : 'Créer la facture'}
          </button>
        </div>
      </form>
    </div>
  );
}
