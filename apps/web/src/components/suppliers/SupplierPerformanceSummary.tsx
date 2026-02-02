'use client';

import { FileText, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

/**
 * SupplierPerformanceSummary — Indicateurs clés fournisseur
 * 
 * Affiche UNIQUEMENT ce qui justifie une décision:
 * - BC envoyés (30j)
 * - BC en retard
 * - Taux respect délais
 * - Impact recettes
 * - Dernier incident
 */

interface SupplierPerformanceSummaryProps {
  bcSent30Days: number;
  bcLate: number;
  deliveryRespectRate: number;
  impactRecipes: number;
  lastIncidentDays?: number;
}

export function SupplierPerformanceSummary({
  bcSent30Days,
  bcLate,
  deliveryRespectRate,
  impactRecipes,
  lastIncidentDays,
}: SupplierPerformanceSummaryProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {/* BC envoyés */}
      <div className="flex items-center gap-1.5 text-[#6E6E73]">
        <FileText className="w-4 h-4 text-[#AEAEB2]" />
        <span>BC (30j) : <span className="font-semibold text-[#1D1D1F]">{bcSent30Days}</span></span>
      </div>

      {/* BC en retard */}
      {bcLate > 0 && (
        <div className="flex items-center gap-1.5 text-red-600">
          <Clock className="w-4 h-4" />
          <span className="font-semibold">BC en retard : {bcLate}</span>
        </div>
      )}

      {/* Taux respect délais */}
      <div className="flex items-center gap-1.5">
        <TrendingUp className={`w-4 h-4 ${deliveryRespectRate >= 80 ? 'text-emerald-500' : deliveryRespectRate >= 60 ? 'text-amber-500' : 'text-red-500'}`} />
        <span className="text-[#6E6E73]">
          Délais : <span className={`font-semibold ${deliveryRespectRate >= 80 ? 'text-emerald-600' : deliveryRespectRate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
            {deliveryRespectRate}%
          </span>
        </span>
      </div>

      {/* Impact recettes */}
      {impactRecipes > 0 && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 font-semibold text-xs">
          🔥 Bloque {impactRecipes} recette{impactRecipes > 1 ? 's' : ''}
        </span>
      )}

      {/* Dernier incident */}
      {lastIncidentDays !== undefined && lastIncidentDays <= 30 && (
        <div className="flex items-center gap-1.5 text-amber-600">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs">Incident : J-{lastIncidentDays}</span>
        </div>
      )}
    </div>
  );
}
