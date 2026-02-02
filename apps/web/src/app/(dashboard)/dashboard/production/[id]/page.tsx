'use client';

import { authFetch } from '@/lib/api';
import { toast } from 'sonner';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Factory, Settings, History, ArrowLeft, AlertTriangle, Beaker, Layers, Save, Plus } from 'lucide-react';
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';
import {
  ProductParamsTab,
  ProductRecipeTab,
  ProductBatchTab,
  ProductHistoryTab,
} from '@/components/production';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ProductPf {
  id: number;
  code: string;
  name: string;
  unit: string;
  priceHt: number;
  minStock: number;
  isActive: boolean;
}

interface ProductMp {
  id: number;
  code: string;
  name: string;
  unit: string;
  category?: string;
}

type RecipeItemType = 'MP' | 'FLUID' | 'PACKAGING';

interface RecipeItem {
  id: number;
  type: RecipeItemType;
  productMpId: number | null;
  productMp: ProductMp | null;
  name: string | null;
  quantity: number;
  unit: string;
  unitCost: number | null;
  affectsStock: boolean;
  isMandatory: boolean;
  isSubstitutable: boolean;
  sortOrder: number;
  notes: string | null;
}

interface Recipe {
  id: number;
  productPfId: number;
  name: string;
  description: string | null;
  batchWeight: number;
  outputQuantity: number;
  lossTolerance: number;
  productionTime: number | null;
  shelfLifeDays: number;
  isActive: boolean;
  version: number;
  items: RecipeItem[];
}

interface ProductionOrder {
  id: number;
  reference: string;
  batchCount: number;
  targetQuantity: number;
  quantityProduced: number;
  status: string;
  yieldPercentage: number | null;
  startedAt: string | null;
  completedAt: string | null;
  user: { firstName: string; lastName: string };
  lots: { id: number; lotNumber: string; quantityInitial: number }[];
}

interface HistoryData {
  pagination: { page: number; limit: number; total: number; totalPages: number };
  totals: { completedOrders: number; totalProduced: number; avgYield: number };
  orders: ProductionOrder[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
};


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ProductionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const productId = params.id as string;

  // Get initial tab from URL query param
  const initialTab = (searchParams.get('tab') as 'params' | 'recipe' | 'batch' | 'history') || 'params';

  // State
  const [product, setProduct] = useState<ProductPf | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'params' | 'recipe' | 'batch' | 'history'>(initialTab);

