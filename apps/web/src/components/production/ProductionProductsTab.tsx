'use client';

import { useRouter } from 'next/navigation';
import { Package, Plus, CheckCircle, AlertTriangle, Settings, Beaker, Layers, History, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductPf {
  id: number;
  code: string;
  name: string;
  unit: string;
  hasRecipe: boolean;
  recipeBatchWeight: number;
  recipeOutputQty: number;
  recipeShelfLife: number;
}

interface ProductionProductsTabProps {
  products: ProductPf[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewProduct: () => void;
}

const formatWeight = (grams: number) => grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${grams} g`;

export function ProductionProductsTab({ products, searchQuery, onSearchChange, onNewProduct }: ProductionProductsTabProps) {
  const router = useRouter();

  const filteredProducts = products.filter((p) =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const productStats = {
    total: products.length,
    withRecipe: products.filter((p) => p.hasRecipe).length,
    withoutRecipe: products.filter((p) => !p.hasRecipe).length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#AEAEB2]" />
          <input type="text" placeholder="Rechercher un produit..." value={searchQuery} onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[13px] border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] placeholder:text-[#C7C7CC]" />
        </div>
        <button onClick={onNewProduct} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-black/80 font-medium text-[13px] shadow-sm transition-all">
          <Plus className="w-4 h-4" /> Nouveau produit
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 rounded-xl flex items-center justify-center"><Package className="w-5 h-5 text-[#AF52DE]" /></div>
            <div><p className="text-2xl font-bold text-[#1D1D1F]">{productStats.total}</p><p className="text-sm text-[#86868B]">Produits</p></div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-xl flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-500" /></div>
            <div><p className="text-2xl font-bold text-[#1D1D1F]">{productStats.withRecipe}</p><p className="text-sm text-[#86868B]">Avec recette</p></div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-amber-500" /></div>
            <div><p className="text-2xl font-bold text-[#1D1D1F]">{productStats.withoutRecipe}</p><p className="text-sm text-[#86868B]">A configurer</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className={cn('glass-card-hover overflow-hidden transition-all', !product.hasRecipe && 'ring-1 ring-amber-300/30')}>
            <div className="p-4 border-b border-black/[0.04]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', product.hasRecipe ? 'bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5' : 'bg-gradient-to-br from-amber-500/10 to-amber-500/5')}>
                    <Package className={cn('w-6 h-6', product.hasRecipe ? 'text-[#AF52DE]' : 'text-amber-500')} />
                  </div>
                  <div>
                    <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">{product.name}</h3>
                    <p className="text-sm text-[#86868B] font-mono">{product.code}</p>
                  </div>
                </div>
                {product.hasRecipe ? (
                  <span className="glass-pill text-emerald-700 text-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Pret
                  </span>
                ) : (
                  <span className="glass-pill text-amber-700 text-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    A configurer
                  </span>
                )}
              </div>
            </div>
            {product.hasRecipe ? (
              <div className="p-4 bg-white/20 backdrop-blur-sm">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div><p className="text-[11px] uppercase tracking-wider text-[#86868B]">Batch</p><p className="font-semibold text-[#1D1D1F]">{formatWeight(product.recipeBatchWeight)}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wider text-[#86868B]">Sortie</p><p className="font-semibold text-[#1D1D1F]">{product.recipeOutputQty} {product.unit}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wider text-[#86868B]">DLC</p><p className="font-semibold text-[#1D1D1F]">{product.recipeShelfLife}j</p></div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50/30 backdrop-blur-sm text-center"><p className="text-sm text-amber-700">Configurez la recette pour activer la production</p></div>
            )}
            <div className="p-3 border-t border-black/[0.04]">
              <div className="flex gap-2">
                <button onClick={() => router.push(`/dashboard/production/${product.id}?tab=params`)} className="flex-1 px-3 py-2 text-xs font-medium text-[#6E6E73] hover:bg-white/40 rounded-lg flex items-center justify-center gap-1 transition-colors"><Settings className="w-3.5 h-3.5" />Parametres</button>
                <button onClick={() => router.push(`/dashboard/production/${product.id}?tab=recipe`)} className="flex-1 px-3 py-2 text-xs font-medium text-[#6E6E73] hover:bg-white/40 rounded-lg flex items-center justify-center gap-1 transition-colors"><Beaker className="w-3.5 h-3.5" />Recette</button>
                <button onClick={() => router.push(`/dashboard/production/${product.id}?tab=batch`)} className="flex-1 px-3 py-2 text-xs font-medium text-[#6E6E73] hover:bg-white/40 rounded-lg flex items-center justify-center gap-1 transition-colors"><Layers className="w-3.5 h-3.5" />Batch</button>
                <button onClick={() => router.push(`/dashboard/production/${product.id}?tab=history`)} className="flex-1 px-3 py-2 text-xs font-medium text-[#6E6E73] hover:bg-white/40 rounded-lg flex items-center justify-center gap-1 transition-colors"><History className="w-3.5 h-3.5" />Historique</button>
              </div>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="col-span-3 text-center py-16">
            <Package className="w-12 h-12 text-[#D1D1D6] mx-auto mb-4" />
            <p className="text-[#86868B]">Aucun produit trouve</p>
          </div>
        )}
      </div>
    </div>
  );
}
