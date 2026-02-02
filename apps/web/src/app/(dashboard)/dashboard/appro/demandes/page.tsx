'use client';

import { toast } from 'sonner';

/**
 * DEMANDES APPRO — File de decisions actionnables | Apple Glass Design
 *
 * En < 3 secondes, l'utilisateur sait:
 * - quoi traiter maintenant
 * - quoi ignorer
 * - quoi escalader
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { authFetch, appro, ApproAlert } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ShoppingCart,
  Plus,
  Send,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Package,
  Truck,
  User,
  FileText,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
  FilePlus,
  Flame,
  Bell,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton-loader';
import {
  RequestDecisionCard,
  type RequestData,
  type RequestDecisionStatus,
  getRequestDecisionStatus,
  type UserRole,
} from '@/components/appro';

const GenerateBcModal = dynamic(
  () => import('@/components/appro/GenerateBcModal').then(mod => ({ default: mod.GenerateBcModal })),
  { loading: () => <div className="animate-pulse p-8">Chargement...</div> }
);

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

interface PurchaseOrder {
  id: string;
  reference: string;
  status: string;
  totalHT: number;
  sentAt?: string | null;
  receivedAt?: string | null;
}

type DemandeStatus =
  | 'BROUILLON'
  | 'SOUMISE'
  | 'VALIDEE'
  | 'REJETEE'
  | 'EN_COURS_COMMANDE'
  | 'COMMANDEE'
  | 'RECEPTIONNEE'
  | 'ENVOYEE'
  | 'TRANSFORMEE';

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

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: DemandeStatus }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: Record<DemandeStatus, { icon: any; bg: string; text: string; label: string }> = {
    BROUILLON: { icon: Clock, bg: 'bg-[#8E8E93]/10', text: 'text-[#8E8E93]', label: 'Brouillon' },
    SOUMISE: { icon: Send, bg: 'bg-[#007AFF]/10', text: 'text-[#007AFF]', label: 'Soumise' },
    VALIDEE: { icon: CheckCircle, bg: 'bg-[#34C759]/10', text: 'text-[#34C759]', label: 'Validee' },
    REJETEE: { icon: XCircle, bg: 'bg-[#FF3B30]/10', text: 'text-[#FF3B30]', label: 'Rejetee' },
    EN_COURS_COMMANDE: { icon: FileText, bg: 'bg-[#AF52DE]/10', text: 'text-[#AF52DE]', label: 'BC genere' },
    COMMANDEE: { icon: Truck, bg: 'bg-[#5856D6]/10', text: 'text-[#5856D6]', label: 'Commandee' },
    RECEPTIONNEE: { icon: Package, bg: 'bg-[#34C759]/10', text: 'text-[#34C759]', label: 'Receptionnee' },
    ENVOYEE: { icon: Send, bg: 'bg-[#007AFF]/10', text: 'text-[#007AFF]', label: 'Soumise' },
    TRANSFORMEE: { icon: FileText, bg: 'bg-[#AF52DE]/10', text: 'text-[#AF52DE]', label: 'BC genere' },
  };
  const { icon: Icon, bg, text, label } = config[status] || config.BROUILLON;

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold', bg, text)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Demande['priority'] }) {
  const config = {
    NORMALE: { bg: 'bg-[#8E8E93]/8', text: 'text-[#8E8E93]', icon: null },
    URGENTE: { bg: 'bg-[#FF9500]/10', text: 'text-[#FF9500]', icon: AlertTriangle },
    CRITIQUE: { bg: 'bg-[#FF3B30]/10', text: 'text-[#FF3B30]', icon: AlertOctagon },
  };
  const { bg, text, icon: Icon } = config[priority];

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold', bg, text)}>
      {Icon && <Icon className="w-3 h-3" />}
      {priority}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ApproDemandesPage() {
  const { user } = useAuth();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [alerts, setAlerts] = useState<ApproAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [filter, _setFilter] = useState<string>('');
  const [selectedDemande, setSelectedDemande] = useState<Demande | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAllWaiting, setShowAllWaiting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _isProduction = user?.role === 'PRODUCTION';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _canValidate = user?.role === 'ADMIN' || user?.role === 'APPRO';

  const loadData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);

      const [demandesRes, alertsData] = await Promise.all([
        authFetch('/demandes-mp', { credentials: 'include' }),
        appro.getActiveAlerts(),
      ]);

      if (demandesRes.ok) {
        const data = await demandesRes.json();
        setDemandes(Array.isArray(data) ? data : (data.data || data.demandes || []));
      }
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _filteredDemandes = filter
    ? demandes.filter(d => d.status === filter)
    : demandes;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _getRelatedAlerts = (demande: Demande): ApproAlert[] => {
    const mpIds = demande.lignes.map(l => l.productMpId);
    return alerts.filter(a => a.entityType === 'MP' && a.entityId && mpIds.includes(a.entityId));
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _stats = {
    total: demandes.length,
    brouillons: demandes.filter(d => d.status === 'BROUILLON').length,
    envoyees: demandes.filter(d => d.status === 'ENVOYEE').length,
    critiques: demandes.filter(d => d.status === 'ENVOYEE' && d.priority === 'CRITIQUE').length,
    validees: demandes.filter(d => d.status === 'VALIDEE').length,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleEnvoyer = async (id: number) => {
    try {
      const res = await authFetch(`/demandes-mp/${id}/envoyer`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) loadData(true);
    } catch (error) {
      console.error('Failed to send:', error);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette demande ?')) return;
    try {
      const res = await authFetch(`/demandes-mp/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) loadData(true);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleValider = async (id: number) => {
    if (!confirm('Valider cette demande ?')) return;
    try {
      const res = await authFetch(`/demandes-mp/${id}/valider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast.success('Demande validee avec succes');
        loadData(true);
      }
    } catch (error) {
      console.error('Failed to validate:', error);
      toast.error('Echec de la validation');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleRejeter = async (id: number) => {
    const motif = prompt('Motif du rejet :');
    if (!motif) return;
    try {
      const res = await authFetch(`/demandes-mp/${id}/rejeter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ motif }),
      });
      if (res.ok) {
        toast.success('Demande rejetee');
        loadData(true);
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      toast.error('Echec du rejet');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleOpenGenerateModal = (demande: Demande) => {
    setSelectedDemande(demande);
    setShowGenerateModal(true);
  };

  const handleCloseGenerateModal = () => {
    setShowGenerateModal(false);
    setSelectedDemande(null);
  };

  const handleGenerateSuccess = () => {
    loadData(true);
  };

  if (isLoading) {
    return (
      <div className="glass-bg space-y-6 animate-fade-in">
        {/* Skeleton header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-10 w-44 rounded-full" />
          </div>
        </div>
        {/* Skeleton demand cards */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-black/[0.04] bg-white/60 p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // TRANSFORM DEMANDES TO DECISION FORMAT
  const transformToRequestData = (demande: Demande): RequestData & { decisionStatus: RequestDecisionStatus } => {
    const firstLine = demande.lignes[0];
    const productionBlocked = demande.priority === 'CRITIQUE';
    const isUrgent = demande.priority === 'URGENTE';
    const missingInfo = demande.status === 'BROUILLON';
    const bcCreated = demande.status === 'EN_COURS_COMMANDE' || demande.status === 'TRANSFORMEE';
    const bcSent = demande.status === 'COMMANDEE' || demande.status === 'RECEPTIONNEE';

    const decisionStatus = getRequestDecisionStatus(productionBlocked, isUrgent, missingInfo, bcCreated, bcSent);

    return {
      id: demande.id,
      reference: demande.reference,
      productName: firstLine?.productMp?.name || `${demande.lignes.length} MP`,
      quantity: demande.lignes.reduce((sum, l) => sum + l.quantiteDemandee, 0),
      unit: firstLine?.productMp?.unit || 'unites',
      impactRecipes: productionBlocked ? 3 : isUrgent ? 1 : 0,
      source: demande.createdBy ? `${demande.createdBy.firstName} ${demande.createdBy.lastName}` : 'Systeme',
      bcReference: demande.purchaseOrders?.[0]?.reference,
      bcId: demande.purchaseOrders?.[0]?.id,
      decisionStatus,
    };
  };

  const allRequests = demandes.map(transformToRequestData);

  // ZONING
  const zone1Critical = allRequests.filter(r => r.decisionStatus === 'BLOCKING' || r.decisionStatus === 'URGENT').slice(0, 5);
  const zone2Prepare = allRequests.filter(r => r.decisionStatus === 'PENDING_INFO');
  const zone3Waiting = allRequests.filter(r => r.decisionStatus === 'WAITING' || r.decisionStatus === 'DONE');

  const userRole: UserRole = (user?.role as UserRole) || 'APPRO';
  const isAdmin = userRole === 'ADMIN';

  return (
    <div className="glass-bg space-y-8">
      <PageHeader
        title="File de decisions"
        subtitle={isAdmin
          ? "Arbitrage et validation des demandes"
          : "Actions d'approvisionnement prioritaires"
        }
        icon={<ShoppingCart className="w-6 h-6" />}
        badge={zone1Critical.length > 0
          ? { text: `${zone1Critical.length} action(s) requise(s)`, variant: 'error' }
          : { text: 'Sous controle', variant: 'success' }
        }
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="glass-btn p-2.5 rounded-[12px] disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4.5 h-4.5 text-[#6E6E73]', isRefreshing && 'animate-spin')} />
            </button>
            <Link
              href="/dashboard/demandes-mp"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-[#333336] transition-all duration-200 font-medium text-[14px] shadow-lg shadow-[#1D1D1F]/10 hover:shadow-xl hover:shadow-[#1D1D1F]/15 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              Nouvelle demande
            </Link>
          </div>
        }
      />

      {/* ZONE 1 — A TRAITER MAINTENANT */}
      {zone1Critical.length > 0 && (
        <section className="animate-slide-up">
          <div className="glass-section-header">
            <div className="glass-section-icon bg-[#FF3B30]/8">
              <Flame className="w-5 h-5 text-[#FF3B30]" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-[#1D1D1F] tracking-[-0.01em]">A traiter maintenant</h2>
              <p className="text-[13px] text-[#FF3B30]">
                {zone1Critical.length} demande{zone1Critical.length > 1 ? 's' : ''} bloquante{zone1Critical.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {zone1Critical.map((request, i) => (
              <div key={request.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <RequestDecisionCard
                  request={request}
                  status={request.decisionStatus}
                  userRole={userRole}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ZONE 2 — A PREPARER / COMPLETER */}
      {zone2Prepare.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="glass-section-header">
            <div className="glass-section-icon bg-[#FF9500]/8">
              <AlertTriangle className="w-5 h-5 text-[#FF9500]" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-[#1D1D1F] tracking-[-0.01em]">A preparer</h2>
              <p className="text-[13px] text-[#FF9500]">Infos manquantes ou brouillons</p>
            </div>
          </div>
          <div className="space-y-3">
            {zone2Prepare.map((request, i) => (
              <div key={request.id} className="animate-slide-up" style={{ animationDelay: `${(i * 60) + 100}ms` }}>
                <RequestDecisionCard
                  request={request}
                  status={request.decisionStatus}
                  userRole={userRole}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ZONE 3 — EN ATTENTE / SUIVI */}
      {zone3Waiting.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="glass-section-header">
            <div className="glass-section-icon bg-black/[0.04]">
              <Clock className="w-5 h-5 text-[#86868B]" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-[#1D1D1F] tracking-[-0.01em]">En attente / Suivi</h2>
              <p className="text-[13px] text-[#86868B]">{zone3Waiting.length} demande{zone3Waiting.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {(showAllWaiting ? zone3Waiting : zone3Waiting.slice(0, 5)).map((request, i) => (
              <div key={request.id} className="animate-slide-up" style={{ animationDelay: `${(i * 40) + 200}ms` }}>
                <RequestDecisionCard
                  request={request}
                  status={request.decisionStatus}
                  userRole={userRole}
                />
              </div>
            ))}
            {!showAllWaiting && zone3Waiting.length > 5 && (
              <button
                onClick={() => setShowAllWaiting(true)}
                className="glass-btn w-full py-3.5 rounded-[16px] text-[13px] text-[#86868B] hover:text-[#1D1D1F] justify-center"
              >
                Voir {zone3Waiting.length - 5} autres demandes en attente
              </button>
            )}
          </div>
        </section>
      )}

      {/* Etat vide */}
      {allRequests.length === 0 && (
        <div className="glass-empty p-16 animate-scale-in" style={{ background: 'linear-gradient(135deg, rgba(232, 245, 233, 0.5) 0%, rgba(255, 255, 255, 0.4) 100%)' }}>
          <div className="w-16 h-16 rounded-[20px] bg-[#34C759]/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-[#34C759]" />
          </div>
          <p className="mt-5 text-[20px] font-semibold text-[#1D1D1F]">Aucune action requise</p>
          <p className="text-[#86868B] mt-1.5 text-[14px]">Toutes les demandes sont traitees</p>
        </div>
      )}

      {/* Modal de generation BC */}
      {selectedDemande && (
        <GenerateBcModal
          demande={selectedDemande}
          isOpen={showGenerateModal}
          onClose={handleCloseGenerateModal}
          onSuccess={handleGenerateSuccess}
        />
      )}
    </div>
  );
}
