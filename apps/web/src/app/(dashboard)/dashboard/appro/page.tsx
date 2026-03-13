'use client';

import { useEffect, useState, useCallback } from 'react';
import { appro, ApproDashboard, ApproAlert, AlertCounts, auth } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Package, FileText, Bell, RefreshCw, TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  type UserRole,
  type NextAction,
  type KpiSeverity,
} from '@/components/appro';
import { IrsGaugePanel } from '@/components/appro/IrsGaugePanel';
import { ActiveAlertsSection } from '@/components/appro/ActiveAlertsSection';
import { AllClearBanner } from '@/components/appro/AllClearBanner';
import { createLogger } from '@/lib/logger';

// ── Dynamic imports: heavy dashboard panel components ──
const CriticalActionBanner = dynamic(
  () => import('@/components/appro/CriticalActionBanner').then(mod => ({ default: mod.CriticalActionBanner })),
  { loading: () => <div className="animate-pulse h-16 bg-gray-100/50 rounded-xl" /> }
);
const ActionableKpiCard = dynamic(
  () => import('@/components/appro/ActionableKpiCard').then(mod => ({ default: mod.ActionableKpiCard })),
  { loading: () => <div className="animate-pulse h-32 bg-gray-100/50 rounded-xl" /> }
);
const NextActionsList = dynamic(
  () => import('@/components/appro/NextActionsList').then(mod => ({ default: mod.NextActionsList })),
  { loading: () => <div className="animate-pulse h-48 bg-gray-100/50 rounded-xl" /> }
);

const log = createLogger('ApproDashboard');

/**
 * Cockpit APPRO — Premium Apple Silicon Command Center
 *
 * Design: Glassmorphism panels, soft backdrop-blur, floating cards,
 * IRS gauge visualization, gradient mesh background, SF Pro typography,
 * ultra-clean minimal interface with depth and micro-contrast.
 */