  // Recipe edit state
  const [isEditingRecipe, setIsEditingRecipe] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    name: '',
    description: '',
    batchWeight: 0,
    outputQuantity: 1,
    lossTolerance: 0.02,
    productionTime: 0,
    shelfLifeDays: 90,
  });
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  // Add component modal (MP, FLUID, PACKAGING)
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [mpList, setMpList] = useState<ProductMp[]>([]);
  const [packagingList, setPackagingList] = useState<ProductMp[]>([]);
  const [componentForm, setComponentForm] = useState<{
    type: RecipeItemType;
    productMpId: number;
    name: string;
    quantity: number;
    unit: string;
    unitCost: number;
    isMandatory: boolean;
    notes: string;
  }>({
    type: 'MP',
    productMpId: 0,
    name: 'Eau',
    quantity: 0,
    unit: 'kg',
    unitCost: 0,
    isMandatory: true,
    notes: '',
  });
  const [isAddingComponent, setIsAddingComponent] = useState(false);

  // Production batch state
  const [batchCount, setBatchCount] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stockCheck, setStockCheck] = useState<any>(null);
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  // History state
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filters, setFilters] = useState({
    year: new Date().getFullYear() as number | undefined,
    month: undefined as number | undefined,
  });
  const [page, setPage] = useState(1);

  const isAdmin = user?.role === 'ADMIN';

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  const loadProduct = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load product
      const productRes = await authFetch(`/products/pf/${productId}`, {
        credentials: 'include',
      });
      if (!productRes.ok) throw new Error('Produit introuvable');
      const productData = await productRes.json();
      setProduct(productData);

      // Load recipe
      const recipeRes = await authFetch(`/recipes/product/${productId}`, {
        credentials: 'include',
      });
      if (recipeRes.ok) {
        const text = await recipeRes.text();
        const recipeData = text ? JSON.parse(text) : null;
        setRecipe(recipeData);
        if (recipeData) {
          setRecipeForm({
            name: recipeData.name || '',
            description: recipeData.description || '',
            batchWeight: recipeData.batchWeight || 0,
            outputQuantity: recipeData.outputQuantity || 1,
            lossTolerance: recipeData.lossTolerance || 0.02,
            productionTime: recipeData.productionTime || 0,
            shelfLifeDays: recipeData.shelfLifeDays || 90,
          });
        }
      } else {
        setRecipe(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  const loadMpList = useCallback(async () => {
    try {
      // Load raw materials
      const mpRes = await authFetch('/products/raw-materials', {
        credentials: 'include',
      });
      if (mpRes.ok) {
        setMpList(await mpRes.json());
      } else {
        // Fallback to all MP if raw-materials endpoint doesn't exist yet
        const allMpRes = await authFetch('/products/mp', {
          credentials: 'include',
        });
        if (allMpRes.ok) {
          setMpList(await allMpRes.json());
        }
      }

      // Load packaging
      const packRes = await authFetch('/products/packaging', {
        credentials: 'include',
      });
      if (packRes.ok) {
        setPackagingList(await packRes.json());
      }
    } catch (error) {
      console.error('Failed to load product lists:', error);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!product) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.set('year', String(filters.year));
      if (filters.month) params.set('month', String(filters.month));
      params.set('page', String(page));
      params.set('limit', '10');

      const res = await authFetch(
        `/production/product/${productId}/history?${params}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        setHistoryData(await res.json());
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [product, filters, page, productId]);

  const checkStock = useCallback(async () => {
    if (!recipe) return;
    setIsCheckingStock(true);
    try {
      const res = await authFetch(
        `/recipes/${recipe.id}/check-stock?batchCount=${batchCount}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        setStockCheck(await res.json());
      }
    } catch (error) {
      console.error('Failed to check stock:', error);
    } finally {
      setIsCheckingStock(false);
    }
  }, [recipe, batchCount]);

  useEffect(() => {
    loadProduct();
    loadMpList();
  }, [loadProduct, loadMpList]);

  useEffect(() => {
    if (activeTab === 'history' && product) {
      loadHistory();
    }
  }, [activeTab, product, loadHistory]);

  useEffect(() => {
    if (activeTab === 'batch' && recipe) {
      checkStock();
    }
  }, [activeTab, recipe, batchCount, checkStock]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleSaveRecipe = async () => {
    if (!product) return;
    setIsSavingRecipe(true);
    setRecipeError(null);
    try {
      if (recipe) {
        // Update existing recipe
        const res = await authFetch(`/recipes/${recipe.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recipeForm),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Erreur de mise à jour');
        }
        const updated = await res.json();
        setRecipe(updated);
      } else {
        // Create new recipe
        const res = await authFetch('/recipes', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productPfId: product.id,
            ...recipeForm,
            items: [],
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Erreur de création');
        }
        const created = await res.json();
        setRecipe(created);
      }
      setIsEditingRecipe(false);
    } catch (err) {
      setRecipeError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsSavingRecipe(false);
    }
  };

  const handleAddComponent = async () => {
    if (!recipe) return;

    // Validation selon le type
    if (componentForm.type === 'MP' && !componentForm.productMpId) {
      toast.error('Sélectionnez une matière première');
      return;
    }
    if (componentForm.type === 'PACKAGING' && !componentForm.productMpId) {
      toast.error('Sélectionnez un emballage');
      return;
    }
    if (componentForm.type === 'FLUID' && !componentForm.name) {
      toast.error('Entrez un nom pour le fluide');
      return;
    }
    if (!componentForm.quantity || componentForm.quantity <= 0) {
      toast.error('Entrez une quantité valide');
      return;
    }

    setIsAddingComponent(true);
    try {
      const payload = {
        type: componentForm.type,
        productMpId: componentForm.type === 'FLUID' ? null : componentForm.productMpId,
        name: componentForm.type === 'FLUID' ? componentForm.name : null,
        quantity: componentForm.quantity,
        unit: componentForm.unit,
        unitCost: componentForm.type === 'FLUID' ? componentForm.unitCost : null,
        affectsStock: componentForm.type !== 'FLUID',
        isMandatory: componentForm.isMandatory,
        notes: componentForm.notes || null,
      };

      const res = await authFetch(`/recipes/${recipe.id}/items`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur');
      }
      await loadProduct();
      setShowAddComponent(false);
      setComponentForm({
        type: 'MP',
        productMpId: 0,
        name: 'Eau',
        quantity: 0,
        unit: 'kg',
        unitCost: 0,
        isMandatory: true,
        notes: '',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsAddingComponent(false);
    }
  };

  const handleRemoveIngredient = async (itemId: number) => {
    if (!recipe || !confirm('Supprimer cet ingrédient ?')) return;
    try {
      await authFetch(`/recipes/${recipe.id}/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await loadProduct();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch {
      toast.error('Erreur de suppression');
    }
  };

  const handleCreateOrder = async () => {
    if (!product || !stockCheck?.canProduce) return;
    setIsCreatingOrder(true);
    try {
      const res = await authFetch('/production', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productPfId: product.id,
          batchCount,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur');
      }
      const order = await res.json();
      router.push(`/dashboard/production/order/${order.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        {/* Tabs skeleton */}
        <div className="flex gap-8 border-b border-black/[0.04] pb-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-5 w-24" />
          ))}
        </div>
        {/* Content skeleton */}
        <SkeletonTable rows={5} columns={4} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="glass-bg p-8">
        <div className="glass-card rounded-[20px] p-8 text-center max-w-md mx-auto">
          <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-[14px] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-[#1D1D1F] mb-2">Erreur</h2>
          <p className="text-[#86868B] mb-6">{error || 'Produit introuvable'}</p>
          <button
            onClick={() => router.push('/dashboard/production')}
            className="px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full text-sm font-medium hover:bg-black/80 transition-colors"
          >
            Retour à la production
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-bg space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/production')}
            className="glass-card-hover p-2.5 rounded-full"
          >
            <ArrowLeft className="w-5 h-5 text-[#1D1D1F]" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#AF52DE] to-[#8B3CB5] rounded-[14px] flex items-center justify-center shadow-lg">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-[24px] font-semibold text-[#1D1D1F]">{product.name}</h1>
              <div className="flex items-center gap-2 text-sm text-[#86868B]">
                <span className="font-mono">{product.code}</span>
                <span>•</span>
                <span>{formatPrice(product.priceHt)} HT</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-black/[0.04]">
        <nav className="flex gap-8" role="tablist" aria-label="Sections production">
          {[
            { key: 'params', label: 'Paramètres', icon: Settings },
            { key: 'recipe', label: 'Recette', icon: Beaker },
            { key: 'batch', label: 'Batch & Emballage', icon: Layers },
            { key: 'history', label: 'Historique', icon: History },
          ].map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              id={`tab-${tab.key}`}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                activeTab === tab.key
                  ? 'border-[#AF52DE] text-[#AF52DE]'
                  : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'params' && (
        <div role="tabpanel" id="panel-params" aria-labelledby="tab-params">
        <ProductParamsTab product={product} recipe={recipe} />
        </div>
      )}

      {activeTab === 'recipe' && (
        <div role="tabpanel" id="panel-recipe" aria-labelledby="tab-recipe"><ProductRecipeTab
          recipe={recipe}
          productUnit={product.unit}
          isAdmin={isAdmin}
          onEditRecipe={() => setIsEditingRecipe(true)}
          onAddComponent={() => setShowAddComponent(true)}
          onRemoveIngredient={handleRemoveIngredient}
        />
        </div>
      )}

      {activeTab === 'batch' && (
        <div role="tabpanel" id="panel-batch" aria-labelledby="tab-batch"><ProductBatchTab
          recipe={recipe}
          productUnit={product.unit}
          batchCount={batchCount}
          onBatchCountChange={setBatchCount}
          stockCheck={stockCheck}
          isCheckingStock={isCheckingStock}
          isCreatingOrder={isCreatingOrder}
          onCreateOrder={handleCreateOrder}
        />
        </div>
      )}

      {activeTab === 'history' && (
        <div role="tabpanel" id="panel-history" aria-labelledby="tab-history"><ProductHistoryTab
          productUnit={product.unit}
          historyData={historyData}
          historyLoading={historyLoading}
          filters={filters}
          onFiltersChange={setFilters}
          historyPage={page}
          onPageChange={setPage}
        />
        </div>
      )}

      {/* Edit Recipe Modal */}
      {isEditingRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsEditingRecipe(false)} />
          <div className="relative glass-card rounded-[20px] shadow-apple-elevated w-full max-w-lg p-6 animate-slide-up">
            <h2 className="text-lg font-semibold text-[#1D1D1F] mb-4">
              {recipe ? 'Modifier la recette' : 'Créer une recette'}
            </h2>

            {recipeError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-[14px] text-red-700 text-sm backdrop-blur-sm">
                {recipeError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Nom de la recette</label>
                <input
                  type="text"
                  value={recipeForm.name}
                  onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  placeholder={`Recette ${product.name}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Description</label>
                <textarea
                  value={recipeForm.description}
                  onChange={(e) => setRecipeForm({ ...recipeForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Poids batch (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={recipeForm.batchWeight / 1000}
                    onChange={(e) => setRecipeForm({ ...recipeForm, batchWeight: Math.round((parseFloat(e.target.value) || 0) * 1000) })}
                    className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Quantité sortie</label>
                  <input
                    type="number"
                    value={recipeForm.outputQuantity}
                    onChange={(e) => setRecipeForm({ ...recipeForm, outputQuantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Tolérance perte (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={(recipeForm.lossTolerance * 100).toFixed(1)}
                    onChange={(e) => setRecipeForm({ ...recipeForm, lossTolerance: (parseFloat(e.target.value) || 0) / 100 })}
                    className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1">DLC (jours)</label>
                  <input
                    type="number"
                    value={recipeForm.shelfLifeDays}
                    onChange={(e) => setRecipeForm({ ...recipeForm, shelfLifeDays: parseInt(e.target.value) || 90 })}
                    className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsEditingRecipe(false)}
                className="glass-btn px-5 py-2.5 rounded-full text-sm font-medium text-[#1D1D1F]"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveRecipe}
                disabled={isSavingRecipe || !recipeForm.name || !recipeForm.batchWeight}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#AF52DE] text-white rounded-full text-sm font-medium hover:bg-[#9B3DC8] disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {isSavingRecipe ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Component Modal (MP, FLUID, PACKAGING) */}
      {showAddComponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddComponent(false)} />
          <div className="relative glass-card rounded-[20px] shadow-apple-elevated w-full max-w-lg overflow-hidden animate-slide-up">
            <div className="border-b border-black/[0.04] px-6 py-4">
              <h2 className="text-lg font-semibold text-[#1D1D1F] flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#AF52DE] to-[#8B3CB5] rounded-[10px] flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                Ajouter un composant
              </h2>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-3">Type de composant</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { type: 'MP' as const, label: 'Matière Première', icon: '🧀', desc: 'Impact stock FIFO' },
                    { type: 'FLUID' as const, label: 'Eau / Fluide', icon: '💧', desc: 'Pas de stock' },
                    { type: 'PACKAGING' as const, label: 'Emballage', icon: '📦', desc: 'Stock obligatoire' },
                  ].map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => setComponentForm({ ...componentForm, type: opt.type, productMpId: 0, unit: opt.type === 'FLUID' ? 'L' : 'kg' })}
                      className={cn(
                        'p-4 border-2 rounded-[14px] text-center transition-all',
                        componentForm.type === opt.type
                          ? 'border-[#AF52DE] bg-[#AF52DE]/5'
                          : 'border-black/[0.04] hover:border-[#AF52DE]/30 bg-white/40'
                      )}
                    >
                      <div className="text-2xl mb-1">{opt.icon}</div>
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-[#86868B] mt-1">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {componentForm.type === 'MP' && (
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Matière première *</label>
                  <select
                    value={componentForm.productMpId}
                    onChange={(e) => {
                      const mpId = parseInt(e.target.value);
                      const mp = mpList.find((m) => m.id === mpId);
                      setComponentForm({ ...componentForm, productMpId: mpId, unit: mp?.unit || 'kg' });
                    }}
                    className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  >
                    <option value={0}>Sélectionner une matière première...</option>
                    {mpList.map((mp) => (
                      <option key={mp.id} value={mp.id}>{mp.code} - {mp.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {componentForm.type === 'FLUID' && (
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Nom du fluide *</label>
                  <select
                    value={componentForm.name}
                    onChange={(e) => setComponentForm({ ...componentForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  >
                    <option value="Eau">Eau</option>
                    <option value="Vapeur">Vapeur</option>
                    <option value="Eau glacée">Eau glacée</option>
                    <option value="Saumure">Saumure</option>
                  </select>
                </div>
              )}

              {componentForm.type === 'PACKAGING' && (
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Emballage *</label>
                  <select
                    value={componentForm.productMpId}
                    onChange={(e) => {
                      const packId = parseInt(e.target.value);
                      const pack = packagingList.find((p) => p.id === packId);
                      setComponentForm({ ...componentForm, productMpId: packId, unit: pack?.unit || 'unité' });
                    }}
                    className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  >
                    <option value={0}>Sélectionner un emballage...</option>
                    {packagingList.map((pack) => (
                      <option key={pack.id} value={pack.id}>{pack.code} - {pack.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Quantité *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={componentForm.quantity}
                    onChange={(e) => setComponentForm({ ...componentForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Unité</label>
                  <select
                    value={componentForm.unit}
                    onChange={(e) => setComponentForm({ ...componentForm, unit: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="mL">mL</option>
                    <option value="unité">unité</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white/40 backdrop-blur-sm rounded-[14px] border border-black/[0.04]">
                <input
                  type="checkbox"
                  id="componentMandatory"
                  checked={componentForm.isMandatory}
                  onChange={(e) => setComponentForm({ ...componentForm, isMandatory: e.target.checked })}
                  className="w-5 h-5 rounded border-black/[0.08] text-[#AF52DE] focus:ring-[#AF52DE]/20"
                />
                <label htmlFor="componentMandatory" className="text-sm text-[#1D1D1F]">
                  <span className="font-medium">Composant obligatoire</span>
                  <span className="text-[#86868B] ml-1">— bloque la production si manquant</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Notes (optionnel)</label>
                <input
                  type="text"
                  value={componentForm.notes}
                  onChange={(e) => setComponentForm({ ...componentForm, notes: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-[14px] border border-black/[0.08] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] outline-none transition-all"
                  placeholder="Ex: Ajouter en fin de process"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-black/[0.04] flex justify-end gap-3">
              <button
                onClick={() => setShowAddComponent(false)}
                className="glass-btn px-5 py-2.5 rounded-full text-sm font-medium text-[#1D1D1F]"
              >
                Annuler
              </button>
              <button
                onClick={handleAddComponent}
                disabled={isAddingComponent}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#AF52DE] text-white rounded-full text-sm font-medium hover:bg-[#9B3DC8] disabled:opacity-50 transition-colors"
              >
                {isAddingComponent ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                    Ajout...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Ajouter le composant
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
