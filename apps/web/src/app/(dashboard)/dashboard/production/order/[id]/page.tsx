'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  Factory, Package, ArrowLeft, Play, CheckCircle, X, Clock,
  AlertTriangle, Beaker, Box, Calendar, TrendingUp, Download
} from 'lucide-react';
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ProductionOrder {
  id: number;
  reference: string;
  productPfId: number;
  productPf: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
  recipe: {
    id: number;
    name: string;
    batchWeight: number;
    outputQuantity: number;
    shelfLifeDays: number;
    items: {
      id: number;
      productMp: { code: string; name: string; unit: string };
      quantity: number;
      unit: string;
    }[];
  } | null;
  batchCount: number;
  targetQuantity: number;
  quantityProduced: number;
  batchWeightReal: number | null;
  yieldPercentage: number | null;
  status: string;
  qualityNotes: string | null;
  qualityStatus: string | null;
  startedAt: string | null;
  completedAt: string | null;
  user: { firstName: string; lastName: string };
  consumptions: {
    id: number;
    productMp: { code: string; name: string; unit: string };
    lotMp: { lotNumber: string; expiryDate: string | null } | null;
    quantityPlanned: number;
    quantityConsumed: number;
  }[];
  lots: {
    id: number;
    lotNumber: string;
    quantityInitial: number;
    quantityRemaining: number;
    manufactureDate: string;
    expiryDate: string | null;
  }[];
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};