/* ─── Main Page ─── */
export default function ApproDashboardPage() {
  const [dashboard, setDashboard] = useState<ApproDashboard | null>(null);
  const [alerts, setAlerts] = useState<ApproAlert[]>([]);
  const [alertCounts, setAlertCounts] = useState<AlertCounts | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('APPRO');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      const [dashboardData, userData, alertsData, countsData] = await Promise.all([
        appro.getDashboard(),
        auth.me().catch(() => null),
        appro.getActiveAlerts().catch(() => []),
        appro.getAlertCounts().catch(() => null),
      ]);

      setDashboard(dashboardData);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setAlertCounts(countsData);
      if (userData?.role) {
        setUserRole(userData.role as UserRole);
      }
    } catch (err) {
      log.error('Failed to load dashboard', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Impossible de charger le tableau de bord');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleAcknowledge = async (alertId: number) => {
    try {
      await appro.acknowledgeAlert(alertId);
      toast.success('Alerte accusée avec succès');
      await loadData(true);
    } catch {
      toast.error('Erreur lors de l\'accusé de réception');
    }
  };

  const handleScan = async () => {
    try {
      await appro.scanAlerts();
      toast.success('Scan des alertes terminé');
      await loadData(true);
    } catch {
      toast.error('Erreur lors du scan des alertes');
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Metrics
  const mpBloquantes = dashboard?.stockStats?.bloquantProduction ?? 0;
  const mpRupture = dashboard?.stockStats?.rupture ?? 0;
  const bcEnAttente = dashboard?.bcEnAttente ?? 0;
  const alertesCritiques = dashboard?.alertesActives ?? 0;
  const blockingMpName = dashboard?.mpCritiquesProduction?.[0]?.name;
  const productionBlocked = mpBloquantes > 0;
  const toutVaBien = mpBloquantes === 0 && mpRupture === 0 && bcEnAttente === 0 && alertesCritiques === 0;

  // IRS
  const irsValue = dashboard?.irs?.value ?? 0;
  const irsStatus = dashboard?.irs?.status ?? 'SAIN';

  // Role-based actions
  const isAdmin = userRole === 'ADMIN';
  const primaryAction = isAdmin
    ? { label: 'Voir et débloquer', href: '/dashboard/appro/stock?filter=bloquant' }
    : { label: 'Créer un bon de commande', href: '/dashboard/appro/bons/new?urgent=true' };
  const secondaryAction = isAdmin
    ? { label: 'Historique interventions', href: '#alertes-actives' }
    : { label: 'Voir la matière bloquante', href: '/dashboard/appro/stock?filter=bloquant' };

  // Priority actions
  const priorityActions: NextAction[] = buildPriorityActions({
    mpBloquantes, mpRupture, bcEnAttente, alertesCritiques,
    blockingMpName, isAdmin,
  });

  // Loading skeleton with glassmorphism
  if (isLoading) {
    return (
      <div className="glass-bg space-y-8">
        <div className="animate-pulse space-y-8">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div>
              <div className="h-7 bg-black/[0.04] rounded-xl w-56" />
              <div className="h-4 bg-black/[0.03] rounded-lg w-36 mt-2" />
            </div>
            <div className="w-10 h-10 bg-black/[0.03] rounded-[14px]" />
          </div>

          {/* IRS skeleton */}
          <div className="glass-card p-6 flex items-center gap-5">
            <div className="w-[100px] h-[100px] rounded-full bg-black/[0.03]" />
            <div className="space-y-2">
              <div className="h-4 bg-black/[0.04] rounded-lg w-24" />
              <div className="h-3 bg-black/[0.03] rounded-lg w-32" />
            </div>
          </div>

          {/* KPI grid skeleton */}
          <div className="grid grid-cols-2 gap-5">
            {[1,2,3,4].map(i => (
              <div key={i} className="glass-card p-6 space-y-4">
                <div className="flex justify-between">
                  <div className="h-3 bg-black/[0.04] rounded w-20" />
                  <div className="w-10 h-10 bg-black/[0.03] rounded-[14px]" />
                </div>
                <div className="h-9 bg-black/[0.04] rounded-xl w-12" />
                <div className="h-3 bg-black/[0.03] rounded w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-bg space-y-8">
      <PageHeader
        title="Approvisionnement"
        subtitle={isAdmin ? 'Vue stratégique' : 'Vue opérationnelle'}
        icon={<Package className="w-5 h-5" />}
        badge={productionBlocked
          ? { text: 'Action requise', variant: 'error' }
          : toutVaBien
            ? { text: 'Sous contrôle', variant: 'success' }
            : undefined}
        actions={(
          <Button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            variant="outline"
            size="icon"
            aria-label="Actualiser les données"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </Button>
        )}
      />

      {/* ─── IRS Gauge Panel ─── */}
      <IrsGaugePanel
        irsValue={irsValue}
        irsStatus={irsStatus}
        mpCritiques={mpBloquantes + mpRupture}
        bcEnRetard={bcEnAttente}
        alertesCritiques={alertesCritiques}
      />

      {/* ─── Critical Banner ─── */}
      <CriticalActionBanner
        blockingMpCount={mpBloquantes}
        productionBlocked={productionBlocked}
        userRole={userRole}
        blockingMpName={blockingMpName}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
      />

      {/* ─── KPI Grid ─── */}
      <div className="grid grid-cols-2 gap-5">
        <ActionableKpiCard
          title="Production bloquée"
          value={mpBloquantes}
          icon={Package}
          severity={getSeverity(mpBloquantes, 'critical')}
          actionLabel={mpBloquantes > 0 ? 'Agir maintenant' : 'Tout va bien'}
          href="/dashboard/appro/stock?filter=bloquant"
          subtitle={mpBloquantes > 0 ? 'Arrêt imminent' : 'Aucun blocage'}
        />
        <ActionableKpiCard
          title="BC en retard"
          value={bcEnAttente}
          icon={FileText}
          severity={getSeverity(bcEnAttente, 'critical')}
          actionLabel={bcEnAttente > 0 ? 'Relancer' : 'À jour'}
          href="/dashboard/appro/bons?filter=retard"
          subtitle={bcEnAttente > 0 ? 'Livraison dépassée' : 'Livraisons à jour'}
        />
        <ActionableKpiCard
          title="Stock critique"
          value={mpRupture}
          icon={TrendingDown}
          severity={getSeverity(mpRupture, 'warning')}
          actionLabel={mpRupture > 0 ? 'Anticiper' : 'Stocks OK'}
          href="/dashboard/appro/stock?filter=rupture"
          subtitle={mpRupture > 0 ? 'Sous seuil minimum' : 'Niveaux normaux'}
        />
        <ActionableKpiCard
          title="Alertes à traiter"
          value={alertesCritiques}
          icon={Bell}
          severity={getSeverity(alertesCritiques, 'warning')}
          actionLabel={alertesCritiques > 0 ? 'Traiter' : 'RAS'}
          href="#alertes-actives"
          subtitle={alertesCritiques > 0 ? 'En attente' : 'Aucune alerte'}
        />
      </div>

      {/* ─── Priority Actions ─── */}
      <NextActionsList
        actions={priorityActions}
        emptyMessage="Aucune action prioritaire — Production sécurisée"
      />

      {/* ─── Alertes Actives Section ─── */}
      <ActiveAlertsSection
        alerts={alerts}
        alertCounts={alertCounts}
        onAcknowledge={handleAcknowledge}
        onScan={handleScan}
      />

      {/* ─── All Clear State ─── */}
      {toutVaBien && <AllClearBanner />}
    </div>
  );
}

/* ─── Helpers ─── */

function getSeverity(value: number, type: 'critical' | 'warning'): KpiSeverity {
  if (value === 0) return 'success';
  return type === 'critical' ? 'critical' : 'warning';
}

function buildPriorityActions({
  mpBloquantes, mpRupture, bcEnAttente, alertesCritiques,
  blockingMpName, isAdmin,
}: {
  mpBloquantes: number;
  mpRupture: number;
  bcEnAttente: number;
  alertesCritiques: number;
  blockingMpName: string | undefined;
  isAdmin: boolean;
}): NextAction[] {
  const actions: NextAction[] = [];

  if (mpBloquantes > 0) {
    actions.push({
      id: 'blocking-mp',
      label: isAdmin
        ? `Débloquer situation — ${blockingMpName || 'MP critique'}`
        : `Créer BC urgent pour "${blockingMpName || 'Matière bloquante'}"`,
      severity: 'CRITICAL',
      actionLabel: isAdmin ? 'Intervenir' : 'Créer BC',
      href: isAdmin
        ? '/dashboard/appro/stock?filter=bloquant'
        : '/dashboard/appro/bons/new?urgent=true',
      context: 'Production à l\'arrêt',
    });
  }
  if (bcEnAttente > 0) {
    actions.push({
      id: 'bc-retard',
      label: `Relancer fournisseur — ${bcEnAttente} BC en retard`,
      severity: 'CRITICAL',
      actionLabel: 'Relancer',
      href: '/dashboard/appro/bons?filter=retard',
      context: 'Livraison attendue dépassée',
    });
  }
  if (mpRupture > 0 && mpBloquantes === 0) {
    actions.push({
      id: 'rupture',
      label: `Anticiper rupture — ${mpRupture} MP en stock critique`,
      severity: 'WARNING',
      actionLabel: 'Commander',
      href: '/dashboard/appro/stock?filter=rupture',
      context: 'Stock sous seuil minimum',
    });
  }
  if (alertesCritiques > 0) {
    actions.push({
      id: 'alertes',
      label: `${alertesCritiques} alerte${alertesCritiques > 1 ? 's' : ''} à traiter`,
      severity: 'WARNING',
      actionLabel: 'Traiter',
      href: '#alertes-actives',
      context: 'Actions en attente',
    });
  }

  return actions;
}
