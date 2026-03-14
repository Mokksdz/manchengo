'use client';

import { useCallback } from 'react';
import { X, Pencil, FileDown } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useFocusTrap, useEscapeKey } from '@/lib/hooks/use-focus-trap';
import { calculateTimbreRatePercent } from '@/lib/fiscal-rules';
import { type Invoice, getStatusStyle, getStatusLabel, paymentMethods } from './types';

interface InvoiceDetailModalProps {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onEdit: (invoice: Invoice) => void;
  onChangeStatus: (id: number, status: string) => void;
  onDownloadPdf: (id: number, reference?: string) => void;
}

export function InvoiceDetailModal({
  invoice,
  open,
  onClose,
  onEdit,
  onChangeStatus,
  onDownloadPdf,
}: InvoiceDetailModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(open);
  const handleClose = useCallback(() => onClose(), [onClose]);
  useEscapeKey(handleClose, open);

  if (!open) return null;

  const hasRemise = invoice.lines?.some(l => l.remise && l.remise > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto py-8">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="detail-invoice-title" className="relative w-full bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/20 animate-scale-in max-w-3xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
          <div>
            <h2 id="detail-invoice-title" className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Facture {invoice.reference}</h2>
            <span className={`glass-status-pill inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(invoice.status)}`}>
              {getStatusLabel(invoice.status)}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-[8px]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="glass-card p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-1">Client</h3>
                <p className="font-medium">{invoice.client.name}</p>
                <p className="text-[13px] text-[#86868B]">{invoice.client.code}</p>
                {invoice.client.nif && (
                  <p className="text-[13px] text-[#86868B]">NIF: {invoice.client.nif}</p>
                )}
              </div>
              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-1">Date</h3>
                <p>{formatDate(invoice.date)}</p>
                <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-1 mt-2">Mode de paiement</h3>
                <p>{paymentMethods.find(m => m.value === invoice.paymentMethod)?.label || invoice.paymentMethod}</p>
              </div>
            </div>
          </div>

          {invoice.lines && invoice.lines.length > 0 && (
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Lignes</h3>
              <div className="glass-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
                    <tr>
                      <th className="px-3 py-2 text-left">Produit</th>
                      <th className="px-3 py-2 text-right">Qte</th>
                      <th className="px-3 py-2 text-right">Prix HT</th>
                      {hasRemise && (
                        <th className="px-3 py-2 text-right">Remise</th>
                      )}
                      <th className="px-3 py-2 text-right">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoice.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{line.productPf?.name || line.productName}</td>
                        <td className="px-3 py-2 text-right">{line.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(line.unitPriceHt)}</td>
                        {hasRemise && (
                          <td className="px-3 py-2 text-right text-[#FF9500]">
                            {line.remise && line.remise > 0 ? `-${formatCurrency(line.remise)}` : '-'}
                          </td>
                        )}
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
              <span>{formatCurrency(invoice.totalHt)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span>TVA (19%)</span>
              <span>{formatCurrency(invoice.totalTva)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span>Total TTC</span>
              <span>{formatCurrency(invoice.totalTtc)}</span>
            </div>
            {invoice.timbreFiscal > 0 && (
              <div className="flex justify-between text-sm mb-1 text-[#FF9500]">
                <span>Timbre fiscal ({invoice.timbreRatePercent || calculateTimbreRatePercent(invoice.totalTtc)}%)</span>
                <span>{formatCurrency(invoice.timbreFiscal)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t border-black/[0.04] pt-2 mt-2">
              <span>Net a payer</span>
              <span>{formatCurrency(invoice.netToPay)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-black/[0.04]">
            <div className="flex gap-2 flex-wrap">
              {invoice.status === 'DRAFT' && (
                <>
                  <button
                    onClick={() => onEdit(invoice)}
                    className="px-4 py-2 bg-[#FF9500]/10 text-[#FF9500] text-sm rounded-full hover:bg-[#FF9500]/20 font-semibold transition-all"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5" />
                      Modifier
                    </span>
                  </button>
                  <button
                    onClick={() => onChangeStatus(invoice.id, 'VALIDATED')}
                    className="px-4 py-2 bg-[#007AFF] text-white text-sm rounded-full hover:bg-[#0056D6] font-semibold transition-all shadow-lg shadow-[#007AFF]/25"
                  >
                    Valider
                  </button>
                  <button
                    onClick={() => onChangeStatus(invoice.id, 'CANCELLED')}
                    className="px-4 py-2 bg-[#FF3B30]/10 text-[#FF3B30] text-sm rounded-full hover:bg-[#FF3B30]/20 font-semibold transition-all"
                  >
                    Annuler facture
                  </button>
                </>
              )}
              {invoice.status === 'VALIDATED' && (
                <>
                  <button
                    onClick={() => onChangeStatus(invoice.id, 'PAID')}
                    className="px-4 py-2 bg-[#34C759] text-white text-sm rounded-full hover:bg-[#2DB44D] font-semibold transition-all shadow-lg shadow-[#34C759]/25"
                  >
                    Marquer payee
                  </button>
                  <button
                    onClick={() => onChangeStatus(invoice.id, 'CANCELLED')}
                    className="px-4 py-2 bg-[#FF3B30]/10 text-[#FF3B30] text-sm rounded-full hover:bg-[#FF3B30]/20 font-semibold transition-all"
                  >
                    Annuler facture
                  </button>
                </>
              )}
              {invoice.status === 'PARTIALLY_PAID' && (
                <>
                  <button
                    onClick={() => onChangeStatus(invoice.id, 'PAID')}
                    className="px-4 py-2 bg-[#34C759] text-white text-sm rounded-full hover:bg-[#2DB44D] font-semibold transition-all shadow-lg shadow-[#34C759]/25"
                  >
                    Marquer payee
                  </button>
                  <button
                    onClick={() => onChangeStatus(invoice.id, 'CANCELLED')}
                    className="px-4 py-2 bg-[#FF3B30]/10 text-[#FF3B30] text-sm rounded-full hover:bg-[#FF3B30]/20 font-semibold transition-all"
                  >
                    Annuler facture
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => onDownloadPdf(invoice.id, invoice.reference)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 text-[#86868B] text-sm rounded-full hover:bg-black/10 font-medium transition-all"
            >
              <FileDown className="w-4 h-4" />
              Telecharger PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
