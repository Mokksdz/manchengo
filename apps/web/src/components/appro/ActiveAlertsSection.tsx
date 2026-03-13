'use client';

import { useState } from 'react';
import { type ApproAlert, type AlertCounts } from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  Bell, RefreshCw, AlertTriangle, AlertCircle, Info,
  Eye, CheckCircle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';

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

/* ─── Props ─── */
export interface ActiveAlertsSectionProps {
  alerts: ApproAlert[];
  alertCounts: AlertCounts | null;
  onAcknowledge: (alertId: number) => Promise<void>;
  onScan: () => Promise<void>;
}

/**
 * ActiveAlertsSection — Glassmorphism alerts panel with severity-sorted cards
 *
 * Displays active alerts with acknowledge and scan functionality.
 * Alerts are sorted by severity (CRITICAL > WARNING > INFO) then by date.
 */
export function ActiveAlertsSection({
  alerts,
  alertCounts,
  onAcknowledge,
  onScan,
}: ActiveAlertsSectionProps) {
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [acknowledging, setAcknowledging] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Sort alerts: CRITICAL first, then WARNING, then INFO, then by date
  const sortedAlerts = [...alerts].sort((a, b) => {
    const levelOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    const levelDiff = (levelOrder[a.niveau] ?? 2) - (levelOrder[b.niveau] ?? 2);
    if (levelDiff !== 0) return levelDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const visibleAlerts = showAllAlerts ? sortedAlerts : sortedAlerts.slice(0, 5);
  const hasMoreAlerts = sortedAlerts.length > 5;

  const handleAcknowledge = async (alertId: number) => {
    try {
      setAcknowledging(alertId);
      await onAcknowledge(alertId);
    } finally {
      setAcknowledging(null);
    }
  };

  const handleScan = async () => {
    try {
      setIsScanning(true);
      await onScan();
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div id="alertes-actives" className="scroll-mt-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="glass-section-icon w-9 h-9 rounded-[12px] bg-gradient-to-br from-[#FF9500]/10 to-[#FF3B30]/5 flex items-center justify-center">
            <Bell className="w-[18px] h-[18px] text-[#FF9500]/70" />
          </div>
          <div>
            <h2 className="glass-section-header font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">
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
  );
}
