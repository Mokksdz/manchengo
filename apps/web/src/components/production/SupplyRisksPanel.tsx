'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SUPPLY RISKS PANEL — P0.3 + P0.4
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Panel détaillé des risques supply chain pour le Dashboard Production
 *
 * P0.3: Affiche les jours de couverture MP avec code couleur
 * P0.4: Sépare BLOCAGE ACTUEL vs RISQUE 48-72H
 * P0.5: CTAs clairs vers APPRO
 */

import Link from 'next/link';
import {
  Package, Truck, Users, Clock,
  AlertCircle, CheckCircle, XCircle, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  SupplyRisksData,
  MpCritiqueProduction,
  BcCritiqueProduction,
} from './ProductionCriticalBanner';

interface SupplyRisksPanelProps {
  data: SupplyRisksData | null;
  isLoading?: boolean;
}

/**
 * Code couleur jours de couverture
 */
function getCoverageColor(days: number | null): { bg: string; text: string; label: string } {
  if (days === null) return { bg: 'bg-black/[0.03]', text: 'text-[#6E6E73]', label: '∞' };
  if (days < 1.5) return { bg: 'bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5', text: 'text-[#FF3B30]', label: `${days.toFixed(1)}j` };
  if (days < 3) return { bg: 'bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5', text: 'text-[#FF9500]', label: `${days.toFixed(1)}j` };
  return { bg: 'bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5', text: 'text-[#34C759]', label: `${days.toFixed(1)}j` };
}

/**
 * Badge état MP
 */
