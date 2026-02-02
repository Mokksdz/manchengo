'use client';

import { X, Plus, Save } from 'lucide-react';
import {
  type ProductPf,
  type StockMp,
  type NewRecipeForm,
  type NewIngredientForm,
} from './recettes-types';

// ═══════════════════════════════════════════════════════════════════════════════
// Create Recipe Modal
// ═══════════════════════════════════════════════════════════════════════════════

interface CreateRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  productsPf: ProductPf[];
  formData: NewRecipeForm;
  onFormChange: (data: NewRecipeForm) => void;
  onSubmit: () => void;
}

export function CreateRecipeModal({
  isOpen,
  onClose,
  productsPf,
  formData,
  onFormChange,
  onSubmit,
}: CreateRecipeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-[20px] shadow-apple-elevated w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
          <h2 className="text-lg font-semibold text-[#1D1D1F]">Nouvelle recette</h2>
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#86868B]" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Produit fini (PF) *</label>
            <select
              value={formData.productPfId}
              onChange={(e) => {
                const pfId = parseInt(e.target.value);
                const pf = productsPf.find(p => p.id === pfId);
                onFormChange({
                  ...formData,
                  productPfId: pfId,
                  name: pf ? `Recette ${pf.name}` : '',
                });
              }}
              className="w-full rounded-[14px] border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 px-3 py-2"
            >
              <option value={0}>-- S\u00e9lectionner un PF --</option>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {productsPf.map((pf: any) => (
                <option key={pf.id || pf.productId} value={pf.id || pf.productId}>
                  {pf.code} - {pf.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Nom de la recette *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              placeholder="Ex: Recette Manchego 400g"
              className="w-full rounded-[14px] border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Batch (grammes)</label>
              <input
                type="number"
                value={formData.batchWeight}
                onChange={(e) => onFormChange({ ...formData, batchWeight: parseInt(e.target.value) || 0 })}
                className="w-full rounded-[14px] border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 px-3 py-2"
              />
              <p className="text-xs text-[#86868B] mt-1">{(formData.batchWeight / 1000).toFixed(1)} kg</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Sortie (unit\u00e9s)</label>
              <input
                type="number"
                value={formData.outputQuantity}
                onChange={(e) => onFormChange({ ...formData, outputQuantity: parseInt(e.target.value) || 0 })}
                className="w-full rounded-[14px] border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 px-3 py-2"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-black/[0.04]">
          <button onClick={onClose} className="glass-btn px-4 py-2 rounded-full text-[13px] text-[#6E6E73]">
            Annuler
          </button>
          <button onClick={onSubmit} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-[#333336] transition-all font-medium text-[13px]">
            <Save className="w-4 h-4" />
            Cr\u00e9er la recette
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Add Ingredient Modal
// ═══════════════════════════════════════════════════════════════════════════════

interface AddIngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockMp: StockMp[];
  formData: NewIngredientForm;
  onFormChange: (data: NewIngredientForm) => void;
  onSubmit: () => void;
}

export function AddIngredientModal({
  isOpen,
  onClose,
  stockMp,
  formData,
  onFormChange,
  onSubmit,
}: AddIngredientModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-[20px] shadow-apple-elevated w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
          <h2 className="text-lg font-semibold text-[#1D1D1F]">Ajouter un ingr\u00e9dient</h2>
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#86868B]" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Mati\u00e8re premi\u00e8re (MP) *</label>
            <select
              value={formData.productMpId}
              onChange={(e) => {
                const mpId = parseInt(e.target.value);
                const mp = stockMp.find(s => s.productId === mpId);
                onFormChange({
                  ...formData,
                  productMpId: mpId,
                  unit: mp?.unit || 'kg',
                });
              }}
              className="w-full rounded-[14px] border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 px-3 py-2"
            >
              <option value={0}>-- S\u00e9lectionner une MP --</option>
              {stockMp.map((mp) => (
                <option key={mp.productId} value={mp.productId}>
                  {mp.code} - {mp.name} ({mp.unit}) - Stock: {mp.currentStock}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Quantit\u00e9 *</label>
              <input
                type="number"
                step="0.1"
                value={formData.quantity || ''}
                onChange={(e) => onFormChange({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                placeholder="Ex: 100"
                className="w-full rounded-[14px] border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Unit\u00e9</label>
              <select
                value={formData.unit}
                onChange={(e) => onFormChange({ ...formData, unit: e.target.value })}
                className="w-full rounded-[14px] border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 px-3 py-2"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
                <option value="unit\u00e9">unit\u00e9</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-black/[0.04]">
          <button onClick={onClose} className="glass-btn px-4 py-2 rounded-full text-[13px] text-[#6E6E73]">
            Annuler
          </button>
          <button onClick={onSubmit} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-[#333336] transition-all font-medium text-[13px]">
            <Plus className="w-4 h-4" />
            Ajouter l&apos;ingr\u00e9dient
          </button>
        </div>
      </div>
    </div>
  );
}
