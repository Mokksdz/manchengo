'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const GenerateBcModal = dynamic(
  () => import('@/components/appro/GenerateBcModal').then(mod => ({ default: mod.GenerateBcModal })),
  { loading: () => <div className="animate-pulse p-8">Chargement...</div> }
);
import { DemandTimeline } from '@/components/appro/DemandTimeline';
import {
  ArrowLeft,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Loader2,
  Package,
  User,
  FileText,
  AlertTriangle,
  AlertOctagon,
  ExternalLink,
  FilePlus,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton-loader';

interface ProductMp {
  id: number;
  code: string;
  name: string;
  unit: string;
  fournisseurPrincipal?: {
    id: number;
    code: string;
    name: string;
  };
  dernierPrixAchat?: number;
}

interface DemandeLigne {
  id?: number;
  productMpId: number;
  productMp?: ProductMp;
  quantiteDemandee: number;
  quantiteValidee?: number;
  commentaire?: string;
}

interface PurchaseOrder {
  id: string;
  reference: string;
  status: string;
  supplierId: number;
  supplier?: { name: string };
  totalHT: number;
  sentAt?: string | null;
  receivedAt?: string | null;
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
  purchaseOrders?: PurchaseOrder[];
}

function StatusBadge({ status }: { status: DemandeStatus }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: Record<DemandeStatus, { icon: any; bg: string; text: string; label: string }> = {
    BROUILLON: { icon: Clock, bg: 'bg-[#F5F5F5]', text: 'text-[#1D1D1F]', label: 'Brouillon' },
    SOUMISE: { icon: Send, bg: 'bg-[#007AFF]/10', text: 'text-[#007AFF]', label: 'Soumise' },
    VALIDEE: { icon: CheckCircle, bg: 'bg-[#34C759]/10', text: 'text-[#34C759]', label: 'Validée' },
    REJETEE: { icon: XCircle, bg: 'bg-[#FF3B30]/10', text: 'text-[#FF3B30]', label: 'Rejetée' },
    EN_COURS_COMMANDE: { icon: FileText, bg: 'bg-[#AF52DE]/10', text: 'text-[#AF52DE]', label: 'BC généré' },
    COMMANDEE: { icon: Truck, bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Commandée' },
    RECEPTIONNEE: { icon: Package, bg: 'bg-[#34C759]/10', text: 'text-[#34C759]', label: 'Réceptionnée' },
    // Legacy
    ENVOYEE: { icon: Send, bg: 'bg-[#007AFF]/10', text: 'text-[#007AFF]', label: 'Soumise' },
    TRANSFORMEE: { icon: FileText, bg: 'bg-[#AF52DE]/10', text: 'text-[#AF52DE]', label: 'BC généré' },
  };
  const { icon: Icon, bg, text, label } = config[status] || config.BROUILLON;
  
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium', bg, text)}>
      <Icon className="w-4 h-4" />
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Demande['priority'] }) {
  const config = {
    NORMALE: { bg: 'bg-[#F5F5F5]', text: 'text-[#6E6E73]', icon: null },
    URGENTE: { bg: 'bg-[#FF9500]/10', text: 'text-[#FF9500]', icon: AlertTriangle },
    CRITIQUE: { bg: 'bg-[#FF3B30]', text: 'text-white', icon: AlertOctagon },
  };
  const { bg, text, icon: Icon } = config[priority];
  
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded text-sm font-bold', bg, text)}>
      {Icon && <Icon className="w-4 h-4" />}
      {priority}
    </span>
  );
}