function MpStateBadge({ state }: { state: string }) {
  const config: Record<string, { dot: string; text: string; label: string }> = {
    'BLOQUANT_PRODUCTION': { dot: 'bg-[#FF3B30]', text: 'text-[#FF3B30]', label: '⛔ Bloquant' },
    'RISQUE_48H': { dot: 'bg-[#FF9500]', text: 'text-[#FF9500]', label: '⚠️ Risque 48h' },
    'RISQUE_72H': { dot: 'bg-[#FF9500]', text: 'text-[#FF9500]', label: '🟠 Risque 72h' },
    'SURVEILLANCE': { dot: 'bg-[#007AFF]', text: 'text-[#007AFF]', label: '👁️ Surveillance' },
    'OK': { dot: 'bg-[#34C759]', text: 'text-[#34C759]', label: '✓ OK' },
  };
  const c = config[state] || config['OK'];
  return (
    <span className={cn('glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', c.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}

/**
 * Badge impact BC
 */
function BcImpactBadge({ level }: { level: string }) {
  const config: Record<string, { dot: string; text: string; label: string }> = {
    'BLOQUANT': { dot: 'bg-[#FF3B30]', text: 'text-[#FF3B30]', label: '⛔ Bloquant' },
    'MAJEUR': { dot: 'bg-[#FF9500]', text: 'text-[#FF9500]', label: '⚠️ Majeur' },
    'MINEUR': { dot: 'bg-[#FF9500]', text: 'text-[#FF9500]', label: '🟡 Mineur' },
  };
  const c = config[level] || config['MINEUR'];
  return (
    <span className={cn('glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', c.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}

export function SupplyRisksPanel({ data, isLoading }: SupplyRisksPanelProps) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-[20px] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[#E5E5E5] rounded w-1/3"></div>
          <div className="h-24 bg-black/[0.03] rounded"></div>
          <div className="h-24 bg-black/[0.03] rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Séparer les MP par zone (P0.4)
  const mpBloquantMaintenant = data.mpCritiques.filter(
    mp => mp.state === 'BLOQUANT_PRODUCTION'
  );
  const mpRisque48_72h = data.mpCritiques.filter(
    mp => mp.state === 'RISQUE_48H' || mp.state === 'RISQUE_72H'
  );
  const mpSurveillance = data.mpCritiques.filter(
    mp => mp.state === 'SURVEILLANCE'
  );

  // BC critiques
  const bcBloquants = data.bcCritiques.filter(bc => bc.impactLevel === 'BLOQUANT');
  const bcAutres = data.bcCritiques.filter(bc => bc.impactLevel !== 'BLOQUANT');

  const hasAnyRisk = data.mpCritiques.length > 0 || data.bcCritiques.length > 0;

  if (!hasAnyRisk) {
    return (
      <div className="glass-decision-card glass-tint-emerald rounded-[20px] p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5 rounded-2xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-[#34C759]" />
          </div>
          <div>
            <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Supply Chain OK</h3>
            <p className="text-sm text-[#34C759]">
              Aucun risque détecté sur les matières premières et les commandes fournisseurs
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════════════
          P0.4 ZONE 1: BLOQUANT MAINTENANT
          ═══════════════════════════════════════════════════════════════════════════ */}
      {(mpBloquantMaintenant.length > 0 || bcBloquants.length > 0) && (
        <div className="glass-decision-card glass-tint-red rounded-[20px] overflow-hidden animate-glow-pulse">
          <div className="bg-gradient-to-br from-[#FF3B30]/15 to-[#FF3B30]/5 px-5 py-3 border-b border-[#FF3B30]/10">
            <h3 className="text-lg font-bold text-[#FF3B30] flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              🔴 BLOQUANT MAINTENANT
            </h3>
            <p className="text-sm text-[#FF3B30]/80 mt-1">
              Ces problèmes empêchent ou vont empêcher la production immédiatement
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* MP bloquantes */}
            {mpBloquantMaintenant.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#FF3B30] mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Matières Premières en rupture ({mpBloquantMaintenant.length})
                </h4>
                <div className="space-y-2">
                  {mpBloquantMaintenant.map(mp => (
                    <MpRiskCard key={mp.productId} mp={mp} variant="critical" />
                  ))}
                </div>
              </div>
            )}

            {/* BC bloquants */}
            {bcBloquants.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#FF3B30] mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Bons de Commande critiques ({bcBloquants.length})
                </h4>
                <div className="space-y-2">
                  {bcBloquants.map(bc => (
                    <BcRiskCard key={bc.bcId} bc={bc} variant="critical" />
                  ))}
                </div>
              </div>
            )}

            {/* CTA P0.5 */}
            <div className="flex items-center gap-3 pt-2 border-t border-[#FF3B30]/10">
              <Link
                href="/dashboard/appro"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#FF3B30] text-white rounded-full text-sm font-semibold hover:bg-[#FF3B30]/90 transition-colors shadow-lg shadow-[#FF3B30]/20"
              >
                <ExternalLink className="w-4 h-4" />
                Voir Approvisionnement (lecture seule)
              </Link>
              <span className="text-sm text-[#FF3B30]/80">
                ➡️ Contactez APPRO pour action urgente
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          P0.4 ZONE 2: RISQUE 48-72H
          ═══════════════════════════════════════════════════════════════════════════ */}
      {(mpRisque48_72h.length > 0 || bcAutres.length > 0) && (
        <div className="glass-decision-card glass-tint-orange rounded-[20px] overflow-hidden">
          <div className="bg-gradient-to-br from-[#FF9500]/15 to-[#FF9500]/5 px-5 py-3 border-b border-[#FF9500]/10">
            <h3 className="text-lg font-bold text-[#FF9500] flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              🟠 RISQUE 48–72H
            </h3>
            <p className="text-sm text-[#FF9500]/80 mt-1">
              Problèmes à anticiper pour éviter un blocage prochain
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* MP à risque */}
            {mpRisque48_72h.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#FF9500] mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Matières Premières à surveiller ({mpRisque48_72h.length})
                </h4>
                <div className="space-y-2">
                  {mpRisque48_72h.map(mp => (
                    <MpRiskCard key={mp.productId} mp={mp} variant="warning" />
                  ))}
                </div>
              </div>
            )}

            {/* BC autres */}
            {bcAutres.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#FF9500] mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Bons de Commande en retard ({bcAutres.length})
                </h4>
                <div className="space-y-2">
                  {bcAutres.map(bc => (
                    <BcRiskCard key={bc.bcId} bc={bc} variant="warning" />
                  ))}
                </div>
              </div>
            )}

            {/* CTA P0.5 */}
            <div className="flex items-center gap-3 pt-2 border-t border-[#FF9500]/10">
              <Link
                href="/dashboard/appro"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#FF9500] text-white rounded-full text-sm font-semibold hover:bg-[#FF9500]/90 transition-colors shadow-lg shadow-[#FF9500]/20"
              >
                <ExternalLink className="w-4 h-4" />
                Voir Approvisionnement
              </Link>
              <span className="text-sm text-[#FF9500]/80">
                ➡️ Planifiez les réapprovisionnements
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          ZONE 3: SURVEILLANCE (optionnel, moins critique)
          ═══════════════════════════════════════════════════════════════════════════ */}
      {mpSurveillance.length > 0 && (
        <div className="glass-decision-card glass-tint-blue rounded-[20px] overflow-hidden">
          <div className="bg-gradient-to-br from-[#007AFF]/15 to-[#007AFF]/5 px-5 py-3 border-b border-[#007AFF]/10">
            <h3 className="font-display text-[17px] font-bold text-[#007AFF] tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4" />
              👁️ En surveillance
            </h3>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {mpSurveillance.map(mp => (
                <div
                  key={mp.productId}
                  className="flex items-center gap-3 px-3 py-2 glass-card rounded-xl"
                >
                  <span className="font-mono text-xs text-[#007AFF] font-medium">{mp.code}</span>
                  <span className="text-sm text-[#1D1D1F] truncate flex-1">{mp.name}</span>
                  <CoverageBadge days={mp.joursCouverture} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fournisseurs bloquants */}
      {data.fournisseursBloquants.length > 0 && (
        <div className="glass-card rounded-[20px] overflow-hidden">
          <div className="px-5 py-3 border-b border-black/[0.04]">
            <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4" />
              Fournisseurs à surveiller ({data.fournisseursBloquants.length})
            </h3>
          </div>
          <div className="divide-y divide-black/[0.04]">
            {data.fournisseursBloquants.slice(0, 5).map(supplier => (
              <div key={supplier.supplierId} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-[#1D1D1F]">{supplier.name}</span>
                  <span className="text-xs text-[#86868B] ml-2">({supplier.code})</span>
                </div>
                <div className="flex items-center gap-3">
                  {supplier.blockingMpCount > 0 && (
                    <span className="glass-pill inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full text-[#FF3B30]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]" />
                      {supplier.blockingMpCount} MP bloquante{supplier.blockingMpCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {supplier.bcEnRetard > 0 && (
                    <span className="glass-pill inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full text-[#FF9500]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />
                      {supplier.bcEnRetard} BC retard
                    </span>
                  )}
                  {supplier.isMonoSourceForCriticalMp && (
                    <span className="glass-pill inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full text-[#AF52DE]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#AF52DE]" />
                      Mono-source
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Card MP avec risque
 */
function MpRiskCard({ mp, variant }: { mp: MpCritiqueProduction; variant: 'critical' | 'warning' }) {
  const isCritical = variant === 'critical';

  return (
    <div className={cn(
      'flex items-center gap-4 p-3 rounded-[28px] glass-card',
      isCritical ? 'border border-[#FF3B30]/15' : 'border border-[#FF9500]/15'
    )}>
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
        isCritical ? 'bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5' : 'bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5'
      )}>
        <Package className={cn('w-5 h-5', isCritical ? 'text-[#FF3B30]' : 'text-[#FF9500]')} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-[#1D1D1F]">{mp.code}</span>
          <MpStateBadge state={mp.state} />
        </div>
        <p className="text-sm text-[#6E6E73] truncate">{mp.name}</p>
        {mp.supplierName && (
          <p className="text-xs text-[#86868B] mt-1">
            Fournisseur: {mp.supplierName}
            {mp.isMonoSourced && <span className="ml-1 text-[#AF52DE]">(unique)</span>}
          </p>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-lg font-bold text-[#1D1D1F]">{mp.currentStock} <span className="text-sm font-normal text-[#86868B]">{mp.unit}</span></p>
        <CoverageBadge days={mp.joursCouverture} />
      </div>
    </div>
  );
}

/**
 * Card BC avec risque
 */
function BcRiskCard({ bc, variant }: { bc: BcCritiqueProduction; variant: 'critical' | 'warning' }) {
  const isCritical = variant === 'critical';

  return (
    <div className={cn(
      'flex items-center gap-4 p-3 rounded-[28px] glass-card',
      isCritical ? 'border border-[#FF3B30]/15' : 'border border-[#FF9500]/15'
    )}>
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
        isCritical ? 'bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5' : 'bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5'
      )}>
        <Truck className={cn('w-5 h-5', isCritical ? 'text-[#FF3B30]' : 'text-[#FF9500]')} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-[#1D1D1F]">{bc.reference}</span>
          <BcImpactBadge level={bc.impactLevel} />
        </div>
        <p className="text-sm text-[#6E6E73]">{bc.supplierName}</p>
        {bc.mpImpacted.length > 0 && (
          <p className="text-xs text-[#86868B] mt-1">
            MP: {bc.mpImpacted.slice(0, 3).map(mp => mp.code).join(', ')}
            {bc.mpImpacted.length > 3 && ` +${bc.mpImpacted.length - 3}`}
          </p>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        <p className={cn(
          'text-lg font-bold',
          isCritical ? 'text-[#FF3B30]' : 'text-[#FF9500]'
        )}>
          +{bc.daysLate}j
        </p>
        <p className="text-xs text-[#86868B]">de retard</p>
      </div>
    </div>
  );
}

/**
 * Badge jours de couverture (P0.3)
 */
function CoverageBadge({ days }: { days: number | null }) {
  const { bg, text, label } = getCoverageColor(days);
  return (
    <span className={cn('glass-status-pill px-2.5 py-0.5 rounded-full text-xs font-semibold', bg, text)}>
      {label}
    </span>
  );
}
