'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BON DE COMMANDE DETAIL — Vue détaillée avec historique
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { toast } from 'sonner';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { appro, PurchaseOrder, PurchaseOrderStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Package,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  History,
  Download,
  Ban,
} from 'lucide-react';
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';
import { createLogger } from '@/lib/logger';

const log = createLogger('BonDetail');

const statusLabel: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  CONFIRMED: 'Confirmé',
  PARTIAL: 'Partiel',
  RECEIVED: 'Reçu',
  CANCELLED: 'Annulé',
};

const statusVariant: Record<PurchaseOrderStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  SENT: 'info',
  CONFIRMED: 'info',
  PARTIAL: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'error',
};

function HistoryItem({ 
  icon: Icon, 
  label, 
  date, 
  user 
}: { 
  icon: typeof Clock; 
  label: string; 
  date: string | null; 
  user?: { firstName: string; lastName: string } | null;
}) {
  if (!date) return null;
  
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="p-2 bg-[#F5F5F5] rounded-full">
        <Icon className="w-4 h-4 text-[#6E6E73]" />
      </div>
      <div>
        <p className="font-medium text-[#1D1D1F]">{label}</p>
        <p className="text-sm text-[#86868B]">
          {new Date(date).toLocaleString('fr-FR')}
          {user && ` par ${user.firstName} ${user.lastName}`}
        </p>
      </div>
    </div>
  );
}

