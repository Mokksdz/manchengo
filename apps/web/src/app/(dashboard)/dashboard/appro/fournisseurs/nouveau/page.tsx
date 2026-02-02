'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NOUVEAU FOURNISSEUR — Formulaire de création
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Champs requis pour créer un fournisseur et passer des bons de commande:
 * - Identité: nom, RC, NIF, AI, NIS (optionnel)
 * - Contact: téléphone, adresse
 * 
 * Validations fiscales algériennes appliquées
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { appro } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Truck,
  Building2,
  Phone,
  MapPin,
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { SuccessAnimation } from '@/components/ui/success-animation';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface FormData {
  name: string;
  rc: string;
  nif: string;
  ai: string;
  nis: string;
  phone: string;
  address: string;
}

interface FormErrors {
  name?: string;
  rc?: string;
  nif?: string;
  ai?: string;
  nis?: string;
  phone?: string;
  address?: string;
  general?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function validateForm(data: FormData): FormErrors {
  const errors: FormErrors = {};

  // Nom
  if (!data.name.trim()) {
    errors.name = 'Le nom du fournisseur est obligatoire';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Le nom doit contenir au moins 2 caractères';
  }

  // RC - Registre de Commerce
  if (!data.rc.trim()) {
    errors.rc = 'Le Registre de Commerce (RC) est obligatoire';
  } else if (!/^(?=.*[A-Za-z])[A-Za-z0-9]+$/.test(data.rc.trim())) {
    errors.rc = 'RC invalide: doit être alphanumérique et contenir au moins une lettre';
  }

  // NIF - 15 chiffres
  if (!data.nif.trim()) {
    errors.nif = 'Le NIF est obligatoire';
  } else if (!/^\d{15}$/.test(data.nif.trim())) {
    errors.nif = 'NIF invalide: doit contenir exactement 15 chiffres';
  }

  // AI - Article d'Imposition
  if (!data.ai.trim()) {
    errors.ai = "L'Article d'Imposition (AI) est obligatoire";
  } else if (!/^[A-Za-z0-9]{3,20}$/.test(data.ai.trim())) {
    errors.ai = 'AI invalide: doit être alphanumérique, entre 3 et 20 caractères';
  }

  // NIS - optionnel mais si rempli, 15 chiffres
  if (data.nis.trim() && !/^\d{15}$/.test(data.nis.trim())) {
    errors.nis = 'NIS invalide: doit contenir exactement 15 chiffres';
  }

  // Téléphone - format algérien
  if (!data.phone.trim()) {
    errors.phone = 'Le numéro de téléphone est obligatoire';
  } else if (!/^(05|06|07)\d{8}$/.test(data.phone.trim())) {
    errors.phone = 'Téléphone invalide: format algérien requis (05/06/07 + 8 chiffres)';
  }

  // Adresse
  if (!data.address.trim()) {
    errors.address = "L'adresse est obligatoire";
  } else if (data.address.trim().length < 5) {
    errors.address = "L'adresse doit contenir au moins 5 caractères";
  }

  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT INPUT
// ═══════════════════════════════════════════════════════════════════════════════

function FormInput({
  label,
  name: _name,
  value,
  onChange,
  error,
  placeholder,
  hint,
  icon: Icon,
  required = false,
  maxLength,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2]" />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(
            'w-full rounded-lg border px-4 py-2.5 text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            Icon && 'pl-10',
            error
              ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'
              : 'border-[#E5E5E5] bg-white'
          )}
        />
      </div>
      {hint && !error && (
        <p className="mt-1 text-xs text-[#86868B]">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function NouveauFournisseurPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    rc: '',
    nif: '',
    ai: '',
    nis: '',
    phone: '',
    address: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _result = await appro.createSupplier({
        name: formData.name.trim(),
        rc: formData.rc.trim(),
        nif: formData.nif.trim(),
        ai: formData.ai.trim(),
        nis: formData.nis.trim() || undefined,
        phone: formData.phone.trim(),
        address: formData.address.trim(),
      });

      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        router.push('/dashboard/appro/fournisseurs');
      }, 1500);
    } catch (err: unknown) {
      console.error('Failed to create supplier:', err);
      setErrors({
        general: (err as Error).message || 'Erreur lors de la création du fournisseur',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="glass-card rounded-2xl p-8">
          <SuccessAnimation
            title="Fournisseur créé avec succès"
            subtitle="Redirection vers la liste des fournisseurs..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard/appro/fournisseurs"
          className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#86868B]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1D1D1F] flex items-center gap-3">
            <Truck className="w-7 h-7 text-primary-600" />
            Nouveau fournisseur
          </h1>
          <p className="text-[#6E6E73]">
            Créer un fournisseur pour passer des bons de commande
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error banner */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{errors.general}</p>
          </div>
        )}

        {/* Section: Identité */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-[#1D1D1F] mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            Identité du fournisseur
          </h2>
          
          <div className="space-y-4">
            <FormInput
              label="Nom du fournisseur"
              name="name"
              value={formData.name}
              onChange={(v) => updateField('name', v)}
              error={errors.name}
              placeholder="Ex: SARL Agro Supplies"
              icon={Building2}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Registre de Commerce (RC)"
                name="rc"
                value={formData.rc}
                onChange={(v) => updateField('rc', v)}
                error={errors.rc}
                placeholder="Ex: 16A1234567"
                hint="Alphanumérique, au moins une lettre"
                required
              />

              <FormInput
                label="NIF"
                name="nif"
                value={formData.nif}
                onChange={(v) => updateField('nif', v.replace(/\D/g, ''))}
                error={errors.nif}
                placeholder="000000000000000"
                hint="15 chiffres"
                maxLength={15}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Article d'Imposition (AI)"
                name="ai"
                value={formData.ai}
                onChange={(v) => updateField('ai', v)}
                error={errors.ai}
                placeholder="Ex: 16500123456"
                hint="3 à 20 caractères alphanumériques"
                required
              />

              <FormInput
                label="NIS"
                name="nis"
                value={formData.nis}
                onChange={(v) => updateField('nis', v.replace(/\D/g, ''))}
                error={errors.nis}
                placeholder="000000000000000"
                hint="Optionnel — 15 chiffres"
                maxLength={15}
              />
            </div>
          </div>
        </div>

        {/* Section: Contact */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-[#1D1D1F] mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary-600" />
            Coordonnées
          </h2>
          
          <div className="space-y-4">
            <FormInput
              label="Téléphone"
              name="phone"
              value={formData.phone}
              onChange={(v) => updateField('phone', v.replace(/\D/g, ''))}
              error={errors.phone}
              placeholder="0555123456"
              hint="Format algérien: 05, 06 ou 07 + 8 chiffres"
              icon={Phone}
              maxLength={10}
              required
            />

            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                Adresse<span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-[#AEAEB2]" />
                <textarea
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Adresse complète du fournisseur"
                  rows={3}
                  className={cn(
                    'w-full rounded-lg border px-4 py-2.5 pl-10 text-sm transition-colors resize-none',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                    errors.address
                      ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'
                      : 'border-[#E5E5E5] bg-white'
                  )}
                />
              </div>
              {errors.address && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.address}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Informations fiscales algériennes</p>
              <ul className="list-disc list-inside text-blue-700 space-y-0.5">
                <li>RC, NIF et AI sont obligatoires pour la facturation</li>
                <li>Ces informations apparaîtront sur les bons de commande</li>
                <li>Vérifiez l'exactitude des numéros avant validation</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/dashboard/appro/fournisseurs"
            className="px-6 py-2.5 text-[#1D1D1F] font-medium hover:bg-[#F5F5F5] rounded-lg transition-colors"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Créer le fournisseur
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
