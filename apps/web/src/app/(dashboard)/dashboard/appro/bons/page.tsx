'use client';

/**
 * BONS DE COMMANDE — Tour de controle engagements fournisseurs | Apple Glass Design
 *
 * En < 5 secondes, l'utilisateur sait:
 * - quels BC doivent partir maintenant
 * - lesquels sont en attente fournisseur
 * - lesquels posent un risque operationnel
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { appro, PurchaseOrder } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  FileText,
  Clock,
  CheckCircle,
  Send,
  ArrowRight,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { KeyboardHint } from '@/components/ui/keyboard-hint';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import {
  PurchaseOrderDecisionCard,
  type PurchaseOrderData,
  type PurchaseOrderDecisionStatus,
  getPurchaseOrderDecisionStatus,
  type UserRole,
} from '@/components/appro';
import { createLogger } from '@/lib/logger';

const log = createLogger('BonsCommande');

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function isLate(bc: PurchaseOrder): boolean {
  if (bc.status === 'RECEIVED' || bc.status === 'CANCELLED') return false;
  if (!bc.expectedDelivery) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expected = new Date(bc.expectedDelivery);
  expected.setHours(0, 0, 0, 0);
  return expected < today;
}

function getDaysUntilDelivery(expectedDelivery?: string): number | undefined {
  if (!expectedDelivery) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expected = new Date(expectedDelivery);
  expected.setHours(0, 0, 0, 0);
  return Math.ceil((expected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function BonsCommandePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [bons, setBons] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);
  const [sendingBcId, setSendingBcId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 50;

  const loadData = useCallback(async (showRefresh = false, pageNum = 1) => {
    try {
      if (showRefresh) setIsRefreshing(true);
      const data = await appro.getPurchaseOrders({ limit: PAGE_SIZE + 1, offset: (pageNum - 1) * PAGE_SIZE });
      const arr = Array.isArray(data) ? data : [];
      setHasMore(arr.length > PAGE_SIZE);
      setBons(arr.slice(0, PAGE_SIZE));
      setPage(pageNum);
    } catch (err) {
      log.error('Failed to load BC', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Erreur lors du chargement des bons de commande');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useKeyboardShortcuts([
    { key: 'n', handler: () => router.push('/dashboard/appro/bons/new'), description: 'Nouveau BC' },
    { key: 'r', handler: () => loadData(true), description: 'Actualiser les donnees' },
  ]);

  const handleSendBC = async (bcId: string) => {
    if (sendingBcId) return; // Protection double-clic
    setSendingBcId(bcId);
    try {
      await appro.sendPurchaseOrder(bcId, {
        sendVia: 'MANUAL',
        proofNote: 'Envoi rapide depuis tableau de bord - a completer avec preuve',
        idempotencyKey: `send-bc-${bcId}-${Date.now()}`,
      });
      toast.success('BC envoyé avec succès');
      loadData(true);
    } catch (err) {
      log.error('Failed to send BC', { error: err instanceof Error ? err.message : String(err) });
      toast.error("Erreur lors de l'envoi du BC");
    } finally {
      setSendingBcId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-bg space-y-6 animate-fade-in">
        {/* Skeleton PageHeader */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>
        {/* Skeleton decision cards */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card rounded-[28px] border border-black/[0.04] bg-white/60 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="flex items-center gap-6">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // TRANSFORM BC TO DECISION FORMAT
  const transformToOrderData = (bc: PurchaseOrder): PurchaseOrderData & { decisionStatus: PurchaseOrderDecisionStatus } => {
    const sent = bc.status !== 'DRAFT';
    const received = bc.status === 'RECEIVED';
    const cancelled = bc.status === 'CANCELLED';
    const productionBlocked = false;
    const delayDetected = isLate(bc);

    const decisionStatus = getPurchaseOrderDecisionStatus(sent, received, cancelled, productionBlocked, delayDetected);

    return {
      id: bc.id,
      reference: bc.reference,
      supplierName: bc.supplier?.name || 'Fournisseur inconnu',
      totalAmount: bc.totalHT,
      currency: bc.currency || 'DA',
      impactRecipes: 0,
      expectedDelivery: bc.expectedDelivery ?? undefined,
      daysUntilDelivery: getDaysUntilDelivery(bc.expectedDelivery ?? undefined),
      supplierDelayCount: 0,
      decisionStatus,
    };
  };

  const allOrders = bons.map(transformToOrderData);

  // ZONING
  const zone1ToSend = allOrders.filter(o => o.decisionStatus === 'URGENT_SEND' || o.decisionStatus === 'NOT_SENT').slice(0, 5);
  const zone2Awaiting = allOrders.filter(o => o.decisionStatus === 'AWAITING_SUPPLIER' || o.decisionStatus === 'SUPPLIER_DELAY');
  const zone3Done = allOrders.filter(o => o.decisionStatus === 'RECEIVED' || o.decisionStatus === 'CANCELLED');

  const visibleDone = showAllDone ? zone3Done : zone3Done.slice(0, 5);
  const hiddenDoneCount = zone3Done.length - visibleDone.length;

  const userRole: UserRole = (user?.role as UserRole) || 'APPRO';
  const isAdmin = userRole === 'ADMIN';
  const lateCount = zone2Awaiting.filter(o => o.decisionStatus === 'SUPPLIER_DELAY').length;

  return (
    <div className="glass-bg space-y-8">
      <PageHeader
        title="Engagements Fournisseurs"
        subtitle={isAdmin
          ? "Validation et arbitrage des BC"
          : "Envoi et suivi des commandes"
        }
        icon={<FileText className="w-6 h-6" />}
        badge={zone1ToSend.length > 0
          ? { text: `${zone1ToSend.length} BC a envoyer`, variant: 'error' }
          : lateCount > 0
            ? { text: `${lateCount} en retard`, variant: 'warning' }
            : { text: 'Sous controle', variant: 'success' }
        }
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/appro/bons/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#EC7620] text-white rounded-full hover:bg-[#EC7620]/90 transition-all duration-200 font-medium text-[14px] shadow-lg shadow-[#EC7620]/10 hover:shadow-xl hover:shadow-[#EC7620]/15 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              Nouveau BC
              <KeyboardHint shortcut="N" />
            </Link>
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-[#333336] transition-all duration-200 font-medium text-[14px] shadow-lg shadow-[#1D1D1F]/10 hover:shadow-xl hover:shadow-[#1D1D1F]/15 hover:-translate-y-0.5 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              Actualiser
              <KeyboardHint shortcut="R" />
            </button>
          </div>
        }
      />

      {/* ZONE 1 — BC A ENVOYER MAINTENANT */}
      {zone1ToSend.length > 0 && (
        <section className="animate-slide-up">
          <div className="glass-section-header">
            <div className="glass-section-icon bg-[#FF9500]/8">
              <Send className="w-5 h-5 text-[#FF9500]" />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">BC a envoyer maintenant</h2>
              <p className="text-[13px] text-[#FF9500]">
                {zone1ToSend.length} BC non envoye{zone1ToSend.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {zone1ToSend.map((order, i) => (
              <div key={order.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <PurchaseOrderDecisionCard
                  order={order}
                  status={order.decisionStatus}
                  userRole={userRole}
                  onAction={() => handleSendBC(order.id)}
                  onRefresh={() => loadData(true)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ZONE 2 — BC EN ATTENTE FOURNISSEUR */}
      {zone2Awaiting.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="glass-section-header">
            <div className="glass-section-icon bg-[#007AFF]/8">
              <Clock className="w-5 h-5 text-[#007AFF]" />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">En attente fournisseur</h2>
              <p className="text-[13px] text-[#007AFF]">
                {zone2Awaiting.length} BC en cours
                {lateCount > 0 && <span className="text-[#FF3B30] font-semibold"> &middot; {lateCount} en retard</span>}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {zone2Awaiting.map((order, i) => (
              <div key={order.id} className="animate-slide-up" style={{ animationDelay: `${(i * 60) + 100}ms` }}>
                <PurchaseOrderDecisionCard
                  order={order}
                  status={order.decisionStatus}
                  userRole={userRole}
                  onRefresh={() => loadData(true)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ZONE 3 — BC FINALISES */}
      {zone3Done.length > 0 && (
        <section className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="glass-section-header">
            <div className="glass-section-icon bg-[#34C759]/8">
              <CheckCircle className="w-5 h-5 text-[#34C759]" />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">BC Finalises</h2>
              <p className="text-[13px] text-[#34C759]">{zone3Done.length} BC receptionne{zone3Done.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {visibleDone.map((order, i) => (
              <div key={order.id} className="animate-slide-up" style={{ animationDelay: `${(i * 40) + 200}ms` }}>
                <PurchaseOrderDecisionCard
                  order={order}
                  status={order.decisionStatus}
                  userRole={userRole}
                />
              </div>
            ))}
            {!showAllDone && hiddenDoneCount > 0 && (
              <button
                onClick={() => setShowAllDone(true)}
                className="glass-btn w-full py-3.5 rounded-[16px] text-[13px] text-[#86868B] hover:text-[#1D1D1F] justify-center"
              >
                Voir {hiddenDoneCount} autres BC finalises
              </button>
            )}
            {showAllDone && zone3Done.length > 5 && (
              <button
                onClick={() => setShowAllDone(false)}
                className="glass-btn w-full py-3.5 rounded-[16px] text-[13px] text-[#86868B] hover:text-[#1D1D1F] justify-center"
              >
                Reduire la liste
              </button>
            )}
          </div>
        </section>
      )}

      {/* PAGINATION */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => loadData(true, page - 1)}
            disabled={page <= 1 || isRefreshing}
            className="px-5 py-2 text-sm font-medium rounded-full border border-black/[0.04] bg-white/60 hover:bg-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            ← Précédent
          </button>
          <span className="text-sm text-[#86868B]">Page {page}</span>
          <button
            onClick={() => loadData(true, page + 1)}
            disabled={!hasMore || isRefreshing}
            className="px-5 py-2 text-sm font-medium rounded-full border border-black/[0.04] bg-white/60 hover:bg-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Etat vide */}
      {allOrders.length === 0 && (
        <div className="glass-empty p-16 animate-scale-in">
          <div className="w-16 h-16 rounded-[20px] bg-[#F5F5F5] flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8 text-[#D1D1D6]" />
          </div>
          <p className="mt-5 font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Aucun bon de commande</p>
          <p className="text-[#86868B] mt-1.5 text-[14px]">
            Créez un BC directement ou depuis les Demandes APPRO validées.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/dashboard/appro/bons/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#EC7620] text-white rounded-full hover:bg-[#EC7620]/90 font-medium text-[14px] transition-all duration-200 shadow-lg shadow-[#EC7620]/10 hover:shadow-xl hover:shadow-[#EC7620]/15 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              Nouveau BC
            </Link>
            <Link
              href="/dashboard/appro/fournisseurs"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-black/[0.04] rounded-full hover:bg-white/60 font-medium text-[14px] text-[#86868B] hover:text-[#1D1D1F] transition-all duration-200"
            >
              Voir les Fournisseurs
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
