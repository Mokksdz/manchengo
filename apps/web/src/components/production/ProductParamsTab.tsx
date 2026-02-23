'use client';

import { Scale, Box, Calendar } from 'lucide-react';

interface ProductPf {
  id: number;
  code: string;
  name: string;
  unit: string;
  priceHt: number;
  minStock: number;
}

interface Recipe {
  batchWeight: number;
  outputQuantity: number;
  shelfLifeDays: number;
}

interface ProductParamsTabProps {
  product: ProductPf;
  recipe: Recipe | null;
}

const formatPrice = (cents: number) => new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 2 }).format(cents / 100);
const formatWeight = (kg: number) => `${kg} kg`;

export function ProductParamsTab({ product, recipe }: ProductParamsTabProps) {
  return (
    <div className="glass-card p-6">
      <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4">Paramètres du produit</h2>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868B] mb-1">Code</label>
          <p className="text-[#1D1D1F] font-mono bg-black/[0.03] px-4 py-2 rounded-lg">{product.code}</p>
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868B] mb-1">Nom</label>
          <p className="text-[#1D1D1F]">{product.name}</p>
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868B] mb-1">Unité</label>
          <p className="text-[#1D1D1F]">{product.unit}</p>
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868B] mb-1">Prix HT</label>
          <p className="text-[#1D1D1F]">{formatPrice(product.priceHt)}</p>
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868B] mb-1">Stock minimum</label>
          <p className="text-[#1D1D1F]">{product.minStock} {product.unit}</p>
        </div>
      </div>

      {recipe && (
        <div className="mt-6 pt-6 border-t border-black/[0.04]">
          <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4">Paramètres de production</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 rounded-[14px] p-4">
              <div className="flex items-center gap-2 text-[#AF52DE] mb-1">
                <Scale className="w-4 h-4" />
                <span className="text-sm font-medium">Poids batch</span>
              </div>
              <p className="text-xl font-bold text-[#1D1D1F]">{formatWeight(recipe.batchWeight)}</p>
            </div>
            <div className="bg-gradient-to-br from-[#007AFF]/10 to-[#007AFF]/5 rounded-[14px] p-4">
              <div className="flex items-center gap-2 text-[#007AFF] mb-1">
                <Box className="w-4 h-4" />
                <span className="text-sm font-medium">Quantité/batch</span>
              </div>
              <p className="text-xl font-bold text-[#1D1D1F]">{recipe.outputQuantity} {product.unit}</p>
            </div>
            <div className="bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5 rounded-[14px] p-4">
              <div className="flex items-center gap-2 text-[#34C759] mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">DLC</span>
              </div>
              <p className="text-xl font-bold text-[#1D1D1F]">{recipe.shelfLifeDays} jours</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