export default function BcDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [bc, setBc] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // P0.3: Protection double-clic avec idempotency key
  const idempotencyKeyRef = useRef<string | null>(null);
  
  // P0.2: Modal annulation
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  
  // P0.1: Modal envoi avec preuve
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendVia, setSendVia] = useState<'EMAIL' | 'MANUAL'>('EMAIL');
  const [sendEmail, setSendEmail] = useState('');
  const [sendProofNote, setSendProofNote] = useState('');
  
  const isAdmin = user?.role === 'ADMIN';
  const { confirm, Dialog: ConfirmDialogEl } = useConfirmDialog();

  const loadData = useCallback(async () => {
    try {
      const data = await appro.getPurchaseOrder(params.id as string);
      setBc(data);
    } catch (err) {
      log.error('Failed to load BC', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // P0.3: Générer une clé d'idempotence unique
  const generateIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    return idempotencyKeyRef.current;
  };
  
  // Réinitialiser la clé après action réussie
  const resetIdempotencyKey = () => {
    idempotencyKeyRef.current = null;
  };

  // P0.1: Envoi BC avec preuve traçable
  const handleSendSubmit = async () => {
    if (!bc) return;
    
    // Validation
    if (sendVia === 'EMAIL' && !sendEmail) {
      toast.error('Email fournisseur obligatoire');
      return;
    }
    if (sendVia === 'MANUAL' && sendProofNote.length < 20) {
      toast.error('La note de preuve doit contenir au moins 20 caractères');
      return;
    }
    
    setIsActioning(true);
    try {
      await appro.sendPurchaseOrder(bc.id, {
        sendVia,
        supplierEmail: sendVia === 'EMAIL' ? sendEmail : undefined,
        proofNote: sendVia === 'MANUAL' ? sendProofNote : undefined,
        idempotencyKey: generateIdempotencyKey(),
      });
      resetIdempotencyKey();
      setShowSendModal(false);
      loadData();
    } catch (err: unknown) {
      log.error('Failed to send BC', { error: err instanceof Error ? err.message : String(err) });
      toast.error((err as Error).message || 'Erreur lors de l\'envoi');
    } finally {
      setIsActioning(false);
    }
  };
  
  // P0.2: Annulation BC sécurisée
  const handleCancelSubmit = async () => {
    if (!bc) return;
    
    if (cancelReason.length < 10) {
      toast.error('Le motif doit contenir au moins 10 caractères');
      return;
    }
    
    setIsCancelling(true);
    try {
      await appro.cancelPurchaseOrder(bc.id, {
        reason: cancelReason,
        idempotencyKey: generateIdempotencyKey(),
      });
      resetIdempotencyKey();
      setShowCancelModal(false);
      loadData();
    } catch (err: unknown) {
      log.error('Failed to cancel BC', { error: err instanceof Error ? err.message : String(err) });
      toast.error((err as Error).message || 'Erreur lors de l\'annulation');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirm = async () => {
    if (!bc) return;
    const confirmed = await confirm({
      title: `Confirmer le BC ${bc.reference} ?`,
      description: `Cette action marquera le bon de commande comme confirmé auprès du fournisseur ${bc.supplier.name}.`,
      confirmLabel: 'Confirmer',
    });
    if (!confirmed) return;
    setIsActioning(true);
    try {
      await appro.confirmPurchaseOrder(bc.id);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la confirmation');
    } finally {
      setIsActioning(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!bc) return;
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/appro/purchase-orders/${bc.id}/pdf`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erreur téléchargement');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BC-${bc.reference}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      log.error('Failed to download PDF', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Erreur lors du téléchargement du PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-bg space-y-6 animate-fade-in">
        {/* Skeleton header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-36 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>
        {/* Skeleton detail card */}
        <div className="rounded-[28px] border border-black/[0.04] bg-white/60 p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </div>
        {/* Skeleton lines table */}
        <SkeletonTable rows={4} columns={6} />
      </div>
    );
  }

  if (!bc) {
    return (
      <div className="bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-lg p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-[#FF3B30] mx-auto" />
        <p className="mt-4 text-[#FF3B30] font-medium">Bon de commande non trouvé</p>
        <Link
          href="/dashboard/appro/bons"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#FF3B30] text-white rounded-lg hover:bg-[#FF3B30]/90"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={bc.reference}
        subtitle="Bon de commande fournisseur"
        icon={<Truck className="w-5 h-5" />}
        badge={{ text: statusLabel[bc.status], variant: statusVariant[bc.status] }}
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/appro/bons">
                <ArrowLeft className="w-4 h-4" />
                Retour
              </Link>
            </Button>

            <Button onClick={handleDownloadPdf} disabled={isDownloading} variant="outline">
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Télécharger PDF
            </Button>

            {bc.status === 'DRAFT' && (
              <Button
                onClick={() => {
                  setSendEmail(bc.supplier.email || '');
                  setShowSendModal(true);
                }}
                disabled={isActioning}
                variant="amber"
              >
                <Send className="w-4 h-4" />
                Envoyer
              </Button>
            )}

            {isAdmin && ['DRAFT', 'SENT', 'CONFIRMED'].includes(bc.status) && (
              <Button onClick={() => setShowCancelModal(true)} disabled={isCancelling} variant="destructive">
                <Ban className="w-4 h-4" />
                Annuler BC
              </Button>
            )}

            {bc.status === 'SENT' && (
              <Button onClick={handleConfirm} disabled={isActioning}>
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirmer
              </Button>
            )}

            {(bc.status === 'SENT' || bc.status === 'CONFIRMED' || bc.status === 'PARTIAL') && (
              <Button asChild>
                <Link href={`/dashboard/appro/bons/${bc.id}/receive`}>
                  <Package className="w-4 h-4" />
                  Réceptionner
                </Link>
              </Button>
            )}
          </div>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations principales */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fournisseur & Demande source */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary-600" />
              Informations
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[#86868B]">Fournisseur</p>
                <p className="font-medium text-[#1D1D1F]">{bc.supplier.name}</p>
                <p className="text-xs text-[#86868B]">{bc.supplier.code}</p>
              </div>
              {bc.expectedDelivery && (
                <div>
                  <p className="text-sm text-[#86868B]">Livraison prévue</p>
                  <p className="font-medium text-[#1D1D1F]">
                    {new Date(bc.expectedDelivery).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
              {bc.deliveryAddress && (
                <div>
                  <p className="text-sm text-[#86868B]">Adresse livraison</p>
                  <p className="font-medium text-[#1D1D1F]">{bc.deliveryAddress}</p>
                </div>
              )}
            </div>
            {bc.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-[#86868B]">Notes</p>
                <p className="text-[#1D1D1F]">{bc.notes}</p>
              </div>
            )}
          </div>

          {/* Articles */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-600" />
                Articles ({bc.items.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#FAFAFA]">
                  <tr>
                    <th className="text-left p-4 text-xs font-medium text-[#86868B] uppercase">Produit</th>
                    <th className="text-right p-4 text-xs font-medium text-[#86868B] uppercase">Qté commandée</th>
                    <th className="text-right p-4 text-xs font-medium text-[#86868B] uppercase">Qté reçue</th>
                    <th className="text-right p-4 text-xs font-medium text-[#86868B] uppercase">Prix unit.</th>
                    <th className="text-right p-4 text-xs font-medium text-[#86868B] uppercase">TVA</th>
                    <th className="text-right p-4 text-xs font-medium text-[#86868B] uppercase">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {bc.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FAFAFA]">
                      <td className="p-4">
                        <p className="font-medium text-[#1D1D1F]">{item.productMp.name}</p>
                        <p className="text-xs text-[#86868B]">{item.productMp.code}</p>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-medium">{item.quantity}</span>
                        <span className="text-[#86868B] text-sm ml-1">{item.productMp.unit}</span>
                      </td>
                      <td className="p-4 text-right">
                        <span className={cn(
                          'font-medium',
                          item.quantityReceived >= item.quantity ? 'text-[#34C759]' :
                          item.quantityReceived > 0 ? 'text-[#FF9500]' : 'text-[#AEAEB2]'
                        )}>
                          {item.quantityReceived}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {item.unitPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
                      </td>
                      <td className="p-4 text-right text-[#86868B]">
                        {item.tvaRate}%
                      </td>
                      <td className="p-4 text-right font-medium">
                        {item.totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#FAFAFA] font-medium">
                  <tr>
                    <td colSpan={5} className="p-4 text-right text-[#1D1D1F]">Total HT</td>
                    <td className="p-4 text-right text-lg">
                      {bc.totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {bc.currency}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar - Historique */}
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-primary-600" />
              Historique
            </h2>
            <div className="space-y-1">
              <HistoryItem
                icon={Clock}
                label="Créé"
                date={bc.createdAt}
                user={bc.createdBy}
              />
              <HistoryItem
                icon={Send}
                label="Envoyé"
                date={bc.sentAt}
                user={bc.sentBy}
              />
              <HistoryItem
                icon={CheckCircle}
                label="Confirmé"
                date={bc.confirmedAt}
                user={bc.confirmedBy}
              />
              <HistoryItem
                icon={Package}
                label="Reçu"
                date={bc.receivedAt}
                user={bc.receivedBy}
              />
              {bc.cancelledAt && (
                <HistoryItem
                  icon={XCircle}
                  label="Annulé"
                  date={bc.cancelledAt}
                  user={null}
                />
              )}
            </div>
          </div>

          {/* Réception liée */}
          {bc.receptionMpId && (
            <div className="bg-[#34C759]/5 border border-[#34C759]/20 rounded-xl p-4">
              <p className="text-sm font-medium text-[#34C759] mb-2">Réception MP créée</p>
              <Link
                href={`/dashboard/stock/mp?reception=${bc.receptionMpId}`}
                className="text-[#34C759] hover:underline text-sm"
              >
                Voir la réception →
              </Link>
            </div>
          )}
        </div>
      </div>
      
      {/* ══════════════════════════════════════════════════════════════════════
          P0.1: MODAL ENVOI BC AVEC PREUVE TRAÇABLE
      ══════════════════════════════════════════════════════════════════════ */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-card rounded-[18px] max-w-lg w-full mx-4 overflow-hidden">
            <div className="bg-[#007AFF] px-6 py-4">
              <h2 className="font-display text-[17px] font-bold text-white tracking-tight flex items-center gap-2">
                <Send className="w-5 h-5" />
                Envoyer le BC {bc.reference}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Résumé BC */}
              <div className="bg-[#FAFAFA] rounded-lg p-4 text-sm">
                <p><strong>Fournisseur:</strong> {bc.supplier.name}</p>
                <p><strong>Montant:</strong> {bc.totalHT.toLocaleString('fr-FR')} {bc.currency}</p>
                <p><strong>Articles:</strong> {bc.items.length}</p>
              </div>
              
              {/* Mode d'envoi */}
              <div>
                <label className="block text-sm font-medium text-[#1D1D1F] mb-2">
                  Mode d'envoi <span className="text-[#FF3B30]">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sendVia"
                      value="EMAIL"
                      checked={sendVia === 'EMAIL'}
                      onChange={() => setSendVia('EMAIL')}
                      className="w-4 h-4 text-[#007AFF]"
                    />
                    <span>Email automatique</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sendVia"
                      value="MANUAL"
                      checked={sendVia === 'MANUAL'}
                      onChange={() => setSendVia('MANUAL')}
                      className="w-4 h-4 text-[#007AFF]"
                    />
                    <span>Envoi manuel (fax, téléphone...)</span>
                  </label>
                </div>
              </div>
              
              {/* Champs conditionnels */}
              {sendVia === 'EMAIL' && (
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                    Email fournisseur <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    type="email"
                    value={sendEmail}
                    onChange={(e) => setSendEmail(e.target.value)}
                    placeholder="commandes@fournisseur.dz"
                    className="w-full px-4 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-[#007AFF]"
                  />
                </div>
              )}
              
              {sendVia === 'MANUAL' && (
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                    Note de preuve <span className="text-[#FF3B30]">*</span>
                    <span className="text-[#AEAEB2] font-normal ml-1">(min 20 caractères)</span>
                  </label>
                  <textarea
                    value={sendProofNote}
                    onChange={(e) => setSendProofNote(e.target.value)}
                    placeholder="Ex: Envoyé par fax au 021 XX XX XX, confirmation reçue par téléphone de M. Ahmed à 14h30"
                    rows={3}
                    className="w-full px-4 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-[#007AFF]"
                  />
                  <p className="text-xs text-[#86868B] mt-1">
                    {sendProofNote.length}/20 caractères minimum
                  </p>
                </div>
              )}
              
              <div className="bg-[#FF9500]/5 border border-[#FF9500]/20 rounded-lg p-3 text-sm text-[#FF9500]">
                <strong>⚠️ Important:</strong> Cette action est irréversible. 
                Le BC sera marqué comme envoyé avec une preuve horodatée.
              </div>
            </div>
            
            <div className="px-6 py-4 bg-[#FAFAFA] flex justify-end gap-3">
              <button
                onClick={() => setShowSendModal(false)}
                disabled={isActioning}
                className="px-4 py-2 text-[#1D1D1F] hover:bg-[#E5E5E5] rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleSendSubmit}
                disabled={isActioning || (sendVia === 'EMAIL' && !sendEmail) || (sendVia === 'MANUAL' && sendProofNote.length < 20)}
                className="flex items-center gap-2 px-6 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#007AFF]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Confirmer l'envoi
              </button>
            </div>
          </div>
        </div>
      )}
      
      <ConfirmDialogEl />

      {/* ══════════════════════════════════════════════════════════════════════
          P0.2: MODAL ANNULATION BC SÉCURISÉE
      ══════════════════════════════════════════════════════════════════════ */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-card rounded-[18px] max-w-lg w-full mx-4 overflow-hidden">
            <div className="bg-[#FF3B30] px-6 py-4">
              <h2 className="font-display text-[17px] font-bold text-white tracking-tight flex items-center gap-2">
                <Ban className="w-5 h-5" />
                Annuler le BC {bc.reference}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Résumé BC */}
              <div className="bg-[#FAFAFA] rounded-lg p-4 text-sm">
                <p><strong>Fournisseur:</strong> {bc.supplier.name}</p>
                <p><strong>Montant:</strong> {bc.totalHT.toLocaleString('fr-FR')} {bc.currency}</p>
                <p><strong>Statut actuel:</strong> {bc.status}</p>
              </div>
              
              {/* Motif obligatoire */}
              <div>
                <label className="block text-sm font-medium text-[#1D1D1F] mb-1">
                  Motif d'annulation <span className="text-[#FF3B30]">*</span>
                  <span className="text-[#AEAEB2] font-normal ml-1">(min 10 caractères)</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex: Erreur de quantité - BC recréé avec les bonnes valeurs"
                  rows={3}
                  className="w-full px-4 py-2 border border-[#E5E5E5] rounded-lg focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-[#86868B] mt-1">
                  {cancelReason.length}/10 caractères minimum
                </p>
              </div>
              
              <div className="bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-lg p-3 text-sm text-[#FF3B30]">
                <strong>⚠️ ATTENTION:</strong> Cette action est <strong>IRRÉVERSIBLE</strong>. 
                Le BC sera définitivement annulé et ne pourra plus être modifié.
              </div>
            </div>
            
            <div className="px-6 py-4 bg-[#FAFAFA] flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                disabled={isCancelling}
                className="px-4 py-2 text-[#1D1D1F] hover:bg-[#E5E5E5] rounded-lg"
              >
                Fermer
              </button>
              <button
                onClick={handleCancelSubmit}
                disabled={isCancelling || cancelReason.length < 10}
                className="flex items-center gap-2 px-6 py-2 bg-[#FF3B30] text-white rounded-lg hover:bg-[#FF3B30]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                Confirmer l'annulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
