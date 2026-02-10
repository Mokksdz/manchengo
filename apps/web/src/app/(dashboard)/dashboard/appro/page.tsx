'use client';

import { useEffect, useState, useCallback } from 'react';
import { appro, ApproDashboard, ApproAlert, AlertCounts, auth } from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  Package, FileText, Bell, Check, RefreshCw, TrendingDown, Activity,
  AlertTriangle, AlertCircle, Info, Eye, CheckCircle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CriticalActionBanner,
  ActionableKpiCard,
  NextActionsList,
  type UserRole,
  type NextAction,
  type KpiSeverity,
} from '@/components/appro';

/**
 * Cockpit APPRO — Premium Apple Silicon Command Center
 *
 * Design: Glassmorphism panels, soft backdrop-blur, floating cards,
 * IRS gauge visualization, gradient mesh background, SF Pro typography,
 * ultra-clean minimal interface with depth and micro-contrast.
 */

/* ─── IRS Gauge Component ─── */
function IrsGauge({ value, status }: { value: number; status: string }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value, 100) / 100;
  const offset = circumference * (1 - progress);

  const statusConfig: Record<string, { color: string; gradient: string; label: string; bg: string }> = {
    SAIN: {
      color: '#34C759',
      gradient: 'url(#gaugeGradientSain)',
      label: 'Sain',
      bg: 'from-[#34C759]/8 to-[#30D158]/3',
    },
    SURVEILLANCE: {
      color: '#FF9500',
      gradient: 'url(#gaugeGradientSurv)',
      label: 'Surveillance',
      bg: 'from-[#FF9500]/8 to-[#FFAC33]/3',
    },
    CRITIQUE: {
      color: '#FF3B30',
      gradient: 'url(#gaugeGradientCrit)',
      label: 'Critique',
      bg: 'from-[#FF3B30]/8 to-[#FF6961]/3',
    },
  };

  const config = statusConfig[status] || statusConfig.SAIN;

  return (
    <div className="flex items-center gap-5">
      <div className="relative w-[100px] h-[100px]">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id="gaugeGradientSain" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34C759" />
              <stop offset="100%" stopColor="#30D158" />
            </linearGradient>
            <linearGradient id="gaugeGradientSurv" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF9500" />
              <stop offset="100%" stopColor="#FFAC33" />
            </linearGradient>
            <linearGradient id="gaugeGradientCrit" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF3B30" />
              <stop offset="100%" stopColor="#FF6961" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.04)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Progress */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={config.gradient}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="irs-gauge-ring"
            style={{ animation: 'gauge-fill 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-semibold text-[#1D1D1F] leading-none tracking-tight tabular-nums">
            {value}
          </span>
          <span className="text-[9px] font-medium text-[#AEAEB2] uppercase tracking-[0.08em] mt-0.5">
            IRS
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: config.color }} />
          <span className="text-[13px] font-semibold text-[#1D1D1F]">
            {config.label}
          </span>
        </div>
        <p className="text-[12px] text-[#AEAEB2] leading-relaxed">
          Indice de Risque Stock
        </p>
      </div>
    </div>
  );
}

/* ─── Alert Severity Icon ─── */
function AlertSeverityIcon({ niveau }: { niveau: string }) {
  switch (niveau) {
    case 'CRITICAL':
      return <AlertTriangle className="w-4 h-4" />;
    case 'WARNING':
      return <AlertCircle className="w-4 h-4" />;
    default:
      return <Info className="w-4 h-4" />;
  }
}

/* ─── Alert Type Label ─── */
function AlertTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    MP_CRITIQUE: 'MP Critique',
    RUPTURE: 'Rupture Stock',
    FOURNISSEUR_RETARD: 'Fournisseur Retard',
    PRODUCTION_BLOQUEE: 'Production Bloquée',
  };
  return <span>{labels[type] || type}</span>;
}

/* ─── Severity Config ─── */
const severityConfig: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: '#FF3B30', bg: 'bg-[#FF3B30]/8', border: 'border-[#FF3B30]/20' },
  WARNING: { color: '#FF9500', bg: 'bg-[#FF9500]/8', border: 'border-[#FF9500]/20' },
  INFO: { color: '#007AFF', bg: 'bg-[#007AFF]/8', border: 'border-[#007AFF]/20' },
};

