'use client';

import { memo, useState, useEffect } from 'react';
import { X, Building2, AlertCircle, FileCheck, Phone, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api';

export interface Supplier {
  id: number;
  code: string;
  name: string;
  rc?: string;
  nif?: string;
  ai?: string;
  nis?: string;
  phone?: string;
  address?: string;
}

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (supplier: Supplier) => void;
}

export const SupplierModal = memo(function SupplierModal({ isOpen, onClose, onSuccess }: SupplierModalProps) {
  const [form, setForm] = useState({
    name: '',
    rc: '',
    nif: '',
    ai: '',
    nis: '',
    phone: '',
    address: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm({ name: '', rc: '', nif: '', ai: '', nis: '', phone: '', address: '' });
      setError(null);
      setFieldErrors({});
    }
  }, [isOpen]);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Nom requis';
    if (!form.rc.trim()) errors.rc = 'RC requis';
    if (!form.nif.trim()) errors.nif = 'NIF requis';
    if (!form.ai.trim()) errors.ai = 'AI requis';
    return errors;
  };

  const canSubmit = form.name.trim() && form.rc.trim() && form.nif.trim() && form.ai.trim();

  const handleSubmit = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await authFetch('/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name.trim(),
          rc: form.rc.trim(),
          nif: form.nif.trim(),
          ai: form.ai.trim(),
          nis: form.nis.trim() || undefined,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur lors de la création du fournisseur');
      }

      const newSupplier = await res.json();
      onSuccess(newSupplier);
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative glass-card rounded-[18px] w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/70 bg-white/70 backdrop-blur-[18px]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#1D1D1F]">Nouveau Fournisseur</h2>
              <p className="text-sm text-[#86868B]">Créer un fournisseur rapidement</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#86868B] hover:text-[#1D1D1F] transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Laiterie du Sahel"
              className={cn(
                "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500",
                fieldErrors.name ? "border-red-300" : "border-[#E5E5E5]"
              )}
            />
            {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                <FileCheck className="w-4 h-4 inline mr-1" />RC <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.rc}
                onChange={(e) => setForm({ ...form, rc: e.target.value })}
                placeholder="00B0012345"
                className={cn(
                  "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500",
                  fieldErrors.rc ? "border-red-300" : "border-[#E5E5E5]"
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                NIF <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nif}
                onChange={(e) => setForm({ ...form, nif: e.target.value })}
                placeholder="000012345678901"
                className={cn(
                  "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500",
                  fieldErrors.nif ? "border-red-300" : "border-[#E5E5E5]"
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                AI <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.ai}
                onChange={(e) => setForm({ ...form, ai: e.target.value })}
                placeholder="12345678901"
                className={cn(
                  "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500",
                  fieldErrors.ai ? "border-red-300" : "border-[#E5E5E5]"
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">NIS</label>
              <input
                type="text"
                value={form.nis}
                onChange={(e) => setForm({ ...form, nis: e.target.value })}
                placeholder="Optionnel"
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
              <Phone className="w-4 h-4 inline mr-1" />Téléphone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="0555 12 34 56"
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />Adresse
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Zone Industrielle, Alger"
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#F0F0F0] bg-[#FAFAFA]">
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
            {isSubmitting ? 'Création...' : 'Créer le fournisseur'}
          </button>
        </div>
      </div>
    </div>
  );
});
