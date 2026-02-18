'use client';

/**
 * CRÉATION BON DE COMMANDE — Mode Dual
 *
 * 1. Avec ?mpId= : pré-rempli depuis contexte MP (comportement existant)
 * 2. Sans mpId  : formulaire libre multi-lignes avec sélection MP + fournisseur
 *
 * Apple Glass Design System
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusTrap, useEscapeKey } from '@/lib/hooks/use-focus-trap';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { appro, authFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  FileText,
  Package,
  Loader2,
  Download,
  AlertTriangle,
  AlertOctagon,
  Calendar,
  XCircle,
  Plus,
  Trash2,
  Search,
  X,
  UserPlus,
  Building2,
  Phone,
  MapPin,
  Hash,
  ChevronDown,
} from 'lucide-react';
import { SuccessAnimation } from '@/components/ui/success-animation';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductMp {
  id: number;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  state: string;
  minStock?: number;
  seuilCommande?: number;
  supplierId?: number | null;
  supplierName?: string | null;
  lastPrice?: number;
  leadTimeFournisseur?: number;
}

interface Supplier {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  isActive: boolean;
}

interface OrderLine {
  productMpId: number | null;
  quantity: number;
  unitPrice: number;
}

interface SupplierForm {
  name: string;
  rc: string;
  nif: string;
  ai: string;
  nis: string;
  phone: string;
  address: string;
}

const emptySupplierForm: SupplierForm = {
  name: '',
  rc: '',
  nif: '',
  ai: '',
  nis: '',
  phone: '',
  address: '',
};

const supplierValidation: Record<
  keyof SupplierForm,
  { required: boolean; pattern?: RegExp; label: string; minLength?: number; hint?: string }
> = {
  name: { required: true, label: 'Raison sociale', minLength: 2 },
  rc: { required: true, label: 'Registre de commerce', pattern: /^(?=.*[A-Za-z])[A-Za-z0-9]+$/, hint: 'Alphanumérique, au moins une lettre' },
  nif: { required: true, label: 'NIF', pattern: /^\d{15}$/, hint: '15 chiffres' },
  ai: { required: true, label: "Article d'imposition", pattern: /^[A-Za-z0-9]{3,20}$/, hint: '3-20 caractères alphanumériques' },
  nis: { required: false, label: 'NIS', pattern: /^\d{15}$/, hint: '15 chiffres (optionnel)' },
  phone: { required: true, label: 'Téléphone', pattern: /^(05|06|07)\d{8}$/, hint: '05/06/07 + 8 chiffres' },
  address: { required: true, label: 'Adresse', minLength: 5 },
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputClass =
  'w-full bg-white/60 backdrop-blur-sm border border-black/[0.04] rounded-xl px-4 py-3 text-[#1D1D1F] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#EC7620]/20 focus:border-[#EC7620] transition-all';

const selectClass =
  'w-full bg-white/60 backdrop-blur-sm border border-black/[0.04] rounded-xl px-4 py-3 text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#EC7620]/20 focus:border-[#EC7620] transition-all appearance-none';

// ─── MP Search Dropdown Component ────────────────────────────────────────────

function MpSearchSelect({
  products,
  value,
  onChange,
  disabled,
}: {
  products: ProductMp[];
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === value);
  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          inputClass,
          'flex items-center justify-between gap-2 text-left cursor-pointer',
          !selected && 'text-[#AEAEB2]',
        )}
      >
        <span className="truncate">
          {selected ? `${selected.code} — ${selected.name}` : 'Sélectionner une MP...'}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-[#86868B] shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white/95 backdrop-blur-xl rounded-xl border border-black/[0.04] shadow-xl max-h-64 overflow-hidden animate-scale-in">
          <div className="p-2 border-b border-black/[0.04]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par code ou nom..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-[#F5F5F7] rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-[#EC7620]/30"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <p className="text-sm text-[#86868B] p-3 text-center">Aucun résultat</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 hover:bg-[#EC7620]/5 transition-colors flex items-center justify-between',
                    p.id === value && 'bg-[#EC7620]/10',
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-[#1D1D1F]">{p.name}</p>
                    <p className="text-xs text-[#86868B]">
                      {p.code} · Stock: {p.currentStock} {p.unit}
                      {p.lastPrice ? ` · Dernier prix: ${p.lastPrice} DA` : ''}
                    </p>
                  </div>
                  {(p.state === 'RUPTURE' || p.state === 'BLOQUANT_PRODUCTION') && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FF3B30]/10 text-[#FF3B30]">
                      RUPTURE
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NewBonCommandePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mpIdParam = searchParams.get('mpId');
  const isUrgent = searchParams.get('urgent') === 'true';
  const hasContext = !!mpIdParam;

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; reference: string } | null>(null);

  // Data
  const [allProducts, setAllProducts] = useState<ProductMp[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedMp, setSelectedMp] = useState<ProductMp | null>(null);

  // Form — context mode (single line)
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');

  // Form — direct mode (multi-line)
  const [lines, setLines] = useState<OrderLine[]>([{ productMpId: null, quantity: 0, unitPrice: 0 }]);

  // Warnings
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hasConfirmedWarnings, setHasConfirmedWarnings] = useState(false);

  // Supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>({ ...emptySupplierForm });
  const [supplierErrors, setSupplierErrors] = useState<Partial<Record<keyof SupplierForm, string>>>({});
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

  // Focus trap and escape key for supplier modal
  const supplierModalRef = useFocusTrap<HTMLDivElement>(showSupplierModal);
  const closeSupplierModal = useCallback(() => {
    setShowSupplierModal(false);
    setSupplierForm({ ...emptySupplierForm });
    setSupplierErrors({});
  }, []);
  useEscapeKey(closeSupplierModal, showSupplierModal);

  // ─── Load Data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [stockRes, suppliersRes] = await Promise.all([
        appro.getStockMp(),
        authFetch('/suppliers?active=true', { credentials: 'include' }),
      ]);
      setAllProducts(stockRes);
      if (suppliersRes.ok) {
        const suppData = await suppliersRes.json();
        setSuppliers(suppData.suppliers || suppData || []);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Impossible de charger les données');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Context pre-fill
  useEffect(() => {
    if (mpIdParam && allProducts.length > 0 && !selectedMp) {
      const mpId = parseInt(mpIdParam);
      const mp = allProducts.find((p) => p.id === mpId);
      if (mp) {
        setSelectedMp(mp);
        const recommended = Math.max(0, (mp.minStock || 100) - mp.currentStock);
        setQuantity(recommended);
        setUnitPrice(mp.lastPrice || 0);
        if (mp.supplierId) setSupplierId(mp.supplierId);
        const leadTime = mp.leadTimeFournisseur || 7;
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + leadTime);
        setExpectedDelivery(deliveryDate.toISOString().split('T')[0]);
      }
    }
  }, [mpIdParam, allProducts, selectedMp]);

  // ─── Lines Management ──────────────────────────────────────────────────────

  const addLine = () => setLines([...lines, { productMpId: null, quantity: 0, unitPrice: 0 }]);

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof OrderLine, value: number | null) => {
    const updated = [...lines];
    if (field === 'productMpId') {
      updated[idx].productMpId = value;
      // Auto-fill price from last known price
      if (value) {
        const mp = allProducts.find((p) => p.id === value);
        if (mp?.lastPrice) updated[idx].unitPrice = mp.lastPrice;
      }
    } else {
      (updated[idx] as unknown as Record<string, number | null>)[field] = value;
    }
    setLines(updated);
  };

  // ─── Validation ────────────────────────────────────────────────────────────

  const validateContextForm = (): string[] => {
    const errs: string[] = [];
    if (!selectedMp) errs.push('Aucune MP sélectionnée');
    if (!supplierId) errs.push('Fournisseur obligatoire');
    if (quantity <= 0) errs.push('Quantité doit être > 0');
    if (unitPrice <= 0) errs.push('Prix unitaire doit être > 0');
    if (!expectedDelivery) errs.push('Date de livraison obligatoire');
    return errs;
  };

  const validateDirectForm = (): string[] => {
    const errs: string[] = [];
    if (!supplierId) errs.push('Fournisseur obligatoire');
    if (!expectedDelivery) errs.push('Date de livraison obligatoire');
    const validLines = lines.filter((l) => l.productMpId !== null);
    if (validLines.length === 0) errs.push('Au moins une ligne produit est requise');
    lines.forEach((l, i) => {
      if (l.productMpId !== null) {
        if (l.quantity <= 0) errs.push(`Ligne ${i + 1}: quantité doit être > 0`);
        if (l.unitPrice <= 0) errs.push(`Ligne ${i + 1}: prix doit être > 0`);
      }
    });
    // Check for duplicate products
    const productIds = lines.filter((l) => l.productMpId !== null).map((l) => l.productMpId);
    const duplicates = productIds.filter((id, i) => productIds.indexOf(id) !== i);
    if (duplicates.length > 0) errs.push('Produits en double détectés');
    return errs;
  };

  const checkWarnings = (): string[] => {
    const warns: string[] = [];
    if (hasContext && selectedMp) {
      if (selectedMp.lastPrice && selectedMp.lastPrice > 0) {
        if (unitPrice > selectedMp.lastPrice * 2)
          warns.push(`Prix très élevé: ${unitPrice} DA (dernier: ${selectedMp.lastPrice} DA)`);
        if (unitPrice < selectedMp.lastPrice * 0.5)
          warns.push(`Prix très bas: ${unitPrice} DA (dernier: ${selectedMp.lastPrice} DA)`);
      }
      if (selectedMp.minStock && quantity > selectedMp.minStock * 3)
        warns.push(`Quantité élevée: ${quantity} (stock min: ${selectedMp.minStock})`);
    } else {
      lines.forEach((l, i) => {
        if (l.productMpId) {
          const mp = allProducts.find((p) => p.id === l.productMpId);
          if (mp?.lastPrice && mp.lastPrice > 0) {
            if (l.unitPrice > mp.lastPrice * 2)
              warns.push(`Ligne ${i + 1}: prix très élevé (${l.unitPrice} DA vs dernier ${mp.lastPrice} DA)`);
            if (l.unitPrice < mp.lastPrice * 0.5)
              warns.push(`Ligne ${i + 1}: prix très bas (${l.unitPrice} DA vs dernier ${mp.lastPrice} DA)`);
          }
          if (mp?.minStock && l.quantity > mp.minStock * 3)
            warns.push(`Ligne ${i + 1}: quantité élevée (${l.quantity} vs stock min ${mp.minStock})`);
        }
      });
    }
    return warns;
  };

  const canSubmit = hasContext
    ? validateContextForm().length === 0 && (warnings.length === 0 || hasConfirmedWarnings)
    : validateDirectForm().length === 0 && (warnings.length === 0 || hasConfirmedWarnings);

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const errs = hasContext ? validateContextForm() : validateDirectForm();
    if (errs.length > 0) {
      setError(errs.join(' · '));
      return;
    }

    const warns = checkWarnings();
    if (warns.length > 0 && !hasConfirmedWarnings) {
      setWarnings(warns);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const submitLines = hasContext
        ? [{ productMpId: selectedMp!.id, quantity, unitPrice }]
        : lines.filter((l) => l.productMpId !== null).map((l) => ({
            productMpId: l.productMpId!,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          }));

      const res = await authFetch('/appro/purchase-orders/create-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          supplierId,
          lines: submitLines,
          expectedDelivery,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Erreur création BC');
      }

      const data = await res.json();
      setSuccess({ id: data.id, reference: data.reference });
    } catch (err: unknown) {
      setError((err as Error).message || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Supplier Modal ────────────────────────────────────────────────────────

  const validateSupplierForm = (): boolean => {
    const errs: Partial<Record<keyof SupplierForm, string>> = {};
    (Object.keys(supplierValidation) as (keyof SupplierForm)[]).forEach((key) => {
      const rule = supplierValidation[key];
      const val = supplierForm[key].trim();
      if (rule.required && !val) {
        errs[key] = `${rule.label} est obligatoire`;
      } else if (val) {
        if (rule.minLength && val.length < rule.minLength) {
          errs[key] = `${rule.label}: min ${rule.minLength} caractères`;
        }
        if (rule.pattern && !rule.pattern.test(val)) {
          errs[key] = rule.hint || 'Format invalide';
        }
      }
    });
    setSupplierErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateSupplier = async () => {
    if (!validateSupplierForm()) return;
    setIsCreatingSupplier(true);
    try {
      const result = await appro.createSupplier({
        name: supplierForm.name.trim(),
        rc: supplierForm.rc.trim(),
        nif: supplierForm.nif.trim(),
        ai: supplierForm.ai.trim(),
        nis: supplierForm.nis.trim() || undefined,
        phone: supplierForm.phone.trim(),
        address: supplierForm.address.trim(),
      });
      // Refresh suppliers list
      const suppliersRes = await authFetch('/suppliers?active=true', { credentials: 'include' });
      if (suppliersRes.ok) {
        const suppData = await suppliersRes.json();
        setSuppliers(suppData.suppliers || suppData || []);
      }
      // Auto-select new supplier
      setSupplierId(result.id);
      setShowSupplierModal(false);
      setSupplierForm({ ...emptySupplierForm });
      setSupplierErrors({});
    } catch (err: unknown) {
      setSupplierErrors({ name: (err as Error).message || 'Erreur lors de la création' });
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  // ─── Computed ──────────────────────────────────────────────────────────────

  const totalHT = hasContext
    ? quantity * unitPrice
    : lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  const activeSuppliers = suppliers.filter((s) => s.isActive);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#EC7620]/20 to-[#EC7620]/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#EC7620]" />
          </div>
          <p className="text-[#86868B] text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  // ─── Success Screen ────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <SuccessAnimation
          title="BC créé avec succès"
          subtitle={`Référence: ${success.reference}`}
          showConfetti
        />
        {isUrgent && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] font-medium text-sm mb-4 mt-4 animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <AlertOctagon className="w-4 h-4" />
            BC URGENT — A envoyer immédiatement
          </div>
        )}
        <div className="space-y-3 mt-8 animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <Link
            href={`/dashboard/appro/bons/${success.id}`}
            className="glass-btn flex items-center justify-center gap-2 w-full px-4 py-3.5 bg-[#EC7620] text-white rounded-full font-semibold hover:bg-[#EC7620]/90 transition-colors"
          >
            <FileText className="w-5 h-5" />
            Voir le BC
          </Link>
          <button
            onClick={async () => {
              try {
                const res = await authFetch(`/appro/purchase-orders/${success.id}/pdf`);
                if (res.ok) {
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `BC-${success.reference || success.id}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                }
              } catch (err) {
                console.error('Erreur téléchargement PDF:', err);
              }
            }}
            className="glass-btn flex items-center justify-center gap-2 w-full px-4 py-3.5 border border-black/[0.04] rounded-full hover:bg-white/80 transition-colors text-[#1D1D1F]"
          >
            <Download className="w-5 h-5" />
            Télécharger PDF
          </button>
          <Link
            href="/dashboard/appro"
            className="block w-full px-4 py-3 text-[#86868B] hover:text-[#1D1D1F] transition-colors"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 animate-slide-up">
      <PageHeader
        title={isUrgent ? 'Créer BC URGENT' : 'Nouveau Bon de Commande'}
        subtitle={hasContext ? 'Formulaire pré-rempli — Vérifiez et confirmez' : 'Sélectionnez les produits et le fournisseur'}
        icon={isUrgent ? <AlertOctagon className="w-5 h-5 text-[#FF3B30]" /> : <FileText className="w-5 h-5" />}
        badge={!hasContext ? { text: 'Mode libre', variant: 'warning' } : undefined}
        className="mb-6"
        actions={(
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
        )}
      />

      {/* MP Context Banner (context mode only) */}
      {hasContext && selectedMp && (
        <div
          className={cn(
            'glass-card rounded-2xl p-4 mb-6 border',
            isUrgent ? 'border-[#FF3B30]/20 bg-[#FF3B30]/5' : 'border-[#007AFF]/20 bg-[#007AFF]/5',
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                isUrgent
                  ? 'bg-gradient-to-br from-[#FF3B30]/20 to-[#FF3B30]/10'
                  : 'bg-gradient-to-br from-[#007AFF]/20 to-[#007AFF]/10',
              )}
            >
              <Package className={cn('w-5 h-5', isUrgent ? 'text-[#FF3B30]' : 'text-[#007AFF]')} />
            </div>
            <div>
              <p className="font-bold text-[#1D1D1F]">{selectedMp.name}</p>
              <p className="text-sm text-[#86868B]">
                Code: {selectedMp.code} · Stock: <strong>{selectedMp.currentStock} {selectedMp.unit}</strong>
              </p>
              {(selectedMp.state === 'RUPTURE' || selectedMp.state === 'BLOQUANT_PRODUCTION') && (
                <span className="inline-flex items-center gap-1 text-[#FF3B30] font-medium text-xs mt-1">
                  <AlertTriangle className="w-3 h-3" /> MP en RUPTURE
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card rounded-2xl p-4 mb-6 border border-[#FF3B30]/20 bg-[#FF3B30]/5 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-[#FF3B30] flex-shrink-0 mt-0.5" />
          <p className="text-[#FF3B30] text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-[#FF3B30]/60 hover:text-[#FF3B30]" />
          </button>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && !hasConfirmedWarnings && (
        <div className="glass-card rounded-2xl p-5 mb-6 border border-[#FF9500]/20 bg-[#FF9500]/5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF9500]/20 to-[#FF9500]/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#FF9500]" />
            </div>
            <div>
              <p className="font-bold text-[#1D1D1F]">Vérification requise</p>
              <ul className="mt-2 space-y-1">
                {warnings.map((w, i) => (
                  <li key={i} className="text-[#86868B] text-sm">• {w}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setWarnings([])}
              className="glass-btn flex-1 px-4 py-2.5 border border-[#FF9500]/30 text-[#FF9500] rounded-full hover:bg-[#FF9500]/5 font-medium text-sm transition-colors"
            >
              Corriger
            </button>
            <button
              onClick={() => setHasConfirmedWarnings(true)}
              className="glass-btn flex-1 px-4 py-2.5 bg-[#FF9500] text-white rounded-full hover:bg-[#FF9500]/90 font-medium text-sm transition-colors"
            >
              Confirmer malgré tout
            </button>
          </div>
        </div>
      )}

      {/* Main Form Card */}
      <div className="glass-card rounded-2xl border border-black/[0.04] overflow-hidden">
        <div className="p-6 space-y-6">

          {/* ── Fournisseur ─────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-semibold text-[#1D1D1F] mb-2">
              Fournisseur <span className="text-[#FF3B30]">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={supplierId || ''}
                  onChange={(e) => setSupplierId(e.target.value ? parseInt(e.target.value) : null)}
                  className={selectClass}
                >
                  <option value="">-- Sélectionner un fournisseur --</option>
                  {activeSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B] pointer-events-none" />
              </div>
              <button
                type="button"
                onClick={() => setShowSupplierModal(true)}
                className="glass-btn flex items-center gap-2 px-4 py-3 rounded-xl border border-black/[0.04] bg-white/60 backdrop-blur-sm hover:bg-[#EC7620]/5 hover:border-[#EC7620]/20 text-[#EC7620] text-sm font-medium transition-all whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Nouveau fournisseur</span>
              </button>
            </div>
            {hasContext && selectedMp?.supplierName && (
              <p className="text-xs text-[#86868B] mt-1.5">Fournisseur habituel: {selectedMp.supplierName}</p>
            )}
          </div>

          {/* ── Product Lines (context mode: single) ──────────────────────── */}
          {hasContext && selectedMp && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#1D1D1F] mb-2">
                    Quantité <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={quantity || ''}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                  <p className="text-xs text-[#86868B] mt-1.5">
                    Recommandé: {Math.max(0, (selectedMp.seuilCommande || selectedMp.minStock || 0) - selectedMp.currentStock)} {selectedMp.unit}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1D1D1F] mb-2">
                    Prix unitaire (DA) <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitPrice || ''}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                  {selectedMp.lastPrice ? (
                    <p className="text-xs text-[#86868B] mt-1.5">Dernier prix: {selectedMp.lastPrice} DA</p>
                  ) : null}
                </div>
              </div>
            </>
          )}

          {/* ── Product Lines (direct mode: multi) ────────────────────────── */}
          {!hasContext && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-[#1D1D1F]">
                  Lignes produit <span className="text-[#FF3B30]">*</span>
                </label>
                <button
                  type="button"
                  onClick={addLine}
                  className="glass-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EC7620]/10 text-[#EC7620] text-xs font-semibold hover:bg-[#EC7620]/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une ligne
                </button>
              </div>

              <div className="space-y-3">
                {lines.map((line, idx) => {
                  const mp = allProducts.find((p) => p.id === line.productMpId);
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-black/[0.04] bg-white/40 backdrop-blur-sm p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wide">
                          Ligne {idx + 1}
                        </span>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="p-1.5 rounded-full hover:bg-[#FF3B30]/10 text-[#AEAEB2] hover:text-[#FF3B30] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <MpSearchSelect
                        products={allProducts}
                        value={line.productMpId}
                        onChange={(id) => updateLine(idx, 'productMpId', id)}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#86868B] mb-1">
                            Quantité {mp ? `(${mp.unit})` : ''}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={line.quantity || ''}
                            onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className={inputClass}
                            placeholder="0"
                          />
                          {mp && (
                            <p className="text-[10px] text-[#AEAEB2] mt-1">
                              Stock: {mp.currentStock} {mp.unit}
                              {mp.minStock ? ` · Min: ${mp.minStock}` : ''}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#86868B] mb-1">Prix unitaire (DA)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice || ''}
                            onChange={(e) => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className={inputClass}
                            placeholder="0.00"
                          />
                          {mp?.lastPrice ? (
                            <p className="text-[10px] text-[#AEAEB2] mt-1">Dernier: {mp.lastPrice} DA</p>
                          ) : null}
                        </div>
                      </div>

                      {line.productMpId && line.quantity > 0 && line.unitPrice > 0 && (
                        <div className="text-right">
                          <span className="text-xs text-[#86868B]">Sous-total: </span>
                          <span className="text-sm font-semibold text-[#1D1D1F]">
                            {(line.quantity * line.unitPrice).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Date livraison ────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-semibold text-[#1D1D1F] mb-2">
              Date de livraison prévue <span className="text-[#FF3B30]">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#AEAEB2]" />
              <input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={cn(inputClass, 'pl-11')}
              />
            </div>
            {hasContext && selectedMp?.leadTimeFournisseur && (
              <p className="text-xs text-[#86868B] mt-1.5">
                Délai moyen fournisseur: {selectedMp.leadTimeFournisseur} jours
              </p>
            )}
          </div>

          {/* ── Notes ─────────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-semibold text-[#1D1D1F] mb-2">Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Instructions particulières..."
            />
          </div>
        </div>

        {/* ── Total ─────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-gradient-to-r from-white/60 to-white/40 backdrop-blur-sm border-t border-black/[0.04]">
          <div className="flex justify-between items-center">
            <span className="text-[#86868B] font-medium">Total HT</span>
            <span className="text-2xl font-bold text-[#1D1D1F]">
              {totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
            </span>
          </div>
          {!hasContext && lines.filter((l) => l.productMpId).length > 0 && (
            <p className="text-xs text-[#AEAEB2] text-right mt-1">
              {lines.filter((l) => l.productMpId).length} ligne(s) produit
            </p>
          )}
        </div>

        {/* ── Submit ────────────────────────────────────────────────────────── */}
        <div className="p-6 border-t border-black/[0.04]">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className={cn(
              'glass-btn w-full py-4 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-2',
              isUrgent
                ? 'bg-[#FF3B30] text-white hover:bg-[#FF3B30]/90 disabled:bg-[#FF3B30]/30'
                : 'bg-[#EC7620] text-white hover:bg-[#EC7620]/90 disabled:bg-[#D1D1D6]',
            )}
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <FileText className="w-5 h-5" />
                {isUrgent ? 'Créer BC URGENT' : 'Créer le Bon de Commande'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         SUPPLIER MODAL
         ═══════════════════════════════════════════════════════════════════════ */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div ref={supplierModalRef} role="dialog" aria-modal="true" aria-labelledby="create-supplier-title" className="relative w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 animate-scale-in overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-black/[0.04]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EC7620]/20 to-[#EC7620]/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[#EC7620]" />
                </div>
                <div>
                  <h2 id="create-supplier-title" className="text-lg font-bold text-[#1D1D1F]">Nouveau Fournisseur</h2>
                  <p className="text-xs text-[#86868B]">Informations fiscales algériennes</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSupplierModal(false);
                  setSupplierForm({ ...emptySupplierForm });
                  setSupplierErrors({});
                }}
                className="p-2 rounded-full hover:bg-black/5 transition-colors"
              >
                <X className="w-5 h-5 text-[#86868B]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5">
                  <Building2 className="w-3.5 h-3.5 inline mr-1.5 text-[#86868B]" />
                  Raison sociale <span className="text-[#FF3B30]">*</span>
                </label>
                <input
                  type="text"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className={cn(inputClass, supplierErrors.name && 'border-[#FF3B30]/40 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30]')}
                  placeholder="Nom de l'entreprise"
                />
                {supplierErrors.name && <p className="text-xs text-[#FF3B30] mt-1">{supplierErrors.name}</p>}
              </div>

              {/* RC + NIF */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5">
                    <Hash className="w-3.5 h-3.5 inline mr-1.5 text-[#86868B]" />
                    RC <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    type="text"
                    value={supplierForm.rc}
                    onChange={(e) => setSupplierForm({ ...supplierForm, rc: e.target.value })}
                    className={cn(inputClass, supplierErrors.rc && 'border-[#FF3B30]/40 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30]')}
                    placeholder="Registre de commerce"
                  />
                  {supplierErrors.rc ? (
                    <p className="text-xs text-[#FF3B30] mt-1">{supplierErrors.rc}</p>
                  ) : (
                    <p className="text-[10px] text-[#AEAEB2] mt-1">Alphanumérique, min 1 lettre</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5">
                    <Hash className="w-3.5 h-3.5 inline mr-1.5 text-[#86868B]" />
                    NIF <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    type="text"
                    value={supplierForm.nif}
                    onChange={(e) => setSupplierForm({ ...supplierForm, nif: e.target.value })}
                    className={cn(inputClass, supplierErrors.nif && 'border-[#FF3B30]/40 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30]')}
                    placeholder="15 chiffres"
                    maxLength={15}
                  />
                  {supplierErrors.nif ? (
                    <p className="text-xs text-[#FF3B30] mt-1">{supplierErrors.nif}</p>
                  ) : (
                    <p className="text-[10px] text-[#AEAEB2] mt-1">15 chiffres</p>
                  )}
                </div>
              </div>

              {/* AI + NIS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5">
                    <Hash className="w-3.5 h-3.5 inline mr-1.5 text-[#86868B]" />
                    AI <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    type="text"
                    value={supplierForm.ai}
                    onChange={(e) => setSupplierForm({ ...supplierForm, ai: e.target.value })}
                    className={cn(inputClass, supplierErrors.ai && 'border-[#FF3B30]/40 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30]')}
                    placeholder="Article d'imposition"
                    maxLength={20}
                  />
                  {supplierErrors.ai ? (
                    <p className="text-xs text-[#FF3B30] mt-1">{supplierErrors.ai}</p>
                  ) : (
                    <p className="text-[10px] text-[#AEAEB2] mt-1">3-20 caractères</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5">
                    <Hash className="w-3.5 h-3.5 inline mr-1.5 text-[#86868B]" />
                    NIS <span className="text-[#86868B] text-xs font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={supplierForm.nis}
                    onChange={(e) => setSupplierForm({ ...supplierForm, nis: e.target.value })}
                    className={cn(inputClass, supplierErrors.nis && 'border-[#FF3B30]/40 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30]')}
                    placeholder="15 chiffres"
                    maxLength={15}
                  />
                  {supplierErrors.nis ? (
                    <p className="text-xs text-[#FF3B30] mt-1">{supplierErrors.nis}</p>
                  ) : (
                    <p className="text-[10px] text-[#AEAEB2] mt-1">15 chiffres (optionnel)</p>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5">
                  <Phone className="w-3.5 h-3.5 inline mr-1.5 text-[#86868B]" />
                  Téléphone <span className="text-[#FF3B30]">*</span>
                </label>
                <input
                  type="tel"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  className={cn(inputClass, supplierErrors.phone && 'border-[#FF3B30]/40 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30]')}
                  placeholder="05/06/07XXXXXXXX"
                  maxLength={10}
                />
                {supplierErrors.phone ? (
                  <p className="text-xs text-[#FF3B30] mt-1">{supplierErrors.phone}</p>
                ) : (
                  <p className="text-[10px] text-[#AEAEB2] mt-1">Format: 05, 06 ou 07 + 8 chiffres</p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5">
                  <MapPin className="w-3.5 h-3.5 inline mr-1.5 text-[#86868B]" />
                  Adresse <span className="text-[#FF3B30]">*</span>
                </label>
                <textarea
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  rows={2}
                  className={cn(inputClass, supplierErrors.address && 'border-[#FF3B30]/40 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30]')}
                  placeholder="Adresse complète"
                />
                {supplierErrors.address && <p className="text-xs text-[#FF3B30] mt-1">{supplierErrors.address}</p>}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-6 border-t border-black/[0.04]">
              <button
                onClick={() => {
                  setShowSupplierModal(false);
                  setSupplierForm({ ...emptySupplierForm });
                  setSupplierErrors({});
                }}
                className="glass-btn flex-1 px-4 py-3 rounded-full border border-black/[0.04] text-[#1D1D1F] font-medium hover:bg-black/5 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateSupplier}
                disabled={isCreatingSupplier}
                className="glass-btn flex-1 px-4 py-3 rounded-full bg-[#EC7620] text-white font-semibold hover:bg-[#EC7620]/90 disabled:bg-[#D1D1D6] transition-colors flex items-center justify-center gap-2"
              >
                {isCreatingSupplier ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Créer le fournisseur
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
