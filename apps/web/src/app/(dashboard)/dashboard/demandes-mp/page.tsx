'use client';

import { authFetch } from '@/lib/api';
import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';
// import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { useFocusTrap, useEscapeKey } from '@/lib/hooks/use-focus-trap';
import { Skeleton, SkeletonTable, SkeletonKpiGrid } from '@/components/ui/skeleton-loader';
import {
  ShoppingCart,
  Plus,
  Send,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  X,
  Package,
  ArrowRightCircle,
  FileText,
  Truck,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ProductMp {
  id: number;
  code: string;
  name: string;
  unit: string;
}

interface DemandeLigne {
  id?: number;
  productMpId: number;
  productMp?: ProductMp;
  quantiteDemandee: number;
  quantiteValidee?: number;
  commentaire?: string;
}

// Nouveaux statuts métier clairs
type DemandeStatus =
  | 'BROUILLON' | 'SOUMISE' | 'VALIDEE' | 'REJETEE'
  | 'EN_COURS_COMMANDE' | 'COMMANDEE' | 'RECEPTIONNEE'
  | 'ENVOYEE' | 'TRANSFORMEE'; // Legacy

interface Demande {
  id: number;
  reference: string;
  status: DemandeStatus;
  priority: 'NORMALE' | 'URGENTE' | 'CRITIQUE';
  commentaire?: string;
  createdAt: string;
  envoyeeAt?: string;
  validatedAt?: string;
  rejectReason?: string;
  receptionId?: number;
  createdBy: { firstName: string; lastName: string };
  validatedBy?: { firstName: string; lastName: string };
  lignes: DemandeLigne[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: DemandeStatus }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: Record<DemandeStatus, { icon: any; bg: string; text: string; label: string }> = {
    BROUILLON: { icon: Clock, bg: 'bg-[#F5F5F5]', text: 'text-[#6E6E73]', label: 'Brouillon' },
    SOUMISE: { icon: Send, bg: 'bg-[#007AFF]/10', text: 'text-[#007AFF]', label: 'Soumise' },
    VALIDEE: { icon: CheckCircle, bg: 'bg-[#34C759]/10', text: 'text-[#34C759]', label: 'Validée' },
    REJETEE: { icon: XCircle, bg: 'bg-[#FF3B30]/10', text: 'text-[#FF3B30]', label: 'Rejetée' },
    EN_COURS_COMMANDE: { icon: FileText, bg: 'bg-[#AF52DE]/10', text: 'text-[#AF52DE]', label: 'BC généré' },
    COMMANDEE: { icon: Truck, bg: 'bg-[#5856D6]/10', text: 'text-[#5856D6]', label: 'Commandée' },
    RECEPTIONNEE: { icon: Package, bg: 'bg-[#34C759]/10', text: 'text-[#34C759]', label: 'Réceptionnée' },
    // Legacy
    ENVOYEE: { icon: Send, bg: 'bg-[#007AFF]/10', text: 'text-[#007AFF]', label: 'Soumise' },
    TRANSFORMEE: { icon: FileText, bg: 'bg-[#AF52DE]/10', text: 'text-[#AF52DE]', label: 'BC généré' },
  };
  const { icon: Icon, bg, text, label } = config[status] || config.BROUILLON;

  return (
    <span className={cn('glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold', bg, text)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Demande['priority'] }) {
  const config = {
    NORMALE: { bg: 'bg-[#F5F5F5]', text: 'text-[#6E6E73]' },
    URGENTE: { bg: 'bg-[#FF9500]/10', text: 'text-[#FF9500]' },
    CRITIQUE: { bg: 'bg-[#FF3B30]/10', text: 'text-[#FF3B30]' },
  };
  const { bg, text } = config[priority];

  return (
    <span className={cn('glass-pill px-2.5 py-1 rounded-full text-[11px] font-semibold', bg, text)}>
      {priority}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE CONFIRM OVERLAY
// ═══════════════════════════════════════════════════════════════════════════════

interface ConfirmOverlayProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmOverlay({ isOpen, title, message, confirmLabel = 'Confirmer', confirmColor = 'bg-[#007AFF] hover:bg-[#0056D6] shadow-lg shadow-[#007AFF]/25', onConfirm, onCancel }: ConfirmOverlayProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(onCancel, isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div ref={trapRef} className="glass-card p-6 w-full max-w-sm text-center space-y-4" role="dialog" aria-modal="true">
        <h3 className="text-lg font-semibold text-[#1D1D1F]">{title}</h3>
        <p className="text-sm text-[#86868B] whitespace-pre-line">{message}</p>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={onCancel} className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium">
            Annuler
          </button>
          <button onClick={onConfirm} className={cn('px-5 py-2.5 text-white text-sm font-semibold rounded-full transition-all active:scale-[0.97]', confirmColor)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE REJECT MODAL (replaces window.prompt)
// ═══════════════════════════════════════════════════════════════════════════════

interface RejectModalProps {
  isOpen: boolean;
  onConfirm: (motif: string) => void;
  onCancel: () => void;
}

function RejectModal({ isOpen, onConfirm, onCancel }: RejectModalProps) {
  const [motif, setMotif] = useState('');
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(onCancel, isOpen);

  const handleConfirm = () => {
    if (!motif.trim()) {
      toast.error('Veuillez saisir un motif de rejet');
      return;
    }
    onConfirm(motif.trim());
    setMotif('');
  };

  const handleCancel = () => {
    setMotif('');
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div ref={trapRef} className="glass-card p-6 w-full max-w-md space-y-4" role="dialog" aria-modal="true">
        <h3 className="text-lg font-semibold text-[#1D1D1F]">Rejeter la demande</h3>
        <p className="text-sm text-[#86868B]">Veuillez indiquer le motif du rejet :</p>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Motif du rejet..."
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-xl bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] placeholder:text-[#86868B] resize-none"
          autoFocus
        />
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={handleCancel} className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium">
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2.5 bg-[#FF3B30] text-white text-sm font-semibold rounded-full hover:bg-[#D32F2F] shadow-lg shadow-[#FF3B30]/25 transition-all active:scale-[0.97]"
          >
            Rejeter
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL CRÉATION DEMANDE
// ═══════════════════════════════════════════════════════════════════════════════

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: ProductMp[];
}

function CreateDemandeModal({ isOpen, onClose, onSuccess, products }: CreateModalProps) {
  const [priority, setPriority] = useState<'NORMALE' | 'URGENTE' | 'CRITIQUE'>('NORMALE');
  const [commentaire, setCommentaire] = useState('');
  const [lignes, setLignes] = useState<{ productMpId: number; quantiteDemandee: number; commentaire: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(onClose, isOpen);

  const addLine = () => {
    setLignes([...lignes, { productMpId: 0, quantiteDemandee: 0, commentaire: '' }]);
  };

  const removeLine = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateLine = (index: number, field: string, value: any) => {
    const updated = [...lignes];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[index] as any)[field] = value;
    setLignes(updated);
  };

  const handleSubmit = async (sendImmediately: boolean) => {
    if (lignes.length === 0 || lignes.some(l => !l.productMpId || l.quantiteDemandee <= 0)) {
      toast.error('Veuillez ajouter au moins une ligne avec un produit et une quantité');
      return;
    }

    setIsSubmitting(true);
    try {
      // Créer la demande
      const res = await authFetch('/demandes-mp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priority, commentaire, lignes }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erreur création');
      }

      const demande = await res.json();

      // Si envoi immédiat
      if (sendImmediately) {
        await authFetch(`/demandes-mp/${demande.id}/envoyer`, {
          method: 'POST',
          credentials: 'include',
        });
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPriority('NORMALE');
    setCommentaire('');
    setLignes([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div ref={trapRef} className="glass-card w-full max-w-3xl max-h-[90vh] overflow-hidden" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#1D1D1F]">Nouvelle demande MP</h2>
              <p className="text-sm text-[#86868B]">Demander des matières premières au stock</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-[#86868B]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Priorité et commentaire */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Priorité</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'NORMALE' | 'URGENTE' | 'CRITIQUE')}
                className="w-full px-3 py-2 text-sm rounded-xl bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
              >
                <option value="NORMALE">Normale</option>
                <option value="URGENTE">Urgente</option>
                <option value="CRITIQUE">Critique (Rupture)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Commentaire</label>
              <input
                type="text"
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Motif, production planifiée..."
                className="w-full px-3 py-2 text-sm rounded-xl bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] placeholder:text-[#86868B]"
              />
            </div>
          </div>

          {/* Lignes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-[#1D1D1F]">Matières premières</label>
              <button
                onClick={addLine}
                className="text-sm text-[#007AFF] hover:text-[#0056D6] flex items-center gap-1 font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter une ligne
              </button>
            </div>

            {lignes.length === 0 ? (
              <div className="text-center py-8 bg-black/[0.02] rounded-xl border-2 border-dashed border-black/[0.06]">
                <Package className="w-8 h-8 text-[#AEAEB2] mx-auto mb-2" />
                <p className="text-[#86868B]">Aucune matière première ajoutée</p>
                <button
                  onClick={addLine}
                  className="mt-2 text-[#007AFF] hover:text-[#0056D6] text-sm font-medium transition-colors"
                >
                  Ajouter une ligne
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {lignes.map((ligne, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-black/[0.02] rounded-xl">
                    <div className="flex-1">
                      <select
                        value={ligne.productMpId}
                        onChange={(e) => updateLine(index, 'productMpId', parseInt(e.target.value))}
                        className="w-full px-2 py-1.5 text-sm rounded-lg bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                      >
                        <option value={0}>-- Sélectionner MP --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name} ({p.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={ligne.quantiteDemandee || ''}
                        onChange={(e) => updateLine(index, 'quantiteDemandee', parseFloat(e.target.value) || 0)}
                        placeholder="Quantité"
                        className="w-full px-2 py-1.5 text-sm rounded-lg bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                      />
                    </div>
                    <button
                      onClick={() => removeLine(index)}
                      className="p-1.5 text-[#FF3B30] hover:bg-[#FF3B30]/5 rounded-full transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-black/[0.04] bg-black/[0.02]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium"
            disabled={isSubmitting}
          >
            Annuler
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmit(false)}
              className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium flex items-center gap-2"
              disabled={isSubmitting || lignes.length === 0}
            >
              <Clock className="w-4 h-4" />
              Sauvegarder brouillon
            </button>
            <button
              onClick={() => handleSubmit(true)}
              className="px-5 py-2.5 bg-[#007AFF] text-white text-sm font-semibold rounded-full hover:bg-[#0056D6] shadow-lg shadow-[#007AFF]/25 transition-all active:scale-[0.97] flex items-center gap-2"
              disabled={isSubmitting || lignes.length === 0}
            >
              <Send className="w-4 h-4" />
              Envoyer au stock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

export default function DemandesMpPage() {
  const { user } = useAuth();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [products, setProducts] = useState<ProductMp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState({ brouillons: 0, soumises: 0, validees: 0, rejetees: 0, total: 0 });
  const [filter, setFilter] = useState<string>('');

  // Inline confirm state (replaces window.confirm)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmColor?: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Inline reject modal state (replaces window.prompt)
  const [rejectState, setRejectState] = useState<{
    isOpen: boolean;
    demandeId: number;
  }>({ isOpen: false, demandeId: 0 });

  const isProduction = user?.role === 'PRODUCTION';
  const canValidate = user?.role === 'ADMIN' || user?.role === 'APPRO';

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmLabel?: string, confirmColor?: string) => {
    setConfirmState({ isOpen: true, title, message, confirmLabel, confirmColor, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const loadData = useCallback(async () => {
    try {
      const [demandesRes, productsRes, statsRes] = await Promise.all([
        authFetch(`/demandes-mp${filter ? `?status=${filter}` : ''}`, { credentials: 'include' }),
        authFetch('/stock/mp', { credentials: 'include' }),
        authFetch('/demandes-mp/stats', { credentials: 'include' }),
      ]);

      if (demandesRes.ok) {
        const data = await demandesRes.json();
        setDemandes(data.demandes || []);
      }
      if (productsRes.ok) {
        const data = await productsRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProducts(data.map((p: any) => ({ id: p.productId, code: p.code, name: p.name, unit: p.unit })));
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEnvoyer = async (id: number) => {
    showConfirm(
      'Envoyer la demande',
      'Envoyer cette demande au gestionnaire de stock ?',
      async () => {
        closeConfirm();
        try {
          const res = await authFetch(`/demandes-mp/${id}/envoyer`, {
            method: 'POST',
            credentials: 'include',
          });
          if (res.ok) {
            loadData();
          }
        } catch (error) {
          console.error('Failed to send:', error);
        }
      },
      'Envoyer',
      'bg-[#007AFF] hover:bg-[#0056D6] shadow-lg shadow-[#007AFF]/25',
    );
  };

  const handleDelete = async (id: number) => {
    showConfirm(
      'Supprimer la demande',
      'Supprimer cette demande ?',
      async () => {
        closeConfirm();
        try {
          const res = await authFetch(`/demandes-mp/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (res.ok) {
            loadData();
          }
        } catch (error) {
          console.error('Failed to delete:', error);
        }
      },
      'Supprimer',
      'bg-[#FF3B30] hover:bg-[#D32F2F] shadow-lg shadow-[#FF3B30]/25',
    );
  };

  const handleValider = async (id: number) => {
    showConfirm(
      'Valider la demande',
      'Valider cette demande ?',
      async () => {
        closeConfirm();
        try {
          const res = await authFetch(`/demandes-mp/${id}/valider`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({}),
          });
          if (res.ok) {
            loadData();
          }
        } catch (error) {
          console.error('Failed to validate:', error);
        }
      },
      'Valider',
      'bg-[#34C759] hover:bg-[#2DA44E] shadow-lg shadow-[#34C759]/25',
    );
  };

  const handleRejeter = async (id: number) => {
    setRejectState({ isOpen: true, demandeId: id });
  };

  const handleRejectConfirm = async (motif: string) => {
    const id = rejectState.demandeId;
    setRejectState({ isOpen: false, demandeId: 0 });
    try {
      const res = await authFetch(`/demandes-mp/${id}/rejeter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ motif }),
      });
      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  const handleTransformer = async (id: number, reference: string) => {
    showConfirm(
      'Transformer en réception',
      `Transformer la demande ${reference} en réception MP ?\n\nCette action est irréversible.`,
      async () => {
        closeConfirm();
        try {
          const res = await authFetch(`/demandes-mp/${id}/transformer`, {
            method: 'POST',
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            toast.success(data.message);
            loadData();
          } else {
            const error = await res.json();
            toast.error(error.message);
          }
        } catch (error) {
          console.error('Failed to transform:', error);
          toast.error('Erreur lors de la transformation');
        }
      },
      'Transformer',
      'bg-[#AF52DE] hover:bg-[#9B40C8] shadow-lg shadow-[#AF52DE]/25',
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-slide-up">
        {/* Skeleton header */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
        </div>
        <SkeletonKpiGrid count={4} />
        <SkeletonTable rows={5} columns={7} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-xl flex items-center justify-center shadow-lg shadow-[#007AFF]/20">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1D1D1F]">
                Demandes d&apos;approvisionnement MP
              </h1>
              <p className="text-[#86868B]">
                {isProduction
                  ? 'Créez des demandes pour réapprovisionner le stock de matières premières'
                  : 'Gérez les demandes d\'approvisionnement de la production'}
              </p>
            </div>
          </div>
          {(isProduction || user?.role === 'ADMIN') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-[#007AFF] text-white text-sm font-semibold rounded-full hover:bg-[#0056D6] shadow-lg shadow-[#007AFF]/25 transition-all active:scale-[0.97] flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouvelle demande
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilter('')}
          className={cn('glass-card p-4 text-left transition-all', !filter && 'ring-2 ring-[#007AFF]')}
        >
          <p className="text-sm text-[#86868B]">Total</p>
          <p className="text-2xl font-bold text-[#1D1D1F]">{stats.total}</p>
        </button>
        <button
          onClick={() => setFilter('BROUILLON')}
          className={cn('glass-card p-4 text-left transition-all', filter === 'BROUILLON' && 'ring-2 ring-[#86868B]')}
        >
          <p className="text-sm text-[#86868B]">Brouillons</p>
          <p className="text-2xl font-bold text-[#6E6E73]">{stats.brouillons}</p>
        </button>
        <button
          onClick={() => setFilter('SOUMISE')}
          className={cn('glass-card p-4 text-left transition-all', filter === 'SOUMISE' && 'ring-2 ring-[#007AFF]')}
        >
          <p className="text-sm text-[#86868B]">Soumises</p>
          <p className="text-2xl font-bold text-[#007AFF]">{stats.soumises}</p>
        </button>
        <button
          onClick={() => setFilter('VALIDEE')}
          className={cn('glass-card p-4 text-left transition-all', filter === 'VALIDEE' && 'ring-2 ring-[#34C759]')}
        >
          <p className="text-sm text-[#86868B]">Validées</p>
          <p className="text-2xl font-bold text-[#34C759]">{stats.validees}</p>
        </button>
      </div>

      {/* Liste des demandes */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-black/[0.02] border-b border-black/[0.04]">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Référence</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Statut</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Priorité</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Créé par</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Lignes</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {demandes.map((demande) => (
              <tr key={demande.id} className="hover:bg-black/[0.02] transition-colors">
                <td className="px-4 py-3 font-mono text-sm font-medium text-[#1D1D1F]">{demande.reference}</td>
                <td className="px-4 py-3"><StatusBadge status={demande.status} /></td>
                <td className="px-4 py-3"><PriorityBadge priority={demande.priority} /></td>
                <td className="px-4 py-3 text-sm text-[#1D1D1F]">
                  {demande.createdBy.firstName} {demande.createdBy.lastName}
                </td>
                <td className="px-4 py-3 text-sm text-[#86868B]">
                  {new Date(demande.createdAt).toLocaleDateString('fr')}
                </td>
                <td className="px-4 py-3 text-sm text-[#1D1D1F]">{demande.lignes.length} MP</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* Actions PRODUCTION */}
                    {demande.status === 'BROUILLON' && (isProduction || user?.role === 'ADMIN') && (
                      <>
                        <button
                          onClick={() => handleEnvoyer(demande.id)}
                          className="p-1.5 text-[#007AFF] hover:bg-[#007AFF]/5 rounded-full transition-colors"
                          title="Envoyer"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(demande.id)}
                          className="p-1.5 text-[#FF3B30] hover:bg-[#FF3B30]/5 rounded-full transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* Actions ADMIN/APPRO - Validation */}
                    {demande.status === 'ENVOYEE' && canValidate && (
                      <>
                        <button
                          onClick={() => handleValider(demande.id)}
                          className="p-1.5 text-[#34C759] hover:bg-[#34C759]/5 rounded-full transition-colors"
                          title="Valider"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRejeter(demande.id)}
                          className="p-1.5 text-[#FF3B30] hover:bg-[#FF3B30]/5 rounded-full transition-colors"
                          title="Rejeter"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* Action ADMIN/APPRO - Transformation en Réception */}
                    {demande.status === 'VALIDEE' && canValidate && !demande.receptionId && (
                      <button
                        onClick={() => handleTransformer(demande.id, demande.reference)}
                        className="p-1.5 text-[#AF52DE] hover:bg-[#AF52DE]/5 rounded-full transition-colors"
                        title="Transformer en réception MP"
                      >
                        <ArrowRightCircle className="w-4 h-4" />
                      </button>
                    )}

                    {/* Voir détail */}
                    <button
                      className="p-1.5 text-[#AEAEB2] hover:bg-black/5 rounded-full transition-colors"
                      title="Voir détail"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {demandes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[#86868B]">
                  Aucune demande trouvée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal création */}
      <CreateDemandeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadData}
        products={products}
      />

      {/* Inline confirm overlay (replaces window.confirm) */}
      <ConfirmOverlay
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        confirmColor={confirmState.confirmColor}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />

      {/* Inline reject modal (replaces window.prompt) */}
      <RejectModal
        isOpen={rejectState.isOpen}
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectState({ isOpen: false, demandeId: 0 })}
      />
    </div>
  );
}
