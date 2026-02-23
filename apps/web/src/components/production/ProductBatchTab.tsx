'use client';

import { CheckCircle, AlertTriangle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductMp {
  id: number;
  code: string;
  name: string;
}

interface StockAvailability {
  productMpId: number;
  productMp: ProductMp;
  requiredQuantity: number;
  availableQuantity: number;
  isAvailable: boolean;
  isMandatory: boolean;
  shortage?: number;
}

interface StockCheck {
  canProduce: boolean;
  targetOutput: number;
  availability: StockAvailability[];
}

interface Recipe {
  batchWeight: number;
  outputQuantity: number;
  shelfLifeDays: number;
}

interface ProductBatchTabProps {
  recipe: Recipe | null;
  productUnit: string;
  batchCount: number;
  onBatchCountChange: (count: number) => void;
  stockCheck: StockCheck | null;
  isCheckingStock: boolean;
  isCreatingOrder: boolean;
  onCreateOrder: () => void;
}

const formatWeight = (kg: number) => `${kg} kg`;

export function ProductBatchTab({
  recipe, productUnit, batchCount, onBatchCountChange,
  stockCheck, isCheckingStock, isCreatingOrder, onCreateOrder
}: ProductBatchTabProps) {
  if (!recipe) {
    return (
      <div className="glass-card glass-tint-orange p-6 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-[#FF9500] mb-3" />
        <p className="text-[#FF9500]">
          Impossible de lancer une production sans recette définie.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Batch Configuration */}
      <div className="glass-card p-6">
        <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4">Configuration du batch</h2>
        <div className="flex items-end gap-6">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868B] mb-1">Nombre de batchs</label>
            <input
              type="number"
              min="1"
              max="100"
              value={batchCount}
              onChange={(e) => onBatchCountChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-32 px-4 py-2 border border-black/[0.06] rounded-xl bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#AF52DE]/30"
            />
          </div>
          <div className="flex-1 grid grid-cols-3 gap-4">
            <div className="bg-black/[0.03] rounded-[14px] p-3">
              <span className="text-[11px] uppercase tracking-wider text-[#86868B]">Quantité cible</span>
              <p className="text-lg font-bold">{recipe.outputQuantity * batchCount} {productUnit}</p>
            </div>
            <div className="bg-black/[0.03] rounded-[14px] p-3">
              <span className="text-[11px] uppercase tracking-wider text-[#86868B]">Poids total</span>
              <p className="text-lg font-bold">{formatWeight(recipe.batchWeight * batchCount)}</p>
            </div>
            <div className="bg-black/[0.03] rounded-[14px] p-3">
              <span className="text-[11px] uppercase tracking-wider text-[#86868B]">DLC estimée</span>
              <p className="text-lg font-bold">
                {new Date(Date.now() + recipe.shelfLifeDays * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Check */}
      {stockCheck && (
        <div className="glass-card overflow-hidden">
          <div className={cn(
            'p-4 border-b flex items-center justify-between',
            stockCheck.canProduce
              ? 'bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5 border-[#34C759]/20'
              : 'bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5 border-[#FF3B30]/20'
          )}>
            <div className="flex items-center gap-3">
              {stockCheck.canProduce ? (
                <CheckCircle className="w-6 h-6 text-[#34C759]" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-[#FF3B30]" />
              )}
              <div>
                <p className={cn('font-semibold', stockCheck.canProduce ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
                  {stockCheck.canProduce ? 'Stock suffisant' : 'Stock insuffisant'}
                </p>
                <p className="text-sm text-[#6E6E73]">Production de {stockCheck.targetOutput} {productUnit}</p>
              </div>
            </div>
            {stockCheck.canProduce && (
              <button
                onClick={onCreateOrder}
                disabled={isCreatingOrder}
                className="inline-flex items-center gap-2 px-6 py-2 bg-[#34C759] text-white rounded-full hover:bg-[#34C759]/90 disabled:opacity-50 transition-colors"
              >
                <Play className="w-4 h-4" />
                {isCreatingOrder ? 'Création...' : 'Créer ordre de production'}
              </button>
            )}
          </div>
          <table className="w-full">
            <thead className="bg-transparent">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Matière première</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Requis</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Disponible</th>
                <th className="px-4 py-3 text-center text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {stockCheck.availability.map((item) => (
                <tr key={item.productMpId} className={cn(
                  'hover:bg-white/40 transition-colors',
                  !item.isAvailable && item.isMandatory ? 'bg-[#FF3B30]/5' : ''
                )}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-[#86868B] mr-2">{item.productMp.code}</span>
                    <span className="font-medium">{item.productMp.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{item.requiredQuantity}</td>
                  <td className="px-4 py-3 text-right">{item.availableQuantity}</td>
                  <td className="px-4 py-3 text-center">
                    {item.isAvailable ? (
                      <span className="text-[#34C759]">✓ OK</span>
                    ) : (
                      <span className="text-[#FF3B30]">Manque {item.shortage}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCheckingStock && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#AF52DE]" />
        </div>
      )}
    </div>
  );
}
