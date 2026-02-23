'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api';
import { X, AlertCircle, FileText } from 'lucide-react';
import {
  type Client,
  type FieldErrors,
  type ClientFormData,
  VALIDATION,
  typeConfig,
  clientTypes,
} from './types';

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingClient: Client | null;
  formData: ClientFormData;
  onFormChange: (data: ClientFormData) => void;
  onSuccess: () => void;
}

// Validation function - returns errors object
function validateForm(data: ClientFormData, isEditing: boolean): FieldErrors {
  const errors: FieldErrors = {};

  if (!isEditing && !data.code.trim()) {
    errors.code = 'Le code client est obligatoire';
  }

  if (!data.name.trim()) {
    errors.name = 'Le nom du client est obligatoire';
  }

  if (!data.nif.trim()) {
    errors.nif = 'Le NIF est obligatoire';
  } else if (!VALIDATION.NIF.test(data.nif)) {
    errors.nif = 'NIF invalide \u2013 15 chiffres requis';
  }

  if (!data.rc.trim()) {
    errors.rc = 'Le RC est obligatoire';
  } else if (!VALIDATION.RC.test(data.rc)) {
    errors.rc = 'RC invalide \u2013 doit contenir au moins une lettre et des chiffres (8 \u00e0 15 caract\u00e8res)';
  }

  if (!data.ai.trim()) {
    errors.ai = 'L\'AI est obligatoire';
  } else if (!VALIDATION.AI.test(data.ai)) {
    errors.ai = 'AI invalide \u2013 6 \u00e0 10 chiffres requis';
  }

  if (data.nis && data.nis.trim() && !VALIDATION.NIS.test(data.nis)) {
    errors.nis = 'NIS invalide \u2013 15 chiffres requis si renseign\u00e9';
  }

  if (data.phone && data.phone.trim() && !VALIDATION.PHONE.test(data.phone)) {
    errors.phone = 'T\u00e9l\u00e9phone invalide \u2013 format: 05/06/07XXXXXXXX ou +2135/6/7XXXXXXXX';
  }

  return errors;
}

