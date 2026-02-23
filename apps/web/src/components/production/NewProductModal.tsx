'use client';

import { useState, useEffect } from 'react';
import { Plus, AlertTriangle, Check } from 'lucide-react';
import { authFetch } from '@/lib/api';

interface NewProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewProductModal({ isOpen, onClose, onSuccess }: NewProductModalProps) {
  const [form, setForm] = useState({ code: '', name: '', unit: 'unité' });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // Réinitialiser le formulaire à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      setForm({ code: '', name: '', unit: 'unité' });
      setError('');
    }
  }, [isOpen]);

  const handleCreate = async () => {
    if (!form.code || !form.name) {
      setError('Code et nom obligatoires');
      return;
    }
    setIsCreating(true);
    setError('');
    try {
      const res = await authFetch('/products/pf', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur');
      }
      onClose();
      setForm({ code: '', name: '', unit: 'unité' });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative glass-card w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-black/[0.04]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#AF52DE]" />Nouveau produit
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/40 transition-colors text-[#86868B] hover:text-[#1D1D1F]">
              <span className="sr-only">Fermer</span>
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 glass-card glass-tint-red rounded-[14px] text-red-700 text-[13px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />{error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="pf-code" className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Code <span aria-hidden="true">*</span></label>
              <input
                id="pf-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="PF-001"
                aria-required="true"
                className="w-full px-3 py-2.5 border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] text-[13px] transition-all"
              />
            </div>
            <div>
              <label htmlFor="pf-unit" className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Unité <span aria-hidden="true">*</span></label>
              <select
                id="pf-unit"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                aria-required="true"
                className="w-full px-3 py-2.5 border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] text-[13px] transition-all"
              >
                <option value="g">g (gramme)</option>
                <option value="kg">kg (kilogramme)</option>
                <option value="L">L (litre)</option>
                <option value="unité">unité</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="pf-name" className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Nom <span aria-hidden="true">*</span></label>
            <input
              id="pf-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Fromage fondu 8 portions"
              aria-required="true"
              className="w-full px-3 py-2.5 border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] text-[13px] transition-all"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-black/[0.04] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-[13px] font-medium text-[#1D1D1F] glass-card rounded-[14px] hover:bg-white/60 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className={isCreating
              ? 'px-5 py-2.5 rounded-full text-[13px] font-medium bg-black/[0.03] text-[#C7C7CC] cursor-not-allowed flex items-center gap-2'
              : 'px-5 py-2.5 rounded-full text-[13px] font-medium bg-[#1D1D1F] text-white hover:bg-[#333336] shadow-lg shadow-black/10 flex items-center gap-2 transition-all'
            }
          >
            {isCreating ? 'Création...' : <><Check className="w-4 h-4" />Créer</>}
          </button>
        </div>
      </div>
    </div>
  );
}