export default function DemandeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [demande, setDemande] = useState<Demande | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const canValidate = user?.role === 'ADMIN' || user?.role === 'APPRO';
  const canGenerateBc = demande?.status === 'VALIDEE' && 
                        (!demande?.purchaseOrders || demande.purchaseOrders.length === 0) &&
                        canValidate;

  const loadDemande = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);
      
      const res = await authFetch(`/demandes-mp/${params.id}`, { credentials: 'include' });
      
      if (res.ok) {
        const data = await res.json();
        setDemande(data);
        
        // Normalize status based on BC state
        if (data.purchaseOrders?.length > 0) {
          const hasSentBc = data.purchaseOrders.some((po: PurchaseOrder) => po.sentAt);
          const allReceived = data.purchaseOrders.every((po: PurchaseOrder) => po.status === 'RECEIVED');
          if (allReceived) {
            data.status = 'RECEPTIONNEE';
          } else if (hasSentBc) {
            data.status = 'COMMANDEE';
          } else {
            data.status = 'EN_COURS_COMMANDE';
          }
        }
      } else {
        toast.error('Demande introuvable');
        router.push('/dashboard/appro/demandes');
      }
    } catch (error) {
      console.error('Failed to load demande:', error);
      toast.error('Erreur de chargement');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    loadDemande();
  }, [loadDemande]);

  const handleValider = async () => {
    if (!confirm('Valider cette demande ?')) return;
    try {
      const res = await authFetch(`/demandes-mp/${demande?.id}/valider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast.success('Demande validée avec succès');
        loadDemande(true);
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch {
      toast.error('Échec de la validation');
    }
  };

  const handleRejeter = async () => {
    const motif = prompt('Motif du rejet :');
    if (!motif) return;
    try {
      const res = await authFetch(`/demandes-mp/${demande?.id}/rejeter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ motif }),
      });
      if (res.ok) {
        toast.success('Demande rejetée');
        loadDemande(true);
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch {
      toast.error('Échec du rejet');
    }
  };

  if (isLoading) {
    return (
      <div className="glass-bg space-y-6 animate-fade-in">
        {/* Skeleton back button + header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-20 rounded" />
              </div>
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        {/* Skeleton detail card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-black/[0.04] bg-white/60 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
        {/* Skeleton product list */}
        <div className="rounded-2xl border border-black/[0.04] bg-white/60 overflow-hidden">
          <div className="p-5 border-b border-black/[0.04]">
            <Skeleton className="h-5 w-48" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-5 border-b border-black/[0.04] last:border-b-0">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!demande) {
    return null;
  }

  const hasPurchaseOrders = demande.purchaseOrders && demande.purchaseOrders.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/appro/demandes"
            className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#86868B]" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 text-primary-600" />
              <h1 className="text-2xl font-bold text-[#1D1D1F]">{demande.reference}</h1>
              <StatusBadge status={hasPurchaseOrders ? 'TRANSFORMEE' : demande.status} />
              <PriorityBadge priority={demande.priority} />
            </div>
            <p className="text-[#86868B] mt-1">
              Créée le {new Date(demande.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDemande(true)}
            disabled={isRefreshing}
            className="p-2 hover:bg-[#F5F5F5] rounded-lg"
          >
            <RefreshCw className={cn('w-5 h-5 text-[#86868B]', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Timeline de progression */}
      {(demande.status === 'VALIDEE' || hasPurchaseOrders) && (
        <DemandTimeline 
          status={demande.status} 
          purchaseOrders={demande.purchaseOrders}
        />
      )}

      {/* Bloc BC généré - Indication permanente */}
      {hasPurchaseOrders && (
        <div className="bg-[#34C759]/5 border border-[#34C759]/20 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#34C759]/10 rounded-lg">
              <FileText className="w-6 h-6 text-[#34C759]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[#34C759] text-lg">
                {demande.purchaseOrders!.length === 1 
                  ? 'Bon de commande généré'
                  : `${demande.purchaseOrders!.length} Bons de commande générés`
                }
              </h3>
              <p className="text-[#34C759] text-sm mt-1">
                Cette demande a été transformée en bon(s) de commande
              </p>
              
              <div className="mt-4 space-y-2">
                {demande.purchaseOrders!.map((po) => (
                  <Link
                    key={po.id}
                    href={`/dashboard/appro/bons/${po.id}`}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#34C759]/20 hover:border-[#34C759]/40 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[#34C759]" />
                      <div>
                        <span className="font-mono font-bold text-[#1D1D1F]">{po.reference}</span>
                        {po.supplier && (
                          <span className="text-[#86868B] ml-2">— {po.supplier.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-[#6E6E73]">
                        {po.totalHT.toFixed(2)} DA
                      </span>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        po.status === 'DRAFT' && 'bg-[#F5F5F5] text-[#1D1D1F]',
                        po.status === 'SENT' && 'bg-[#007AFF]/10 text-[#007AFF]',
                        po.status === 'CONFIRMED' && 'bg-indigo-100 text-indigo-700',
                        po.status === 'PARTIAL' && 'bg-[#FF9500]/10 text-[#FF9500]',
                        po.status === 'RECEIVED' && 'bg-[#34C759]/10 text-[#34C759]',
                      )}>
                        {po.status}
                      </span>
                      <ExternalLink className="w-4 h-4 text-[#AEAEB2] group-hover:text-[#34C759] transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bouton Générer BC - UNIQUEMENT si VALIDÉE et pas de BC */}
      {canGenerateBc && (
        <div className="bg-[#F5F5F5] border-2 border-primary-200 border-dashed rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-100 rounded-lg">
                <FilePlus className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[#1D1D1F] text-lg">
                  Prêt à générer le Bon de Commande
                </h3>
                <p className="text-[#6E6E73] text-sm">
                  Cette demande validée peut être transformée en BC fournisseur
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 shadow-apple-hover hover:shadow-apple-elevated transition-all"
            >
              <FilePlus className="w-5 h-5" />
              Générer le bon de commande
            </button>
          </div>
        </div>
      )}

      {/* Informations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Créateur */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3 mb-3">
            <User className="w-5 h-5 text-[#AEAEB2]" />
            <h3 className="font-medium text-[#1D1D1F]">Créée par</h3>
          </div>
          <p className="text-lg font-semibold text-[#1D1D1F]">
            {demande.createdBy.firstName} {demande.createdBy.lastName}
          </p>
          <p className="text-sm text-[#86868B]">
            {new Date(demande.createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Validateur */}
        {demande.validatedBy && (
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-5 h-5 text-[#34C759]" />
              <h3 className="font-medium text-[#1D1D1F]">Validée par</h3>
            </div>
            <p className="text-lg font-semibold text-[#1D1D1F]">
              {demande.validatedBy.firstName} {demande.validatedBy.lastName}
            </p>
            {demande.validatedAt && (
              <p className="text-sm text-[#86868B]">
                {new Date(demande.validatedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        )}

        {/* Lignes */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3 mb-3">
            <Package className="w-5 h-5 text-[#AEAEB2]" />
            <h3 className="font-medium text-[#1D1D1F]">Produits demandés</h3>
          </div>
          <p className="text-3xl font-bold text-[#1D1D1F]">
            {demande.lignes.length}
          </p>
          <p className="text-sm text-[#86868B]">ligne(s) de matières premières</p>
        </div>
      </div>

      {/* Motif de rejet */}
      {demande.status === 'REJETEE' && demande.rejectReason && (
        <div className="bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-[#FF3B30] flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-[#FF3B30]">Demande rejetée</h3>
              <p className="text-[#FF3B30] mt-1">{demande.rejectReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Commentaire */}
      {demande.commentaire && (
        <div className="bg-[#007AFF]/5 border border-[#007AFF]/20 rounded-xl p-5">
          <h3 className="font-medium text-[#007AFF] mb-2">Commentaire</h3>
          <p className="text-[#1D1D1F]">{demande.commentaire}</p>
        </div>
      )}

      {/* Liste des produits */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-5 border-b bg-[#FAFAFA]">
          <h3 className="font-semibold text-[#1D1D1F] flex items-center gap-2">
            <Package className="w-5 h-5 text-[#6E6E73]" />
            Matières premières demandées
          </h3>
        </div>
        
        <div className="divide-y">
          {demande.lignes.map((ligne, idx) => (
            <div key={idx} className="flex items-center justify-between p-5 hover:bg-[#FAFAFA]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-[#1D1D1F]">
                    {ligne.productMp?.name || `Produit #${ligne.productMpId}`}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-[#86868B]">
                    <span>{ligne.productMp?.code}</span>
                    {ligne.productMp?.fournisseurPrincipal && (
                      <span className="flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {ligne.productMp.fournisseurPrincipal.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-xl font-bold text-[#1D1D1F]">
                  {ligne.quantiteDemandee} {ligne.productMp?.unit || 'unités'}
                </p>
                {ligne.quantiteValidee && ligne.quantiteValidee !== ligne.quantiteDemandee && (
                  <p className="text-sm text-[#FF9500]">
                    Validé: {ligne.quantiteValidee} {ligne.productMp?.unit || 'unités'}
                  </p>
                )}
                {ligne.productMp?.dernierPrixAchat && (
                  <p className="text-sm text-[#86868B]">
                    ~{(ligne.quantiteDemandee * ligne.productMp.dernierPrixAchat).toFixed(2)} DA
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {demande.status === 'ENVOYEE' && canValidate && (
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            onClick={handleRejeter}
            className="flex items-center gap-2 px-4 py-2 text-[#FF3B30] hover:bg-[#FF3B30]/5 rounded-lg transition-colors"
          >
            <XCircle className="w-5 h-5" />
            Rejeter
          </button>
          <button
            onClick={handleValider}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#34C759] text-white font-medium rounded-lg hover:bg-[#34C759]/90"
          >
            <CheckCircle className="w-5 h-5" />
            Valider la demande
          </button>
        </div>
      )}

      {/* Modal de génération BC */}
      {demande && (
        <GenerateBcModal
          demande={demande}
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => loadDemande(true)}
        />
      )}
    </div>
  );
}
