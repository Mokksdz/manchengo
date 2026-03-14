'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, Plus, Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useFocusTrap, useEscapeKey } from '@/lib/hooks/use-focus-trap';
import { calculateTimbreRate } from '@/lib/fiscal-rules';
import { formatPrice } from '@/lib/format';
import { createLogger } from '@/lib/logger';
import { type Invoice, type Client, type ProductPf, type EditFormLine, paymentMethods } from './types';

const log = createLogger('InvoiceEditModal');

interface InvoiceEditModalProps {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function InvoiceEditModal({
  invoice,
  open,
  onClose,
  onSaved,
}: InvoiceEditModalProps) {
  const [clientId, setClientId] = useState<number | null>(invoice.client.id);
  const [date, setDate] = useState(invoice.date.split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState(invoice.paymentMethod);
  const [lines, setLines] = useState<EditFormLine[]>(
    (invoice.lines || []).map((l) => ({
      productPfId: l.productPfId,
      productName: l.productPf?.name || l.productName,
      quantity: l.quantity,
      unitPriceHt: l.unitPriceHt,
      lineHt: l.lineHt,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<ProductPf[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const modalRef = useFocusTrap<HTMLDivElement>(open);
  const handleClose = useCallback(() => { onClose(); setError(null); }, [onClose]);
  useEscapeKey(handleClose, open);

  // Re-sync state when the invoice prop changes (e.g., opening for a different invoice)
  useEffect(() => {
    if (open) {
      setClientId(invoice.client.id);
      setDate(invoice.date.split('T')[0]);
      setPaymentMethod(invoice.paymentMethod);
      setLines(
        (invoice.lines || []).map((l) => ({
          productPfId: l.productPfId,
          productName: l.productPf?.name || l.productName,
          quantity: l.quantity,
          unitPriceHt: l.unitPriceHt,
          lineHt: l.lineHt,
        }))
      );
      setError(null);
    }
  }, [open, invoice]);

  // Load clients and products for dropdowns
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDataLoading(true);
    Promise.all([
      apiFetch<Client[]>('/admin/clients'),
      apiFetch<ProductPf[]>('/admin/stock/pf'),
    ])
      .then(([clientsData, productsData]) => {
        if (!cancelled) {
          setClients(clientsData);
          setProducts(productsData);
        }
      })
      .catch((err) => {
        log.error('Failed to load edit data', { error: err instanceof Error ? err.message : String(err) });
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  const addLine = () => {
    if (products.length === 0) return;
    const usedIds = new Set(lines.map((l) => l.productPfId));
    const available = products.find((p) => !usedIds.has(p.id)) || products[0];
    setLines([
      ...lines,
      {
        productPfId: available.id,
        productName: available.name,
        quantity: 1,
        unitPriceHt: available.priceHt,
        lineHt: available.priceHt,
      },
    ]);
  };

  const updateLine = (index: number, field: string, value: string | number) => {
    const newLines = [...lines];
    if (field === 'productPfId') {
      const product = products.find((p) => p.id === value);
      if (product) {
        newLines[index] = {
          ...newLines[index],
          productPfId: Number(value),
          productName: product.name,
          unitPriceHt: product.priceHt,
          lineHt: product.priceHt * newLines[index].quantity,
        };
      }
    } else if (field === 'quantity') {
      const qty = Math.max(1, Math.round(Number(value)));
      newLines[index].quantity = qty;
      newLines[index].lineHt = newLines[index].unitPriceHt * qty;
    } else if (field === 'unitPriceHt') {
      const price = Math.max(0, Number(value));
      newLines[index].unitPriceHt = price;
      newLines[index].lineHt = price * newLines[index].quantity;
    }
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  // Totals
  const totalHt = lines.reduce((sum, l) => sum + l.lineHt, 0);
  const totalTva = Math.round(totalHt * 0.19);
  const totalTtc = totalHt + totalTva;
  const timbreRate = paymentMethod === 'ESPECES' ? calculateTimbreRate(totalTtc) : 0;
  const timbreFiscal = Math.round(totalTtc * timbreRate);
  const netToPay = totalTtc + timbreFiscal;

  const handleSubmit = async () => {
    if (!clientId || lines.length === 0) {
      setError('Selectionnez un client et ajoutez au moins une ligne');
      return;
    }
    const invalidLine = lines.find((l) => l.quantity <= 0 || l.unitPriceHt <= 0);
    if (invalidLine) {
      setError('Chaque ligne doit avoir une quantite > 0 et un prix unitaire HT > 0');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch<Invoice>(`/admin/invoices/${invoice.id}/edit`, {
        method: 'PUT',
        body: JSON.stringify({
          clientId,
          date,
          paymentMethod,
          lines: lines.map((l) => ({
            productPfId: l.productPfId,
            quantity: l.quantity,
            unitPriceHt: l.unitPriceHt,
          })),
        }),
      });
      toast.success('Facture modifiee avec succes');
      onClose();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto py-8">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="edit-invoice-title" className="relative w-full max-w-3xl bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/20 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
          <h2 id="edit-invoice-title" className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
            <Pencil className="w-4 h-4 text-[#FF9500]" />
            Modifier la facture
          </h2>
          <button onClick={handleClose} className="p-1 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-[8px]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-[#FF3B30] bg-[#FF3B30]/10 rounded-xl border border-[#FF3B30]/20">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {dataLoading ? (
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
                      value={clientId || ''}
                      onChange={(e) => setClientId(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-black/[0.04] rounded-xl text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
                    >
                      <option value="">Selectionner</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 border border-black/[0.04] rounded-xl text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">Mode de paiement</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
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
                    onClick={addLine}
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
                        <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider w-20">Qte</th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider w-28">Prix HT (DA)</th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider w-28">Total HT</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {lines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-white/40 transition-colors">
                          <td className="px-3 py-2">
                            <select
                              value={line.productPfId}
                              onChange={(e) => updateLine(idx, 'productPfId', Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-black/[0.04] rounded-lg text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={line.quantity}
                              onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                              className="w-full px-2 py-1.5 border border-black/[0.04] rounded-lg text-right text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                              min={1}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={line.unitPriceHt / 100}
                              onChange={(e) => updateLine(idx, 'unitPriceHt', Math.round(Number(e.target.value) * 100))}
                              className="w-full px-2 py-1.5 border border-black/[0.04] rounded-lg text-right text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
                              step="0.01"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-[#1D1D1F]">{formatPrice(line.lineHt)}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              className="p-1 rounded-lg text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {lines.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-[#AEAEB2] text-sm">
                            Aucune ligne — cliquez &quot;Ajouter&quot; pour commencer
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
                    <span className="font-medium">{formatPrice(totalHt)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6E6E73]">TVA (19%)</span>
                    <span className="font-medium">{formatPrice(totalTva)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6E6E73]">Total TTC</span>
                    <span className="font-medium">{formatPrice(totalTtc)}</span>
                  </div>
                  {timbreFiscal > 0 && (
                    <div className="flex justify-between text-sm text-[#FF9500]">
                      <span>Timbre fiscal ({timbreRate * 100}%)</span>
                      <span className="font-medium">{formatPrice(timbreFiscal)}</span>
                    </div>
                  )}
                  <div className="border-t border-black/[0.06] pt-2 mt-2">
                    <div className="flex justify-between font-bold text-base">
                      <span>Net a payer</span>
                      <span className="text-[#007AFF]">{formatPrice(netToPay)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className="px-5 py-2 text-sm font-medium text-[#86868B] hover:bg-black/5 rounded-full transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || lines.length === 0 || !clientId}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#FF9500] rounded-full hover:bg-[#E68600] disabled:opacity-50 transition-all shadow-lg shadow-[#FF9500]/25"
                >
                  {saving ? (
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
  );
}
