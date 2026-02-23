'use client';

import { authFetch } from '@/lib/api';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { useFocusTrap, useEscapeKey } from '@/lib/hooks/use-focus-trap';
import {
  Truck, Phone, MapPin, FileText, Building2, Pencil, History,
  X, ChevronLeft, ChevronRight, Package, ArrowLeft, Save, Trash2,
  AlertTriangle, Check, Info
} from 'lucide-react';
import { createLogger } from '@/lib/logger';

const log = createLogger('SupplierDetail');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Supplier {
  id: number;
  code: string;
  name: string;
  rc: string;
  nif: string;
  ai: string;
  nis: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  _count?: { receptions: number; lots: number };
}

interface ReceptionLine {
  id: number;
  product: { code: string; name: string; unit: string };
  quantity: number;
  unitCost: number | null;
  lineTotal: number;
}

interface Reception {
  id: number;
  reference: string;
  date: string;
  blNumber: string | null;
  status: string;
  lines: ReceptionLine[];
  total: number;
}

interface HistoryData {
  supplier: { id: number; code: string; name: string };
  filters: { year?: number; month?: number; from?: string; to?: string };
  pagination: { page: number; limit: number; total: number; totalPages: number };
  totals: { receptions: number; lines: number; totalQuantity: number; totalAmount: number };
  receptions: Reception[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const MONTHS = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Décembre' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  supplierName: string;
  isLoading: boolean;
  canDelete: boolean | null;
  canDeleteMessage: string;
}

function DeleteModal({ isOpen, onClose, onConfirm, supplierName, isLoading, canDelete, canDeleteMessage }: DeleteModalProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div ref={trapRef} className="relative glass-card w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-[#FF3B30]/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-[#FF3B30]" />
          </div>
          <div>
            <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Desactiver le fournisseur</h3>
            <p className="text-sm text-[#86868B]">{supplierName}</p>
          </div>
        </div>

        {canDelete === false ? (
          <div className="bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-[10px] p-4 mb-4">
            <p className="text-sm text-[#FF3B30]">{canDeleteMessage}</p>
          </div>
        ) : (
          <div className="bg-[#FF9500]/5 border border-[#FF9500]/20 rounded-[10px] p-4 mb-4">
            <p className="text-sm text-[#FF9500]">
              Cette action va desactiver le fournisseur. Il ne sera plus visible dans les listes
              mais les donnees historiques seront conservees.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium"
          >
            Annuler
          </button>
          {canDelete !== false && (
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="px-5 py-2.5 bg-[#FF3B30] text-white text-sm font-semibold rounded-full hover:bg-[#D63029] shadow-lg shadow-[#FF3B30]/25 transition-all active:scale-[0.97] disabled:opacity-50"
            >
              {isLoading ? 'Desactivation...' : 'Desactiver'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const supplierId = params.id as string;

  // State
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info');

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    rc: '',
    nif: '',
    ai: '',
    nis: '',
    phone: '',
    address: '',
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [canDelete, setCanDelete] = useState<boolean | null>(null);
  const [canDeleteMessage, setCanDeleteMessage] = useState('');

  // History state
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filters, setFilters] = useState({
    year: currentYear as number | undefined,
    month: undefined as number | undefined,
    from: '',
    to: '',
  });
  const [page, setPage] = useState(1);

  const isAdmin = user?.role === 'ADMIN';

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  const loadSupplier = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/suppliers/${supplierId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Fournisseur introuvable');
      }
      const data = await res.json();
      setSupplier(data);
      setEditForm({
        name: data.name || '',
        rc: data.rc || '',
        nif: data.nif || '',
        ai: data.ai || '',
        nis: data.nis || '',
        phone: data.phone || '',
        address: data.address || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [supplierId]);

  const loadHistory = useCallback(async () => {
    if (!supplier) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.set('year', String(filters.year));
      if (filters.month) params.set('month', String(filters.month));
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      params.set('page', String(page));
      params.set('limit', '10');

      const res = await authFetch(
        `/suppliers/${supplierId}/history?${params}`,
      );
      if (res.ok) {
        setHistoryData(await res.json());
      }
    } catch (error) {
      log.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [supplier, filters, page, supplierId]);

  const checkCanDelete = useCallback(async () => {
    try {
      const res = await authFetch(`/suppliers/${supplierId}/can-delete`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCanDelete(data.canDelete);
        setCanDeleteMessage(data.message || '');
      }
    } catch (error) {
      log.error('Failed to check delete status:', error);
    }
  }, [supplierId]);

  useEffect(() => {
    loadSupplier();
  }, [loadSupplier]);

  useEffect(() => {
    if (activeTab === 'history' && supplier) {
      loadHistory();
    }
  }, [activeTab, supplier, loadHistory]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (showDeleteModal) {
      checkCanDelete();
    }
  }, [showDeleteModal, checkCanDelete]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleSave = async () => {
    setIsSaving(true);
    setEditError(null);
    try {
      const res = await authFetch(`/suppliers/${supplierId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur lors de la sauvegarde');
      }
      const updated = await res.json();
      setSupplier(updated);
      setIsEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Erreur de sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (supplier) {
      setEditForm({
        name: supplier.name || '',
        rc: supplier.rc || '',
        nif: supplier.nif || '',
        ai: supplier.ai || '',
        nis: supplier.nis || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
      });
    }
    setEditError(null);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await authFetch(`/suppliers/${supplierId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur lors de la desactivation');
      }
      router.push('/dashboard/appro/fournisseurs');
    } catch (err) {
      setCanDeleteMessage(err instanceof Error ? err.message : 'Erreur');
      setCanDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="space-y-6 animate-slide-up">
        {/* Header skeleton */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
        {/* Tab skeleton */}
        <div className="flex gap-3">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-44 rounded-full" />
        </div>
        {/* Content skeleton */}
        <SkeletonTable rows={6} columns={2} />
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="p-8 animate-slide-up">
        <div className="glass-card p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#FF3B30]/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-[#FF3B30]" />
          </div>
          <h2 className="text-lg font-semibold text-[#FF3B30] mb-2">Erreur</h2>
          <p className="text-[#86868B] mb-4">{error || 'Fournisseur introuvable'}</p>
          <button
            onClick={() => router.push('/dashboard/appro/fournisseurs')}
            className="px-5 py-2.5 bg-[#FF3B30] text-white text-sm font-semibold rounded-full hover:bg-[#D63029] shadow-lg shadow-[#FF3B30]/25 transition-all active:scale-[0.97]"
          >
            Retour a la liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title={supplier.name}
        subtitle={supplier.code}
        icon={<Truck className="w-5 h-5" />}
        badge={supplier.isActive ? { text: 'Actif', variant: 'success' } : { text: 'Inactif', variant: 'error' }}
        actions={(
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button onClick={() => router.push('/dashboard/appro/fournisseurs')} variant="outline">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>

            {isAdmin && supplier.isActive && (
              <>
                {!isEditing && activeTab === 'info' && (
                  <Button onClick={() => setIsEditing(true)}>
                    <Pencil className="w-4 h-4" />
                    Modifier
                  </Button>
                )}
                <Button onClick={() => setShowDeleteModal(true)} variant="destructive">
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
              </>
            )}
          </div>
        )}
      />

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('info')}
          className={cn(
            'px-4 py-2 text-[13px] font-medium rounded-full transition-all',
            activeTab === 'info'
              ? 'bg-[#1D1D1F] text-white'
              : 'glass-pill text-[#86868B] hover:text-[#1D1D1F]'
          )}
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Informations
          </div>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'px-4 py-2 text-[13px] font-medium rounded-full transition-all',
            activeTab === 'history'
              ? 'bg-[#1D1D1F] text-white'
              : 'glass-pill text-[#86868B] hover:text-[#1D1D1F]'
          )}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Historique Receptions
          </div>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="glass-card">
          {/* Edit Error */}
          {editError && (
            <div className="mx-6 mt-6 p-4 bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-[10px]">
              <p className="text-sm text-[#FF3B30]">{editError}</p>
            </div>
          )}

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Nom</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                />
              ) : (
                <p className="text-[#1D1D1F] font-medium">{supplier.name}</p>
              )}
            </div>

            {/* Code (readonly) */}
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Code</label>
              <p className="text-[#1D1D1F] font-mono bg-black/[0.03] px-4 py-2.5 rounded-[10px]">{supplier.code}</p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Statut</label>
              <span className={cn(
                'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm',
                supplier.isActive ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#FF3B30]/10 text-[#FF3B30]'
              )}>
                {supplier.isActive ? (
                  <>
                    <Check className="w-3 h-3" />
                    Actif
                  </>
                ) : (
                  <>
                    <X className="w-3 h-3" />
                    Inactif
                  </>
                )}
              </span>
            </div>

            {/* RC */}
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                <Building2 className="w-4 h-4 inline mr-1" />
                Registre de Commerce (RC)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.rc}
                  onChange={(e) => setEditForm({ ...editForm, rc: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                />
              ) : (
                <p className="text-[#1D1D1F]">{supplier.rc || '-'}</p>
              )}
            </div>

            {/* NIF */}
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                <FileText className="w-4 h-4 inline mr-1" />
                NIF
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.nif}
                  onChange={(e) => setEditForm({ ...editForm, nif: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                />
              ) : (
                <p className="text-[#1D1D1F]">{supplier.nif || '-'}</p>
              )}
            </div>

            {/* AI */}
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                <FileText className="w-4 h-4 inline mr-1" />
                Article d'Imposition (AI)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.ai}
                  onChange={(e) => setEditForm({ ...editForm, ai: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                />
              ) : (
                <p className="text-[#1D1D1F]">{supplier.ai || '-'}</p>
              )}
            </div>

            {/* NIS */}
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                <FileText className="w-4 h-4 inline mr-1" />
                NIS
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.nis}
                  onChange={(e) => setEditForm({ ...editForm, nis: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                />
              ) : (
                <p className="text-[#1D1D1F]">{supplier.nis || '-'}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                <Phone className="w-4 h-4 inline mr-1" />
                Telephone
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                />
              ) : (
                <p className="text-[#1D1D1F]">{supplier.phone || '-'}</p>
              )}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                <MapPin className="w-4 h-4 inline mr-1" />
                Adresse
              </label>
              {isEditing ? (
                <textarea
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                />
              ) : (
                <p className="text-[#1D1D1F]">{supplier.address || '-'}</p>
              )}
            </div>
          </div>

          {/* Edit Actions */}
          {isEditing && (
            <div className="px-6 py-4 bg-black/[0.02] border-t border-[#F0F0F0] flex justify-end gap-3">
              <button
                onClick={handleCancelEdit}
                className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#007AFF] text-white text-sm font-semibold rounded-full hover:bg-[#0056D6] shadow-lg shadow-[#007AFF]/25 transition-all active:scale-[0.97] disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          )}

          {/* Statistics */}
          {supplier._count && (
            <div className="px-6 py-4 border-t border-[#F0F0F0] bg-black/[0.02]">
              <div className="flex gap-8 text-sm">
                <div>
                  <span className="text-[#86868B]">Receptions:</span>{' '}
                  <span className="font-semibold text-[#1D1D1F]">{supplier._count.receptions}</span>
                </div>
                <div>
                  <span className="text-[#86868B]">Lots:</span>{' '}
                  <span className="font-semibold text-[#1D1D1F]">{supplier._count.lots}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="glass-card overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-[#F0F0F0] bg-black/[0.02]">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">Annee</label>
                <select
                  value={filters.year || ''}
                  onChange={(e) => setFilters({ ...filters, year: e.target.value ? Number(e.target.value) : undefined, month: undefined })}
                  className="px-4 py-2.5 border border-[#E5E5E5] rounded-full text-sm text-[#1D1D1F] bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                >
                  <option value="">Toutes</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">Mois</label>
                <select
                  value={filters.month || ''}
                  onChange={(e) => setFilters({ ...filters, month: e.target.value ? Number(e.target.value) : undefined })}
                  disabled={!filters.year}
                  className="px-4 py-2.5 border border-[#E5E5E5] rounded-full text-sm text-[#1D1D1F] bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] disabled:bg-black/[0.03] disabled:text-[#AEAEB2]"
                >
                  <option value="">Tous</option>
                  {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="border-l border-[#E5E5E5] pl-4">
                <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">Du</label>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilters({ ...filters, from: e.target.value, year: undefined, month: undefined })}
                  className="px-4 py-2.5 border border-[#E5E5E5] rounded-full text-sm text-[#1D1D1F] bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">Au</label>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilters({ ...filters, to: e.target.value, year: undefined, month: undefined })}
                  className="px-4 py-2.5 border border-[#E5E5E5] rounded-full text-sm text-[#1D1D1F] bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                />
              </div>
              <button
                onClick={() => setFilters({ year: currentYear, month: undefined, from: '', to: '' })}
                className="px-4 py-2.5 text-sm text-[#86868B] hover:text-[#1D1D1F] rounded-full hover:bg-black/5 transition-all"
              >
                Reinitialiser
              </button>
            </div>
          </div>

          {/* Totals */}
          {historyData && (
            <div className="px-6 py-3 bg-[#007AFF]/5 border-b border-[#007AFF]/10">
              <div className="flex items-center gap-8 text-sm">
                <div>
                  <span className="text-[#86868B]">Receptions:</span>{' '}
                  <span className="font-semibold text-[#1D1D1F]">{historyData.totals.receptions}</span>
                </div>
                <div>
                  <span className="text-[#86868B]">Quantite totale:</span>{' '}
                  <span className="font-semibold text-[#1D1D1F]">{historyData.totals.totalQuantity.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[#86868B]">Montant total:</span>{' '}
                  <span className="font-semibold text-[#004AB5]">{formatPrice(historyData.totals.totalAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {historyLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <SkeletonTable rows={2} columns={4} />
                  </div>
                ))}
              </div>
            ) : historyData?.receptions.length === 0 ? (
              <div className="text-center py-12 text-[#86868B]">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune reception trouvee pour cette periode</p>
              </div>
            ) : (
              <div className="space-y-4">
                {historyData?.receptions.map((reception) => (
                  <div key={reception.id} className="glass-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-black/[0.02]">
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-medium text-[#007AFF]">{reception.reference}</span>
                        <span className="text-sm text-[#86868B]">{formatDate(reception.date)}</span>
                        {reception.blNumber && (
                          <span className="text-sm text-[#AEAEB2]">BL: {reception.blNumber}</span>
                        )}
                        <span className={cn(
                          'px-2 py-0.5 text-xs rounded-full',
                          reception.status === 'VALIDATED' ? 'bg-[#34C759]/10 text-[#34C759]' :
                          reception.status === 'DRAFT' ? 'bg-black/5 text-[#86868B]' : 'bg-[#FF9500]/10 text-[#FF9500]'
                        )}>
                          {reception.status}
                        </span>
                      </div>
                      <span className="font-semibold text-[#1D1D1F]">{formatPrice(reception.total)}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-black/[0.02]">
                        <tr>
                          <th className="px-4 py-2 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Produit</th>
                          <th className="px-4 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Quantite</th>
                          <th className="px-4 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Cout unit.</th>
                          <th className="px-4 py-2 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F0F0]">
                        {reception.lines.map((line) => (
                          <tr key={line.id} className="hover:bg-black/[0.01] transition-colors">
                            <td className="px-4 py-2">
                              <span className="font-mono text-xs text-[#AEAEB2] mr-2">{line.product.code}</span>
                              {line.product.name}
                            </td>
                            <td className="px-4 py-2 text-right">{line.quantity} {line.product.unit}</td>
                            <td className="px-4 py-2 text-right">
                              {line.unitCost ? formatPrice(line.unitCost) : '-'}
                            </td>
                            <td className="px-4 py-2 text-right font-medium">{formatPrice(line.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {historyData && historyData.pagination.totalPages > 1 && (
            <div className="px-6 py-3 border-t border-[#F0F0F0] bg-black/[0.02] flex items-center justify-between">
              <span className="text-sm text-[#86868B]">
                Page {historyData.pagination.page} sur {historyData.pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2.5 border border-[#E5E5E5] rounded-full disabled:opacity-50 hover:bg-black/5 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(historyData.pagination.totalPages, p + 1))}
                  disabled={page === historyData.pagination.totalPages}
                  className="p-2.5 border border-[#E5E5E5] rounded-full disabled:opacity-50 hover:bg-black/5 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        supplierName={supplier.name}
        isLoading={isDeleting}
        canDelete={canDelete}
        canDeleteMessage={canDeleteMessage}
      />
    </div>
  );
}
