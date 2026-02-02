'use client';

import { memo, useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, Truck, Calendar, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api';
import { SupplierModal, type Supplier } from './SupplierModal';
import { ProductMpCombobox, type ProductMp } from '@/components/ProductMpCombobox';
import { CreateProductMpModal } from '@/components/CreateProductMpModal';

export interface StockMpItem {
  productId: number;
  id?: number;
  code: string;
  name: string;
  unit: string;
  minStock: number;
}

interface ReceptionLine {
  id: string;
  productMpId: number;
  productName: string;
  productUnit: string;
  quantity: number;
  unitCost: number;
  tvaRate: 0 | 9 | 19;
}

const TVA_RATES = [
  { value: 0, label: '0%' },
  { value: 9, label: '9%' },
  { value: 19, label: '19%' },
] as const;

interface ReceptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  suppliers: Supplier[];
  products: StockMpItem[];
  onSupplierCreated: (supplier: Supplier) => void;
  isAdmin: boolean;
}

export const ReceptionModal = memo(function ReceptionModal({ isOpen, onClose, onSuccess, suppliers, products, onSupplierCreated, isAdmin }: ReceptionModalProps) {
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [blNumber, setBlNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<ReceptionLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showCreateMpModal, setShowCreateMpModal] = useState(false);
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);
  const [localProducts, setLocalProducts] = useState<StockMpItem[]>(products);

  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  const handleSupplierCreated = (newSupplier: Supplier) => {
    onSupplierCreated(newSupplier);
    setSupplierId(newSupplier.id);
  };

  const handleMpCreated = (newProduct: ProductMp) => {
    const newStockItem: StockMpItem = {
      productId: newProduct.id,
      id: newProduct.id,
      code: newProduct.code,
      name: newProduct.name,
      unit: newProduct.unit,
      minStock: 0,
    };
    setLocalProducts(prev => [...prev, newStockItem]);
    
    if (pendingLineId) {
      setLines(prev => prev.map(line => {
        if (line.id === pendingLineId) {
          return {
            ...line,
            productMpId: newProduct.id,
            productName: newProduct.name,
            productUnit: newProduct.unit,
            tvaRate: (newProduct.defaultTvaRate || 19) as 0 | 9 | 19,
          };
        }
        return line;
      }));
      setPendingLineId(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSupplierId('');
      setBlNumber('');
      setDate(new Date().toISOString().slice(0, 10));
      setLines([]);
      setError(null);
      setLocalProducts(products);
    }
  }, [isOpen, products]);

  const addLine = () => {
    if (products.length === 0) return;
    const firstProduct = products[0];
    setLines([...lines, {
      id: crypto.randomUUID(),
      productMpId: firstProduct.productId || firstProduct.id || 0,
      productName: firstProduct.name,
      productUnit: firstProduct.unit,
      quantity: 1,
      unitCost: 0,
      tvaRate: 19,
    }]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateLine = (id: string, field: keyof ReceptionLine, value: any) => {
    setLines(lines.map(line => {
      if (line.id !== id) return line;
      
      if (field === 'productMpId') {
        const product = localProducts.find(p => (p.productId || p.id) === value);
        return {
          ...line,
          productMpId: value,
          productName: product?.name || '',
          productUnit: product?.unit || '',
        };
      }
      
      return { ...line, [field]: value };
    }));
  };

  const removeLine = (id: string) => {
    setLines(lines.filter(line => line.id !== id));
  };

  const canSubmit = supplierId !== '' && lines.length > 0 && 
    lines.every(l => l.quantity > 0 && l.unitCost > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await authFetch('/stock/mp/receptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: Number(supplierId),
          date: new Date(date).toISOString(),
          blNumber: blNumber || undefined,
          lines: lines.map(l => ({
            productMpId: l.productMpId,
            quantity: l.quantity,
            unitCost: Math.round(l.unitCost * 100),
            tvaRate: l.tvaRate,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur lors de la création de la réception');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Erreur inconnue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="reception-modal-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-[16px] shadow-apple-elevated w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="reception-modal-title" className="text-lg font-semibold text-[#1D1D1F]">Nouvelle Réception MP</h2>
              <p className="text-sm text-blue-100">Enregistrer une livraison fournisseur</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#86868B] hover:text-[#1D1D1F]" aria-label="Fermer">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                Fournisseur <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                  className="flex-1 px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-[#007AFF]"
                >
                  <option value="">Sélectionner...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowSupplierModal(true)}
                    className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
                    title="Créer un fournisseur"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">N° BL</label>
              <input
                type="text"
                value={blNumber}
                onChange={(e) => setBlNumber(e.target.value)}
                placeholder="BL-2026-001"
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-[#007AFF]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-[#007AFF]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-[#1D1D1F]">Lignes de réception</h3>
              <button
                type="button"
                onClick={addLine}
                disabled={localProducts.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Ajouter ligne
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="bg-[#FAFAFA] rounded-lg p-8 text-center text-[#86868B]">
                <Truck className="w-12 h-12 mx-auto mb-2 text-[#D1D1D6]" />
                <p>Aucune ligne. Cliquez sur "Ajouter ligne".</p>
              </div>
            ) : (
              <div className="border border-[#F0F0F0] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#FAFAFA]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-[#6E6E73]">Article MP</th>
                      <th className="px-3 py-2 text-right font-medium text-[#6E6E73] w-24">Qté</th>
                      <th className="px-3 py-2 text-right font-medium text-[#6E6E73] w-32">PU HT (DA)</th>
                      <th className="px-3 py-2 text-center font-medium text-[#6E6E73] w-20">TVA</th>
                      <th className="px-3 py-2 text-right font-medium text-[#6E6E73] w-32">Total TTC</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-3 py-2">
                          <ProductMpCombobox
                            products={localProducts.map(p => ({
                              id: p.productId || p.id || 0,
                              code: p.code,
                              name: p.name,
                              unit: p.unit,
                              category: 'RAW_MATERIAL',
                            }))}
                            value={line.productMpId}
                            onChange={(id) => updateLine(line.id, 'productMpId', id)}
                            onCreateNew={() => {
                              setPendingLineId(line.id);
                              setShowCreateMpModal(true);
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => updateLine(line.id, 'quantity', Number(e.target.value))}
                            min={0.01}
                            step={0.01}
                            className="w-full px-2 py-1 border border-[#E5E5E5] rounded text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.unitCost}
                            onChange={(e) => updateLine(line.id, 'unitCost', Number(e.target.value))}
                            min={0}
                            step={0.01}
                            className="w-full px-2 py-1 border border-[#E5E5E5] rounded text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={line.tvaRate}
                            onChange={(e) => updateLine(line.id, 'tvaRate', Number(e.target.value))}
                            className="w-full px-2 py-1 border border-[#E5E5E5] rounded text-center"
                          >
                            {TVA_RATES.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {(line.quantity * line.unitCost * (1 + line.tvaRate / 100)).toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#FAFAFA]">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right font-semibold text-[#1D1D1F]">Total TTC:</td>
                      <td className="px-3 py-2 text-right text-sm font-bold text-[#1D1D1F]">
                        {lines.reduce((sum, l) => sum + (l.quantity * l.unitCost * (1 + l.tvaRate / 100)), 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-[#F0F0F0] bg-[#FAFAFA]">
          <p className="text-sm text-[#86868B]">
            {lines.length} ligne(s) • {lines.reduce((s, l) => s + l.quantity, 0)} unités totales
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-[#1D1D1F] bg-white border border-[#E5E5E5] rounded-lg hover:bg-[#FAFAFA]">
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium",
                canSubmit && !isSubmitting
                  ? "bg-[#1D1D1F] text-white hover:bg-[#333336]"
                  : "bg-[#D1D1D6] text-[#86868B] cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Valider la réception
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <SupplierModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSuccess={handleSupplierCreated}
      />

      <CreateProductMpModal
        isOpen={showCreateMpModal}
        onClose={() => {
          setShowCreateMpModal(false);
          setPendingLineId(null);
        }}
        onCreated={handleMpCreated}
      />
    </div>
  );
});
