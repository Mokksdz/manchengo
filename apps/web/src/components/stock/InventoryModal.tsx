'use client';

import { memo, useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api';

export interface StockMpItem {
  productId: number;
  id?: number;
  code: string;
  name: string;
  unit: string;
  totalStock?: number;
  currentStock?: number;
  minStock: number;
  status?: 'OK' | 'ALERTE' | 'RUPTURE';
  impactProduction?: number;
}

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: StockMpItem | null;
}

export const InventoryModal = memo(function InventoryModal({ isOpen, onClose, onSuccess, product }: InventoryModalProps) {
  const [physicalQuantity, setPhysicalQuantity] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theoreticalStock = product?.currentStock ?? product?.totalStock ?? 0;
  const difference = physicalQuantity - theoreticalStock;

  useEffect(() => {
    if (isOpen && product) {
      setPhysicalQuantity(theoreticalStock);
      setReason('');
      setError(null);
    }
  }, [isOpen, product, theoreticalStock]);

  const canSubmit = reason.trim().length >= 10 && physicalQuantity >= 0;

  const handleSubmit = async () => {
    if (!canSubmit || !product) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await authFetch('/stock/mp/inventory', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.productId || product.id,
          physicalQuantity,
          reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur lors de l\'ajustement');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Erreur inconnue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative glass-card rounded-[18px] w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/70 bg-white/70 backdrop-blur-[18px]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 id="inventory-modal-title" className="text-lg font-semibold text-[#1D1D1F]">Inventaire Stock</h2>
              <p className="text-sm text-[#86868B]">Action auditée - ADMIN</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#86868B] hover:text-[#1D1D1F]" aria-label="Fermer">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="bg-[#FAFAFA] rounded-lg p-4">
            <p className="font-medium text-[#1D1D1F]">{product.name}</p>
            <p className="text-sm text-[#86868B]">{product.code}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#1D1D1F]">{theoreticalStock}</span>
              <span className="text-[#86868B]">{product.unit} (stock théorique)</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
              Stock physique réel <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={physicalQuantity}
                onChange={(e) => setPhysicalQuantity(Number(e.target.value))}
                min={0}
                step={1}
                className="flex-1 px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              <span className="text-[#86868B]">{product.unit}</span>
            </div>
          </div>

          {difference !== 0 && (
            <div className={cn(
              "rounded-lg p-4 text-center",
              difference > 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
            )}>
              <p className={cn(
                "text-2xl font-bold",
                difference > 0 ? "text-green-600" : "text-red-600"
              )}>
                {difference > 0 ? '+' : ''}{difference} {product.unit}
              </p>
              <p className={cn(
                "text-sm mt-1",
                difference > 0 ? "text-green-700" : "text-red-700"
              )}>
                {difference > 0 ? 'Ajustement IN (surplus)' : 'Ajustement OUT (manquant)'}
              </p>
            </div>
          )}

          {difference === 0 && physicalQuantity === theoreticalStock && (
            <div className="bg-[#FAFAFA] rounded-lg p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-[#6E6E73]">Stock conforme - aucun ajustement nécessaire</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
              Motif de l'ajustement <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Inventaire physique mensuel, casse constatée..."
              rows={2}
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <p className="text-xs text-[#86868B] mt-1">Minimum 10 caractères ({reason.trim().length}/10)</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Cette action est <strong>auditée</strong> et créera un mouvement de stock traçable.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#F0F0F0] bg-[#FAFAFA]">
          <button onClick={onClose} className="px-4 py-2 text-[#1D1D1F] bg-white border border-[#E5E5E5] rounded-lg hover:bg-[#FAFAFA]">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting || difference === 0}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium",
              canSubmit && !isSubmitting && difference !== 0
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
                Confirmer l'ajustement
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
