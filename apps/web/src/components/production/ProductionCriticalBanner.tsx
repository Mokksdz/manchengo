'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRODUCTION CRITICAL BANNER — P0.2
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Banniere d'urgence NON IGNORABLE pour le Dashboard Production
 *
 * Affichage SI:
 * - >=1 MP BLOQUANT_PRODUCTION
 * - OU >=1 BC CRITICAL
 *
 * Caracteristiques:
 * - Non dismissable
 * - Toujours en haut
 * - Couleur rouge, animation legere
 */

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types from backend
export type MpRiskState = 'BLOQUANT_PRODUCTION' | 'RISQUE_48H' | 'RISQUE_72H' | 'SURVEILLANCE' | 'OK';
export type BcImpactLevel = 'BLOQUANT' | 'MAJEUR' | 'MINEUR';

export interface MpCritiqueProduction {
  productId: number;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  state: MpRiskState;
  joursCouverture: number | null;
  isMonoSourced: boolean;
  supplierName: string | null;
  supplierId: number | null;
  usedInRecipes: number;
  justification: string;
}

export interface BcCritiqueProduction {
  bcId: string;
  reference: string;
  supplierName: string;
  supplierId: number;
  daysLate: number;
  expectedDelivery: string;
  impactLevel: BcImpactLevel;
  hasCriticalMp: boolean;
  mpImpacted: { id: number; code: string; name: string }[];
  status: string;
}

export interface FournisseurBloquant {
  supplierId: number;
  name: string;
  code: string;
  blockingMpCount: number;
  isMonoSourceForCriticalMp: boolean;
  mpBloquantes: { id: number; code: string; name: string }[];
  bcEnRetard: number;
}

export interface SupplyRisksData {
  summary: {
    hasBlockingRisk: boolean;
    totalMpBloquantes: number;
    totalBcCritiques: number;
    totalFournisseursBloquants: number;
    urgencyLevel: 'CRITIQUE' | 'ATTENTION' | 'OK';
  };
  mpCritiques: MpCritiqueProduction[];
  bcCritiques: BcCritiqueProduction[];
  fournisseursBloquants: FournisseurBloquant[];
  generatedAt: string;
}

interface ProductionCriticalBannerProps {
  data: SupplyRisksData | null;
  isLoading?: boolean;
  onShowDetails?: () => void;
}

export function ProductionCriticalBanner({ data, isLoading, onShowDetails }: ProductionCriticalBannerProps) {
  // Ne rien afficher si pas de donnees ou OK
  if (isLoading || !data) return null;
  if (data.summary.urgencyLevel === 'OK') return null;

  const isCritique = data.summary.urgencyLevel === 'CRITIQUE';
  const mpBloquantes = data.mpCritiques.filter(mp => mp.state === 'BLOQUANT_PRODUCTION');
  const bcBloquants = data.bcCritiques.filter(bc => bc.impactLevel === 'BLOQUANT');

  return (
    <div
      className={cn(
        'glass-decision-card rounded-[20px] p-4 mb-6 overflow-hidden',
        isCritique
          ? 'glass-tint-red animate-glow-pulse'
          : 'glass-tint-orange'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0',
            isCritique
              ? 'bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5'
              : 'bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5'
          )}
        >
          <AlertTriangle
            className={cn('w-6 h-6', isCritique ? 'text-[#FF3B30]' : 'text-[#FF9500]')}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3
            className={cn(
              'text-lg font-bold',
              isCritique ? 'text-[#FF3B30]' : 'text-[#FF9500]'
            )}
          >
            {isCritique ? 'PRODUCTION EN RISQUE IMMINENT' : 'ATTENTION SUPPLY CHAIN'}
          </h3>

          {/* Summary */}
          <p className={cn('text-sm mt-1', isCritique ? 'text-[#FF3B30]/80' : 'text-[#FF9500]/80')}>
            {data.summary.totalMpBloquantes > 0 && (
              <span className="font-semibold">{data.summary.totalMpBloquantes} MP bloquante{data.summary.totalMpBloquantes > 1 ? 's' : ''}</span>
            )}
            {data.summary.totalMpBloquantes > 0 && data.summary.totalBcCritiques > 0 && ' · '}
            {data.summary.totalBcCritiques > 0 && (
              <span className="font-semibold">{data.summary.totalBcCritiques} BC en retard critique</span>
            )}
            {data.summary.totalFournisseursBloquants > 0 && (
              <>
                {' · '}
                <span className="font-semibold">{data.summary.totalFournisseursBloquants} fournisseur{data.summary.totalFournisseursBloquants > 1 ? 's' : ''} a risque</span>
              </>
            )}
          </p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 mt-3">
            {mpBloquantes.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 glass-card rounded-full border border-[#FF3B30]/15">
                <Package className="w-4 h-4 text-[#FF3B30]" />
                <span className="text-sm font-medium text-[#FF3B30]">
                  {mpBloquantes.slice(0, 3).map(mp => mp.code).join(', ')}
                  {mpBloquantes.length > 3 && ` +${mpBloquantes.length - 3}`}
                </span>
              </div>
            )}
            {bcBloquants.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 glass-card rounded-full border border-[#FF3B30]/15">
                <Truck className="w-4 h-4 text-[#FF3B30]" />
                <span className="text-sm font-medium text-[#FF3B30]">
                  {bcBloquants.slice(0, 2).map(bc => `${bc.reference} (+${bc.daysLate}j)`).join(', ')}
                  {bcBloquants.length > 2 && ` +${bcBloquants.length - 2}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Link
            href="/dashboard/appro"
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors shadow-lg',
              isCritique
                ? 'bg-[#FF3B30] text-white hover:bg-[#FF3B30]/90 shadow-[#FF3B30]/20'
                : 'bg-[#FF9500] text-white hover:bg-[#FF9500]/90 shadow-[#FF9500]/20'
            )}
          >
            Voir Approvisionnement
            <ArrowRight className="w-4 h-4" />
          </Link>
          {onShowDetails && (
            <button
              onClick={onShowDetails}
              className={cn(
                'flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors backdrop-blur-sm',
                isCritique
                  ? 'bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/20 border border-[#FF3B30]/15'
                  : 'bg-[#FF9500]/10 text-[#FF9500] hover:bg-[#FF9500]/20 border border-[#FF9500]/15'
              )}
            >
              Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
