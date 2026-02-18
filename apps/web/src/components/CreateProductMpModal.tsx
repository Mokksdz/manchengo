'use client';

import { authFetch } from '@/lib/api';

import { useState, useEffect } from 'react';
import { X, Package, Loader2, AlertCircle, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'RAW_MATERIAL', label: 'Matière première' },
  { value: 'PACKAGING', label: 'Emballage' },
  { value: 'ADDITIVE', label: 'Additif' },
  { value: 'CONSUMABLE', label: 'Consommable' },
];

const UNITS = [
  { value: 'kg', label: 'Kilogramme (kg)' },
  { value: 'L', label: 'Litre (L)' },
  { value: 'g', label: 'Gramme (g)' },
  { value: 'mL', label: 'Millilitre (mL)' },
  { value: 'unité', label: 'Unité' },
  { value: 'm³', label: 'Mètre cube (m³)' },
];

const TVA_RATES = [
  { value: 0, label: '0% (Exonéré)' },
  { value: 9, label: '9% (Réduit)' },
  { value: 19, label: '19% (Standard)' },
];

export interface ProductMp {
  id: number;
  code: string;
  name: string;
  unit: string;
  category: string;
  isStockTracked?: boolean;
  defaultTvaRate?: number;
}

interface CreateProductMpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (product: ProductMp) => void;
}

export function CreateProductMpModal({ isOpen, onClose, onCreated }: CreateProductMpModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCode, setNextCode] = useState<string>('MP-XXX');
  
  // Form state
  const [form, setForm] = useState({
    name: '',
    unit: 'kg',
    category: 'RAW_MATERIAL',
    minStock: 0,
    defaultTvaRate: 19,
    isStockTracked: true,
  });

  // Fetch next code on mount
  useEffect(() => {
    if (isOpen) {
      fetchNextCode();
      // Reset form
      setForm({
        name: '',
        unit: 'kg',
        category: 'RAW_MATERIAL',
        minStock: 0,
        defaultTvaRate: 19,
        isStockTracked: true,
      });
      setError(null);
    }
  }, [isOpen]);

  const fetchNextCode = async () => {
    try {
      const res = await authFetch('/products/mp/next-code', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setNextCode(data.code);
      }
    } catch (err) {
      console.error('Failed to fetch next code:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      setError('Le nom est obligatoire');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await authFetch('/products/mp', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          unit: form.unit,
          category: form.category,
          minStock: form.minStock,
          defaultTvaRate: form.defaultTvaRate,
          isStockTracked: form.isStockTracked,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur lors de la création');
      }

      const newProduct = await res.json();
      onCreated(newProduct);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Erreur inconnue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative glass-card rounded-[18px] w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-[18px] border-b border-white/70 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#F5F5F5] rounded-[10px]">
                <Package className="w-5 h-5 text-[#6E6E73]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1D1D1F]">Nouvel Article MP</h2>
                <p className="text-sm text-[#86868B]">Création rapide sans quitter la réception</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#86868B] hover:text-[#1D1D1F]" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Code (auto-generated) */}
          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
              Code article
            </label>
            <input
              type="text"
              value={nextCode}
              disabled
              className="w-full px-3 py-2 bg-[#FAFAFA] border border-[#F0F0F0] rounded-lg text-[#86868B] font-mono"
            />
            <p className="text-xs text-[#86868B] mt-1">Généré automatiquement</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Lait cru, Sel fin, Film étirable..."
              className="w-full px-3 py-2 border border-[#F0F0F0] rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              autoFocus
            />
          </div>

          {/* Unit & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                Unité <span className="text-red-500">*</span>
              </label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2 border border-[#F0F0F0] rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              >
                {UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                Catégorie
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-[#F0F0F0] rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Min Stock & TVA */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                Stock minimum
              </label>
              <input
                type="number"
                min="0"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#F0F0F0] rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                TVA par défaut
              </label>
              <select
                value={form.defaultTvaRate}
                onChange={(e) => setForm({ ...form, defaultTvaRate: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#F0F0F0] rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              >
                {TVA_RATES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock Tracked Toggle */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-3">
              <Droplets className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-[#1D1D1F]">Suivi du stock</p>
                <p className="text-xs text-[#6E6E73]">Désactiver pour l'eau, électricité, etc.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.isStockTracked}
                onChange={(e) => setForm({ ...form, isStockTracked: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#E5E5E5] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#E5E5E5] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {!form.isStockTracked && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                ⚠️ Cet article ne sera pas tracé en stock. Utilisez cette option uniquement pour les 
                ressources comme l'eau ou l'électricité.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#F0F0F0]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#F0F0F0] text-[#1D1D1F] rounded-lg hover:bg-[#FAFAFA] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !form.name.trim()}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white transition-colors",
                isSubmitting || !form.name.trim()
                  ? "bg-[#D1D1D6] cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Créer l'article
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