export function ClientFormModal({
  isOpen,
  onClose,
  editingClient,
  formData,
  onFormChange,
  onSuccess,
}: ClientFormModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  // Refs for focus management
  const nifRef = useRef<HTMLInputElement>(null);
  const rcRef = useRef<HTMLInputElement>(null);
  const aiRef = useRef<HTMLInputElement>(null);
  const nisRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const focusFirstError = (errors: FieldErrors) => {
    if (errors.nif) nifRef.current?.focus();
    else if (errors.rc) rcRef.current?.focus();
    else if (errors.ai) aiRef.current?.focus();
    else if (errors.nis) nisRef.current?.focus();
    else if (errors.phone) phoneRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm(formData, !!editingClient);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      focusFirstError(errors);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = editingClient
        ? `/admin/clients/${editingClient.id}`
        : '/admin/clients';

      const body = editingClient
        ? {
            name: formData.name,
            type: formData.type,
            nif: formData.nif,
            rc: formData.rc,
            ai: formData.ai,
            nis: formData.nis || null,
            phone: formData.phone || null,
            address: formData.address || null,
          }
        : {
            code: formData.code,
            name: formData.name,
            type: formData.type,
            nif: formData.nif,
            rc: formData.rc,
            ai: formData.ai,
            nis: formData.nis || null,
            phone: formData.phone || null,
            address: formData.address || null,
          };

      const res = await authFetch(url, {
        method: editingClient ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        throw new Error(message || 'Erreur lors de la sauvegarde');
      }

      onClose();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/20 animate-scale-in max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
          <h2 className="text-lg font-semibold text-[#1D1D1F]">
            {editingClient ? 'Modifier le client' : 'Nouveau client'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-[8px]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-[#FF3B30] bg-[#FF3B30]/10 rounded-xl border border-[#FF3B30]/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="field-code" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">Code <span aria-hidden="true">*</span></label>
              <input
                id="field-code"
                type="text"
                value={formData.code}
                onChange={(e) => onFormChange({ ...formData, code: e.target.value })}
                disabled={!!editingClient}
                aria-required="true"
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] disabled:bg-[#F5F5F5]"
                placeholder="CLI-004"
                required
              />
            </div>
            <div>
              <label htmlFor="field-type" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">Type <span aria-hidden="true">*</span></label>
              <select
                id="field-type"
                value={formData.type}
                onChange={(e) => onFormChange({ ...formData, type: e.target.value as Client['type'] })}
                aria-required="true"
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              >
                {clientTypes.map((t) => (
                  <option key={t} value={t}>{typeConfig[t].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="field-name" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">Nom <span aria-hidden="true">*</span></label>
            <input
              id="field-name"
              type="text"
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              aria-required="true"
              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              placeholder="Nom du client"
              required
            />
          </div>

          {/* Champs fiscaux algeriens */}
          <div className="glass-card p-4 mt-4">
            <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 flex items-center justify-center">
                <FileText className="w-3 h-3 text-[#FF9500]" />
              </div>
              Informations fiscales (conformit\u00e9 DGI)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-nif" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">NIF <span aria-hidden="true">*</span></label>
                <input
                  id="field-nif"
                  ref={nifRef}
                  type="text"
                  value={formData.nif}
                  onChange={(e) => {
                    onFormChange({ ...formData, nif: e.target.value });
                    if (fieldErrors.nif) setFieldErrors({ ...fieldErrors, nif: undefined });
                  }}
                  aria-required="true"
                  aria-invalid={!!fieldErrors.nif}
                  aria-describedby={fieldErrors.nif ? 'field-nif-error' : undefined}
                  className={cn(
                    "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]",
                    fieldErrors.nif ? "border-[#FF3B30]/40 bg-[#FF3B30]/5" : "border-[#E5E5E5]"
                  )}
                  placeholder="15 chiffres (ex: 000000000000000)"
                  maxLength={15}
                />
                {fieldErrors.nif && (
                  <p id="field-nif-error" role="alert" className="mt-1 text-xs text-[#FF3B30] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {fieldErrors.nif}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="field-rc" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">RC <span aria-hidden="true">*</span></label>
                <input
                  id="field-rc"
                  ref={rcRef}
                  type="text"
                  value={formData.rc}
                  onChange={(e) => {
                    onFormChange({ ...formData, rc: e.target.value.toUpperCase() });
                    if (fieldErrors.rc) setFieldErrors({ ...fieldErrors, rc: undefined });
                  }}
                  aria-required="true"
                  aria-invalid={!!fieldErrors.rc}
                  aria-describedby={fieldErrors.rc ? 'field-rc-error' : undefined}
                  className={cn(
                    "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]",
                    fieldErrors.rc ? "border-[#FF3B30]/40 bg-[#FF3B30]/5" : "border-[#E5E5E5]"
                  )}
                  placeholder="17B0809707 ou A12345678"
                />
                {fieldErrors.rc && (
                  <p id="field-rc-error" role="alert" className="mt-1 text-xs text-[#FF3B30] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {fieldErrors.rc}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="field-ai" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">AI <span aria-hidden="true">*</span></label>
                <input
                  id="field-ai"
                  ref={aiRef}
                  type="text"
                  value={formData.ai}
                  onChange={(e) => {
                    onFormChange({ ...formData, ai: e.target.value });
                    if (fieldErrors.ai) setFieldErrors({ ...fieldErrors, ai: undefined });
                  }}
                  aria-required="true"
                  aria-invalid={!!fieldErrors.ai}
                  aria-describedby={fieldErrors.ai ? 'field-ai-error' : undefined}
                  className={cn(
                    "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]",
                    fieldErrors.ai ? "border-[#FF3B30]/40 bg-[#FF3B30]/5" : "border-[#E5E5E5]"
                  )}
                  placeholder="6 \u00e0 10 chiffres (ex: 16123456)"
                  maxLength={10}
                />
                {fieldErrors.ai && (
                  <p id="field-ai-error" role="alert" className="mt-1 text-xs text-[#FF3B30] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {fieldErrors.ai}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="field-nis" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">NIS <span className="text-[#AEAEB2] text-[11px]">(optionnel)</span></label>
                <input
                  id="field-nis"
                  ref={nisRef}
                  type="text"
                  value={formData.nis}
                  onChange={(e) => {
                    onFormChange({ ...formData, nis: e.target.value });
                    if (fieldErrors.nis) setFieldErrors({ ...fieldErrors, nis: undefined });
                  }}
                  aria-invalid={!!fieldErrors.nis}
                  aria-describedby={fieldErrors.nis ? 'field-nis-error' : undefined}
                  className={cn(
                    "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]",
                    fieldErrors.nis ? "border-[#FF3B30]/40 bg-[#FF3B30]/5" : "border-[#E5E5E5]"
                  )}
                  placeholder="15 chiffres si renseign\u00e9"
                  maxLength={15}
                />
                {fieldErrors.nis && (
                  <p id="field-nis-error" role="alert" className="mt-1 text-xs text-[#FF3B30] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {fieldErrors.nis}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="field-phone" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">T\u00e9l\u00e9phone <span className="text-[#AEAEB2] text-[11px]">(optionnel)</span></label>
              <input
                id="field-phone"
                ref={phoneRef}
                type="text"
                value={formData.phone}
                onChange={(e) => {
                  onFormChange({ ...formData, phone: e.target.value });
                  if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined });
                }}
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={fieldErrors.phone ? 'field-phone-error' : undefined}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]",
                  fieldErrors.phone ? "border-[#FF3B30]/40 bg-[#FF3B30]/5" : "border-[#E5E5E5]"
                )}
                placeholder="0551234567 ou +213551234567"
              />
              {fieldErrors.phone && (
                <p id="field-phone-error" role="alert" className="mt-1 text-xs text-[#FF3B30] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.phone}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="field-address" className="block text-[13px] font-medium text-[#6E6E73] mb-1.5">Adresse</label>
              <input
                id="field-address"
                type="text"
                value={formData.address}
                onChange={(e) => onFormChange({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                placeholder="Adresse compl\u00e8te"
              />
            </div>
          </div>

          {/* Validation summary */}
          {Object.keys(fieldErrors).length > 0 && (
            <div className="p-3 bg-[#FF3B30]/8 border border-[#FF3B30]/15 rounded-xl">
              <p className="text-sm text-[#FF3B30] font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Veuillez corriger les erreurs ci-dessus
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || Object.keys(fieldErrors).length > 0}
              className="px-5 py-2.5 bg-[#007AFF] text-white rounded-full hover:bg-[#0056D6] disabled:opacity-50 font-semibold transition-all shadow-lg shadow-[#007AFF]/25"
            >
              {saving ? 'Enregistrement...' : (editingClient ? 'Modifier' : 'Cr\u00e9er')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