/* ─── Main Page ─── */
export default function ApproDashboardPage() {
  const [dashboard, setDashboard] = useState<ApproDashboard | null>(null);
  const [alerts, setAlerts] = useState<ApproAlert[]>([]);
  const [alertCounts, setAlertCounts] = useState<AlertCounts | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('APPRO');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [acknowledging, setAcknowledging] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);

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
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleAcknowledge = async (alertId: number) => {
    try {
      setAcknowledging(alertId);
      await appro.acknowledgeAlert(alertId);
      toast.success('Alerte accusée avec succès');
      await loadData(true);
    } catch {
      toast.error('Erreur lors de l\'accusé de réception');
    } finally {
      setAcknowledging(null);
    }
  };

  const handleScan = async () => {
    try {
      setIsScanning(true);
      await appro.scanAlerts();
      toast.success('Scan des alertes terminé');
      await loadData(true);
    } catch {
      toast.error('Erreur lors du scan des alertes');
    } finally {
      setIsScanning(false);
    }
  };

  // Sort alerts: CRITICAL first, then WARNING, then INFO, then by date
  const sortedAlerts = [...alerts].sort((a, b) => {
    const levelOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    const levelDiff = (levelOrder[a.niveau] ?? 2) - (levelOrder[b.niveau] ?? 2);
    if (levelDiff !== 0) return levelDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const visibleAlerts = showAllAlerts ? sortedAlerts : sortedAlerts.slice(0, 5);
  const hasMoreAlerts = sortedAlerts.length > 5;

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
  const priorityActions: NextAction[] = [];
  if (mpBloquantes > 0) {
    priorityActions.push({
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
    priorityActions.push({
      id: 'bc-retard',
      label: `Relancer fournisseur — ${bcEnAttente} BC en retard`,
      severity: 'CRITICAL',
      actionLabel: 'Relancer',
      href: '/dashboard/appro/bons?filter=retard',
      context: 'Livraison attendue dépassée',
    });
  }
  if (mpRupture > 0 && mpBloquantes === 0) {
    priorityActions.push({
      id: 'rupture',
      label: `Anticiper rupture — ${mpRupture} MP en stock critique`,
      severity: 'WARNING',
      actionLabel: 'Commander',
      href: '/dashboard/appro/stock?filter=rupture',
      context: 'Stock sous seuil minimum',
    });
  }
  if (alertesCritiques > 0) {
    priorityActions.push({
      id: 'alertes',
      label: `${alertesCritiques} alerte${alertesCritiques > 1 ? 's' : ''} à traiter`,
      severity: 'WARNING',
      actionLabel: 'Traiter',
      href: '#alertes-actives',
      context: 'Actions en attente',
    });
  }

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
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-semibold text-[#1D1D1F] tracking-[-0.02em]">
            Approvisionnement
          </h1>
          <p className="text-[13px] text-[#86868B] mt-1 flex items-center gap-2">
            {isAdmin ? 'Vue stratégique' : 'Vue opérationnelle'}
            {productionBlocked && (
              <span className="inline-flex items-center gap-1.5 ml-1">
                <span className="w-[6px] h-[6px] rounded-full bg-[#FF3B30] animate-pulse" />
                <span className="text-[#FF3B30] font-medium text-[12px]">Action requise</span>
              </span>
            )}
            {!productionBlocked && toutVaBien && (
              <span className="inline-flex items-center gap-1.5 ml-1">
                <span className="w-[6px] h-[6px] rounded-full bg-[#34C759]" />
                <span className="text-[#34C759] font-medium text-[12px]">Sous contrôle</span>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="glass-card-hover p-2.5 text-[#86868B] hover:text-[#1D1D1F] disabled:opacity-50"
          style={{ borderRadius: '14px' }}
        >
          <RefreshCw className={`w-[18px] h-[18px] ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ─── IRS Gauge Panel ─── */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <IrsGauge value={irsValue} status={irsStatus} />
          <div className="hidden sm:flex items-center gap-6">
            {/* Mini stat pills */}
            <div className="text-center">
              <p className={cn('text-[20px] font-semibold text-[#1D1D1F] tabular-nums', (mpBloquantes + mpRupture) > 0 && 'animate-number-pop')}>{mpBloquantes + mpRupture}</p>
              <p className="text-[11px] text-[#AEAEB2] mt-0.5">MP critiques</p>
            </div>
            <div className="w-[1px] h-8 bg-black/[0.04]" />
            <div className="text-center">
              <p className={cn('text-[20px] font-semibold text-[#1D1D1F] tabular-nums', bcEnAttente > 0 && 'animate-number-pop')}>{bcEnAttente}</p>
              <p className="text-[11px] text-[#AEAEB2] mt-0.5">BC en retard</p>
            </div>
            <div className="w-[1px] h-8 bg-black/[0.04]" />
            <div className="text-center">
              <p className={cn('text-[20px] font-semibold text-[#1D1D1F] tabular-nums', alertesCritiques > 0 && 'animate-number-pop')}>{alertesCritiques}</p>
              <p className="text-[11px] text-[#AEAEB2] mt-0.5">Alertes</p>
            </div>
          </div>
          <div className="hidden sm:block">
            <Activity className="w-5 h-5 text-[#D1D1D6]" />
          </div>
        </div>
      </div>

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
      <div id="alertes-actives" className="scroll-mt-6">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="glass-section-icon w-9 h-9 rounded-[12px] bg-gradient-to-br from-[#FF9500]/10 to-[#FF3B30]/5 flex items-center justify-center">
              <Bell className="w-[18px] h-[18px] text-[#FF9500]/70" />
            </div>
            <div>
              <h2 className="glass-section-header text-[16px] font-semibold text-[#1D1D1F] tracking-[-0.01em]">
                Alertes Actives
              </h2>
              {alertCounts && (
                <p className="text-[12px] text-[#AEAEB2] mt-0.5">
                  {alertCounts.total} alerte{alertCounts.total !== 1 ? 's' : ''}
                  {alertCounts.criticalUnacknowledged > 0 && (
                    <span className="text-[#FF3B30] font-medium ml-1">
                      — {alertCounts.criticalUnacknowledged} critique{alertCounts.criticalUnacknowledged !== 1 ? 's' : ''} non accusée{alertCounts.criticalUnacknowledged !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="glass-card-hover flex items-center gap-2 px-3.5 py-2 text-[12px] font-medium text-[#86868B] hover:text-[#1D1D1F] disabled:opacity-50"
            style={{ borderRadius: '10px' }}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isScanning && 'animate-spin')} />
            Scanner alertes
          </button>
        </div>

        {/* Alert Cards */}
        {sortedAlerts.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#34C759]/10 to-[#30D158]/5 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-[#34C759]/70" />
            </div>
            <p className="text-[15px] font-medium text-[#1D1D1F]">Aucune alerte active</p>
            <p className="text-[12px] text-[#AEAEB2] mt-1">Toutes les alertes ont été traitées</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleAlerts.map((alert) => {
              const config = severityConfig[alert.niveau] || severityConfig.INFO;
              return (
                <div
                  key={alert.id}
                  className={cn(
                    'glass-card p-4 border transition-all',
                    config.border,
                    alert.acknowledgedAt && 'opacity-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Severity icon */}
                    <div
                      className={cn('p-2 rounded-[10px] flex-shrink-0', config.bg)}
                      style={{ color: config.color }}
                    >
                      <AlertSeverityIcon niveau={alert.niveau} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-white"
                          style={{ backgroundColor: config.color }}
                        >
                          {alert.niveau}
                        </span>
                        <span className="text-[12px] text-[#86868B]">
                          <AlertTypeLabel type={alert.type} />
                        </span>
                        <span className="text-[11px] text-[#AEAEB2]">
                          {formatRelativeTime(alert.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] text-[#1D1D1F] font-medium leading-snug">
                        {alert.message}
                      </p>
                      {alert.acknowledgedAt && alert.acknowledgedByUser && (
                        <p className="mt-1 text-[11px] text-[#34C759] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Accusé par {alert.acknowledgedByUser.firstName} {alert.acknowledgedByUser.lastName}
                        </p>
                      )}
                    </div>

                    {/* Action */}
                    <div className="flex-shrink-0">
                      {!alert.acknowledgedAt ? (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={acknowledging === alert.id}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors',
                            alert.niveau === 'CRITICAL'
                              ? 'bg-[#FF3B30] text-white hover:bg-[#FF3B30]/90'
                              : 'bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.07]'
                          )}
                        >
                          {acknowledging === alert.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          Accuser
                        </button>
                      ) : (
                        <CheckCircle className="w-5 h-5 text-[#34C759]" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Show more / less button */}
            {hasMoreAlerts && (
              <button
                onClick={() => setShowAllAlerts(!showAllAlerts)}
                className="w-full glass-card-hover p-3 text-center text-[13px] font-medium text-[#007AFF] hover:text-[#0056CC] flex items-center justify-center gap-1.5"
                style={{ borderRadius: '14px' }}
              >
                {showAllAlerts ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Réduire
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Voir toutes les alertes ({sortedAlerts.length})
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── All Clear State ─── */}
      {toutVaBien && (
        <div className="glass-card p-10 text-center">
          <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-[#34C759]/10 to-[#30D158]/5 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-[#34C759]/70" />
          </div>
          <p className="text-[18px] font-semibold text-[#1D1D1F] tracking-[-0.01em]">
            Production sécurisée
          </p>
          <p className="text-[13px] text-[#AEAEB2] mt-2 max-w-xs mx-auto leading-relaxed">
            Aucun blocage détecté — Approvisionnements sous contrôle
          </p>
        </div>
      )}
    </div>
  );
}

function getSeverity(value: number, type: 'critical' | 'warning'): KpiSeverity {
  if (value === 0) return 'success';
  return type === 'critical' ? 'critical' : 'warning';
}