const statusConfig: Record<string, {
  label: string;
  tint: string;
  textColor: string;
  icon: typeof Clock;
  headerVariant: 'default' | 'success' | 'warning' | 'error' | 'info';
}> = {
  PENDING: { label: 'En attente', tint: 'glass-tint-neutral', textColor: 'text-[#1D1D1F]', icon: Clock, headerVariant: 'warning' },
  IN_PROGRESS: { label: 'En cours', tint: 'glass-tint-blue', textColor: 'text-blue-700', icon: Play, headerVariant: 'info' },
  COMPLETED: { label: 'Terminée', tint: 'glass-tint-emerald', textColor: 'text-emerald-700', icon: CheckCircle, headerVariant: 'success' },
  CANCELLED: { label: 'Annulée', tint: 'glass-tint-red', textColor: 'text-red-700', icon: X, headerVariant: 'error' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ProductionOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orderId = params.id as string;

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Complete form
  const [completeForm, setCompleteForm] = useState({
    quantityProduced: 0,
    batchWeightReal: 0,
    qualityStatus: 'OK',
    qualityNotes: '',
  });
  const [cancelReason, setCancelReason] = useState('');

  const isAdmin = user?.role === 'ADMIN';
  const canManage = isAdmin || user?.role === 'PRODUCTION';

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/production/${orderId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Ordre de production introuvable');
      const data = await res.json();
      setOrder(data);

      // Pre-fill complete form
      if (data.recipe) {
        setCompleteForm({
          quantityProduced: data.targetQuantity,
          batchWeightReal: data.recipe.batchWeight * data.batchCount,
          qualityStatus: 'OK',
          qualityNotes: '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleDownloadPdf = async () => {
    if (!order) return;
    setIsDownloadingPdf(true);
    try {
      const res = await authFetch(`/production/${order.id}/pdf`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur téléchargement PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Production-${order.reference}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur téléchargement');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleStart = async () => {
    if (!order || !confirm('Démarrer cette production ? Les matières premières seront consommées.')) return;
    setIsStarting(true);
    try {
      const res = await authFetch(`/production/${order.id}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur');
      }
      await loadOrder();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsStarting(false);
    }
  };

  const handleComplete = async () => {
    if (!order) return;
    setIsCompleting(true);
    try {
      const res = await authFetch(`/production/${order.id}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(completeForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur');
      }
      setShowCompleteModal(false);
      await loadOrder();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    setIsCancelling(true);
    try {
      const res = await authFetch(`/production/${order.id}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur');
      }
      setShowCancelModal(false);
      await loadOrder();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsCancelling(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        {/* Info cards skeleton */}
        <div className="grid grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-6">
              <Skeleton className="h-5 w-24 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
        {/* Content skeleton */}
        <SkeletonTable rows={5} columns={4} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="glass-bg flex items-center justify-center h-96">
        <div className="glass-card p-8 text-center animate-slide-up max-w-sm">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-red-500/10 to-red-500/5 rounded-[14px] flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-[#1D1D1F] font-medium mb-1">Erreur</p>
          <p className="text-sm text-[#86868B] mb-4">{error || 'Ordre introuvable'}</p>
          <button
            onClick={() => router.push('/dashboard/production')}
            className="px-4 py-2 bg-red-500/10 text-red-600 rounded-full text-sm font-medium hover:bg-red-500/20 transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const status = statusConfig[order.status] || statusConfig.PENDING;

  return (
    <div className="glass-bg space-y-6">
      <PageHeader
        title={order.reference}
        subtitle={`Produit: ${order.productPf.name} (${order.productPf.code})`}
        icon={<Factory className="w-5 h-5" />}
        badge={{ text: status.label, variant: status.headerVariant }}
        className="animate-slide-up"
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button onClick={() => router.push('/dashboard/production')} variant="outline">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>

            <Button onClick={handleDownloadPdf} disabled={isDownloadingPdf} variant="outline">
              <Download className="w-4 h-4" />
              {isDownloadingPdf ? 'Téléchargement...' : 'Télécharger PDF'}
            </Button>

            {canManage && (
              <>
                {order.status === 'PENDING' && (
                  <>
                    <Button onClick={handleStart} disabled={isStarting}>
                      <Play className="w-4 h-4" />
                      {isStarting ? 'Démarrage...' : 'Démarrer'}
                    </Button>
                    {isAdmin && (
                      <Button onClick={() => setShowCancelModal(true)} variant="destructive">
                        <X className="w-4 h-4" />
                        Annuler
                      </Button>
                    )}
                  </>
                )}
                {order.status === 'IN_PROGRESS' && (
                  <>
                    <Button onClick={() => setShowCompleteModal(true)} variant="amber">
                      <CheckCircle className="w-4 h-4" />
                      Terminer
                    </Button>
                    {isAdmin && (
                      <Button onClick={() => setShowCancelModal(true)} variant="destructive">
                        <X className="w-4 h-4" />
                        Annuler
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      />

      {/* Main Info */}
      <div className="grid grid-cols-3 gap-6">
        {/* Product Card */}
        <div className="glass-card p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 rounded-[12px] flex items-center justify-center">
              <Package className="w-5 h-5 text-[#AF52DE]" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#86868B]">Produit</p>
              <p className="font-semibold text-[#1D1D1F]">{order.productPf.name}</p>
            </div>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[#86868B]">Code</span>
              <span className="font-mono text-[#1D1D1F]">{order.productPf.code}</span>
            </div>
            <div className="border-t border-black/[0.04]" />
            <div className="flex justify-between items-center">
              <span className="text-[#86868B]">Unité</span>
              <span className="text-[#1D1D1F]">{order.productPf.unit}</span>
            </div>
          </div>
        </div>

        {/* Quantity Card */}
        <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-[12px] flex items-center justify-center">
              <Box className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#86868B]">Quantités</p>
              <p className="font-semibold text-[#1D1D1F]">{order.batchCount} batch(s)</p>
            </div>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[#86868B]">Cible</span>
              <span className="font-semibold text-[#1D1D1F]">{order.targetQuantity} {order.productPf.unit}</span>
            </div>
            <div className="border-t border-black/[0.04]" />
            <div className="flex justify-between items-center">
              <span className="text-[#86868B]">Produit</span>
              {order.status === 'COMPLETED' || order.quantityProduced > 0 ? (
                <span className={cn('font-semibold', order.quantityProduced > 0 ? 'text-emerald-600' : '')}>
                  {order.quantityProduced} {order.productPf.unit}
                </span>
              ) : (
                <span className="text-[#AEAEB2] text-sm italic">En attente</span>
              )}
            </div>
            {order.yieldPercentage && (
              <>
                <div className="border-t border-black/[0.04]" />
                <div className="flex justify-between items-center">
                  <span className="text-[#86868B]">Rendement</span>
                  <span className={cn(
                    'glass-pill font-semibold text-xs',
                    order.yieldPercentage >= 95 ? 'text-emerald-600' : order.yieldPercentage >= 85 ? 'text-yellow-600' : 'text-red-600'
                  )}>
                    {order.yieldPercentage.toFixed(1)}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Timeline Card */}
        <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-[#86868B]/10 to-[#86868B]/5 rounded-[12px] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#6E6E73]" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#86868B]">Timeline</p>
              <p className="font-semibold text-[#1D1D1F]">{formatDate(order.createdAt)}</p>
            </div>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[#86868B]">Créé par</span>
              <span className="text-[#1D1D1F]">{order.user.firstName} {order.user.lastName}</span>
            </div>
            {order.startedAt && (
              <>
                <div className="border-t border-black/[0.04]" />
                <div className="flex justify-between items-center">
                  <span className="text-[#86868B]">Démarré</span>
                  <span className="text-[#1D1D1F]">{formatDate(order.startedAt)}</span>
                </div>
              </>
            )}
            {order.completedAt && (
              <>
                <div className="border-t border-black/[0.04]" />
                <div className="flex justify-between items-center">
                  <span className="text-[#86868B]">Terminé</span>
                  <span className="text-[#1D1D1F]">{formatDate(order.completedAt)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Consumptions */}
      {order.consumptions.length > 0 && (
        <div className="glass-card overflow-hidden animate-slide-up">
          <div className="p-5 border-b border-black/[0.04]">
            <h2 className="font-semibold text-[#1D1D1F] flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 rounded-[8px] flex items-center justify-center">
                <Beaker className="w-4 h-4 text-[#AF52DE]" />
              </div>
              Consommations MP
              <span className="glass-pill text-xs text-[#86868B] ml-1">{order.consumptions.length}</span>
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/[0.04]">
                <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-[#86868B]">Matière première</th>
                <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-[#86868B]">Lot</th>
                <th className="px-5 py-3 text-right text-[11px] uppercase tracking-wider font-medium text-[#86868B]">Prévu</th>
                <th className="px-5 py-3 text-right text-[11px] uppercase tracking-wider font-medium text-[#86868B]">Consommé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {order.consumptions.map((c) => (
                <tr key={c.id} className="hover:bg-black/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs text-[#86868B] mr-2">{c.productMp.code}</span>
                    <span className="text-[#1D1D1F]">{c.productMp.name}</span>
                  </td>
                  <td className="px-5 py-3">
                    {c.lotMp ? (
                      <span className="text-sm text-[#6E6E73]">{c.lotMp.lotNumber}</span>
                    ) : (
                      <span className="text-[#AEAEB2]">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-[#1D1D1F]">{c.quantityPlanned}</td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-[#1D1D1F]">{c.quantityConsumed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lots Produced */}
      {order.lots.length > 0 && (
        <div className="glass-card overflow-hidden animate-slide-up">
          <div className="p-5 border-b border-black/[0.04]">
            <h2 className="font-semibold text-[#1D1D1F] flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-[8px] flex items-center justify-center">
                <Box className="w-4 h-4 text-emerald-600" />
              </div>
              Lots produits
              <span className="glass-pill text-xs text-[#86868B] ml-1">{order.lots.length}</span>
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/[0.04]">
                <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-[#86868B]">Numéro lot</th>
                <th className="px-5 py-3 text-right text-[11px] uppercase tracking-wider font-medium text-[#86868B]">Quantité</th>
                <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-[#86868B]">Date fabrication</th>
                <th className="px-5 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-[#86868B]">DLC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {order.lots.map((lot) => (
                <tr key={lot.id} className="hover:bg-black/[0.02] transition-colors">
                  <td className="px-5 py-3 font-mono font-medium text-emerald-700">{lot.lotNumber}</td>
                  <td className="px-5 py-3 text-right text-[#1D1D1F]">{lot.quantityInitial} {order.productPf.unit}</td>
                  <td className="px-5 py-3 text-sm text-[#1D1D1F]">{formatDate(lot.manufactureDate)}</td>
                  <td className="px-5 py-3 text-sm text-[#1D1D1F]">
                    {lot.expiryDate ? formatDate(lot.expiryDate) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quality Notes */}
      {(order.qualityStatus || order.qualityNotes) && (
        <div className="glass-card p-6 animate-slide-up">
          <h2 className="font-semibold text-[#1D1D1F] mb-4 flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-[#86868B]/10 to-[#86868B]/5 rounded-[8px] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#6E6E73]" />
            </div>
            Contrôle qualité
          </h2>
          {order.qualityStatus && (
            <p className="text-sm">
              <span className="text-[#86868B]">Statut: </span>
              <span className={cn(
                'glass-status-pill text-xs font-medium',
                order.qualityStatus === 'OK' ? 'glass-tint-emerald text-emerald-600' : 'glass-tint-orange text-yellow-600'
              )}>
                {order.qualityStatus}
              </span>
            </p>
          )}
          {order.qualityNotes && (
            <p className="text-sm mt-2 text-[#6E6E73]">{order.qualityNotes}</p>
          )}
        </div>
      )}

      {/* Complete Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="absolute inset-0" onClick={() => setShowCompleteModal(false)} />
          <div className="relative glass-card rounded-[20px] w-full max-w-md p-6 animate-slide-up">
            <h2 className="text-lg font-semibold text-[#1D1D1F] mb-4">Terminer la production</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-medium text-[#86868B] mb-1.5">
                  Quantité produite
                </label>
                <input
                  type="number"
                  value={completeForm.quantityProduced}
                  onChange={(e) => setCompleteForm({ ...completeForm, quantityProduced: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 bg-black/[0.03] border border-black/[0.06] rounded-xl text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#AF52DE]/30 focus:border-[#AF52DE]/40 transition-all"
                />
                <p className="text-xs text-[#86868B] mt-1">Cible: {order.targetQuantity} {order.productPf.unit}</p>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-medium text-[#86868B] mb-1.5">
                  Poids réel (g)
                </label>
                <input
                  type="number"
                  value={completeForm.batchWeightReal}
                  onChange={(e) => setCompleteForm({ ...completeForm, batchWeightReal: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 bg-black/[0.03] border border-black/[0.06] rounded-xl text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#AF52DE]/30 focus:border-[#AF52DE]/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-medium text-[#86868B] mb-1.5">
                  Statut qualité
                </label>
                <select
                  value={completeForm.qualityStatus}
                  onChange={(e) => setCompleteForm({ ...completeForm, qualityStatus: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/[0.03] border border-black/[0.06] rounded-xl text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#AF52DE]/30 focus:border-[#AF52DE]/40 transition-all"
                >
                  <option value="OK">OK</option>
                  <option value="DEFAUT_MINEUR">Défaut mineur</option>
                  <option value="DEFAUT_MAJEUR">Défaut majeur</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-medium text-[#86868B] mb-1.5">
                  Notes qualité
                </label>
                <textarea
                  value={completeForm.qualityNotes}
                  onChange={(e) => setCompleteForm({ ...completeForm, qualityNotes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/[0.03] border border-black/[0.06] rounded-xl text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#AF52DE]/30 focus:border-[#AF52DE]/40 transition-all resize-none"
                  rows={2}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="px-5 py-2 text-[#1D1D1F] glass-card-hover rounded-full text-sm font-medium transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleComplete}
                disabled={isCompleting || completeForm.quantityProduced <= 0}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-full text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {isCompleting ? 'Enregistrement...' : 'Terminer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="absolute inset-0" onClick={() => setShowCancelModal(false)} />
          <div className="relative glass-card rounded-[20px] w-full max-w-md p-6 animate-slide-up">
            <h2 className="text-lg font-semibold mb-4 text-red-600">Annuler la production</h2>
            <p className="text-sm text-[#6E6E73] mb-4">
              {order.status === 'IN_PROGRESS'
                ? 'Les matières premières consommées seront restituées au stock.'
                : 'Cette action annulera l\'ordre de production.'
              }
            </p>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-medium text-[#86868B] mb-1.5">
                Raison de l&apos;annulation
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/[0.03] border border-black/[0.06] rounded-xl text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 transition-all resize-none"
                rows={3}
                placeholder="Raison de l'annulation..."
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-5 py-2 text-[#1D1D1F] glass-card-hover rounded-full text-sm font-medium transition-all"
              >
                Retour
              </button>
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <X className="w-4 h-4" />
                {isCancelling ? 'Annulation...' : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
