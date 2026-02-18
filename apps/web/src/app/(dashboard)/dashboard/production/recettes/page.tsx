'use client';

import { authFetch } from '@/lib/api';
import { toast } from 'sonner';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  BookOpen,
  Plus,
  ArrowLeft,
  Trash2,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
  Play,
  Beaker,
  Scale,
  Percent,
  Box,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  type Recipe,
  type StockMp,
  type ProductPf,
  type RecipeStatus,
  type NewRecipeForm,
  type NewIngredientForm,
  getRecipeStatus,
  getStatusBadge,
} from '@/components/production/recettes-types';
import { RecipesTable } from '@/components/production/RecipesTable';
import { CreateRecipeModal, AddIngredientModal } from '@/components/production/RecipeFormModal';

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL VIEW SUB-COMPONENTS (kept inline — small, tightly coupled to detail)
// ═══════════════════════════════════════════════════════════════════════════════

const iconMap = { XCircle, AlertTriangle, CheckCircle } as const;

function RecipeHeader({ recipe, status }: { recipe: Recipe; status: RecipeStatus }) {
  const badge = getStatusBadge(status);
  const BadgeIcon = iconMap[badge.icon];
  const batchKg = (recipe.batchWeight || 0) / 1000;
  const yieldPct = recipe.yieldPercent || 0;
  const outputKg = batchKg * (yieldPct / 100);
  const outputUnits = recipe.outputQuantity || Math.round(outputKg * 10);

  return (
    <div className="glass-card p-6 animate-slide-up">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[14px] bg-gradient-to-b from-[#AF52DE]/10 to-[#AF52DE]/5 flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-[#AF52DE]" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-[#86868B]">{recipe.productPf?.code || 'PF-???'}</span>
              <span className={cn("glass-status-pill flex items-center gap-1", badge.tint)}>
                <BadgeIcon className="w-3 h-3" />
                {badge.text}
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#1D1D1F] mt-1">
              {recipe.name || recipe.productPf?.name || 'Nouvelle recette'}
            </h1>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-black/[0.04]">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-[#86868B] text-sm mb-1"><Scale className="w-4 h-4" />Batch cible</div>
          <p className="text-2xl font-bold text-[#1D1D1F]">{batchKg.toFixed(1)} kg</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-[#86868B] text-sm mb-1"><Percent className="w-4 h-4" />Rendement</div>
          <p className="text-2xl font-bold text-[#1D1D1F]">{yieldPct} %</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-[#86868B] text-sm mb-1"><Beaker className="w-4 h-4" />Sortie estim\u00e9e</div>
          <p className="text-2xl font-bold text-[#1D1D1F]">&asymp; {outputKg.toFixed(1)} kg</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-[#86868B] text-sm mb-1"><Box className="w-4 h-4" />Unit\u00e9s</div>
          <p className="text-2xl font-bold text-[#1D1D1F]">&asymp; {outputUnits}</p>
        </div>
      </div>
    </div>
  );
}

function RecipeStatusCard({ status }: { status: RecipeStatus }) {
  const checks = [
    { label: 'Produit PF li\u00e9', ok: status.hasPf },
    { label: 'Ingr\u00e9dients configur\u00e9s', ok: status.hasIngredients },
    { label: 'Batch d\u00e9fini', ok: status.hasBatch },
    { label: 'Rendement d\u00e9fini', ok: status.hasYield },
    { label: 'Unit\u00e9 de sortie d\u00e9finie', ok: status.hasOutput },
  ];
  const completedCount = checks.filter(c => c.ok).length;

  return (
    <div className={cn("glass-decision-card p-5", status.isComplete ? "glass-tint-emerald" : "glass-tint-red")}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#1D1D1F] flex items-center gap-2">
          {status.isComplete ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          \u00c9tat de la recette
        </h3>
        <span className="text-sm text-[#86868B]">{completedCount}/{checks.length}</span>
      </div>
      <div className="space-y-2">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-3">
            {check.ok ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
            <span className={cn("text-sm", check.ok ? "text-[#1D1D1F]" : "text-red-700 font-medium")}>{check.label}</span>
          </div>
        ))}
      </div>
      {!status.isComplete && (
        <div className="mt-4 pt-4 border-t border-red-200/40">
          <p className="text-sm text-red-700 flex items-center gap-2"><Lock className="w-4 h-4" />Cette recette ne peut pas \u00eatre utilis\u00e9e en production</p>
        </div>
      )}
    </div>
  );
}

function RecipeIngredientsTable({
  recipe, stockMap, canEdit, onAddIngredient, onDeleteIngredient,
}: {
  recipe: Recipe; stockMap: Map<number, number>; canEdit: boolean;
  onAddIngredient?: () => void; onDeleteIngredient?: (itemId: number) => void;
}) {
  const ingredients = recipe.ingredients || [];
  const totalWeight = ingredients.reduce((sum, ing) => sum + ing.quantity, 0);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between">
        <h3 className="font-semibold text-[#1D1D1F] flex items-center gap-2"><Package className="w-5 h-5 text-[#AEAEB2]" />Ingr\u00e9dients (Mati\u00e8res Premi\u00e8res)</h3>
        {canEdit && (
          <button onClick={onAddIngredient} className="text-sm text-[#AF52DE] hover:text-[#9B30D1] flex items-center gap-1 transition-colors">
            <Plus className="w-4 h-4" />Ajouter un ingr\u00e9dient
          </button>
        )}
      </div>
      {ingredients.length === 0 ? (
        <div className="p-8 text-center">
          <Package className="w-10 h-10 text-[#D1D1D6] mx-auto mb-3" />
          <p className="text-[#86868B] mb-3">Aucun ingr\u00e9dient configur\u00e9</p>
          {canEdit && (
            <button onClick={onAddIngredient} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-[#333336] transition-all font-medium text-[13px]">
              <Plus className="w-4 h-4" />Ajouter le premier ingr\u00e9dient
            </button>
          )}
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/[0.04]">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Mati\u00e8re premi\u00e8re</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Qt\u00e9 / batch</th>
              <th className="px-5 py-3 text-center text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Unit\u00e9</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">% composition</th>
              <th className="px-5 py-3 text-center text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Stock</th>
              {canEdit && <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {ingredients.map((ing) => {
              const stockQty = stockMap.get(ing.productMpId) || 0;
              const pct = totalWeight > 0 ? ((ing.quantity / totalWeight) * 100).toFixed(1) : '0';
              const stockStatus = stockQty >= ing.quantity ? 'ok' : stockQty > 0 ? 'low' : 'out';
              return (
                <tr key={ing.id} className="hover:bg-white/40 transition-colors">
                  <td className="px-5 py-4"><div><p className="font-medium text-[#1D1D1F]">{ing.productMp?.name}</p><p className="text-xs text-[#86868B]">{ing.productMp?.code}</p></div></td>
                  <td className="px-5 py-4 text-right font-mono font-medium">{ing.quantity}</td>
                  <td className="px-5 py-4 text-center text-[#86868B]">{ing.productMp?.unit}</td>
                  <td className="px-5 py-4 text-right text-[#86868B]">{pct} %</td>
                  <td className="px-5 py-4 text-center">
                    <span className={cn("glass-status-pill", stockStatus === 'ok' && "glass-tint-emerald", stockStatus === 'low' && "glass-tint-orange", stockStatus === 'out' && "glass-tint-red")}>
                      {stockStatus === 'ok' && '\u2713 OK'}{stockStatus === 'low' && '\u26a0\ufe0f Bas'}{stockStatus === 'out' && '\u274c Rupture'}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => onDeleteIngredient?.(ing.id)} className="p-1 text-[#AEAEB2] hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RecipeStockImpact({ recipe, stockMap, status }: { recipe: Recipe; stockMap: Map<number, number>; status: RecipeStatus }) {
  const ingredients = recipe.ingredients || [];
  if (ingredients.length === 0) return null;

  return (
    <div className="glass-card p-5">
      <h3 className="font-semibold text-[#1D1D1F] mb-4 flex items-center gap-2"><ArrowRight className="w-5 h-5 text-[#AEAEB2]" />Impact stock &mdash; 1 batch</h3>
      <div className="space-y-2 mb-4">
        {ingredients.map((ing) => {
          const currentStock = stockMap.get(ing.productMpId) || 0;
          const afterStock = currentStock - ing.quantity;
          return (
            <div key={ing.id} className="flex items-center justify-between py-2 border-b border-black/[0.04] last:border-0">
              <div><span className="text-[#1D1D1F]">{ing.productMp?.name}</span><span className="text-xs text-[#AEAEB2] ml-2">(stock: {currentStock})</span></div>
              <span className={cn("font-mono font-medium", afterStock < 0 ? "text-red-600" : "text-orange-600")}>-{ing.quantity} {ing.productMp?.unit}</span>
            </div>
          );
        })}
      </div>
      <div className={cn("glass-decision-card p-3 text-center", status.maxBatches > 0 ? "glass-tint-emerald" : "glass-tint-red")}>
        {status.maxBatches > 0 ? (
          <p className="text-emerald-700 font-medium">&check; Stock suffisant pour {status.maxBatches} batch{status.maxBatches > 1 ? 's' : ''}</p>
        ) : (
          <p className="text-red-700 font-medium">&cross; Stock insuffisant pour produire</p>
        )}
      </div>
    </div>
  );
}

function RecipeCTA({ status, recipeId }: { status: RecipeStatus; recipeId: number }) {
  if (!status.isComplete) {
    return (
      <div className="glass-decision-card glass-tint-red p-6 text-center animate-slide-up">
        <Lock className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-red-900 mb-1">Production bloqu\u00e9e</h3>
        <p className="text-red-700">Compl\u00e9tez la recette pour lancer la production</p>
      </div>
    );
  }
  if (!status.stockSufficient) {
    return (
      <div className="glass-decision-card glass-tint-orange p-6 text-center animate-slide-up">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-amber-900 mb-1">Stock insuffisant</h3>
        <p className="text-amber-700 mb-4">R\u00e9approvisionnez les mati\u00e8res premi\u00e8res pour lancer la production</p>
        <Link href="/dashboard/appro/bons/new" className="glass-btn px-4 py-2 rounded-full text-[13px] text-[#6E6E73]">Cr\u00e9er un bon de commande</Link>
      </div>
    );
  }
  return (
    <div className="glass-decision-card glass-tint-emerald p-6 text-center animate-slide-up">
      <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-emerald-900 mb-1">Recette pr\u00eate</h3>
      <p className="text-emerald-700 mb-4">Tous les param\u00e8tres sont configur\u00e9s, le stock est suffisant</p>
      <Link href={`/dashboard/production?newOrder=true&recipeId=${recipeId}`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-[#333336] transition-all font-medium text-[13px]">
        <Play className="w-4 h-4" />Lancer un ordre de production
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

export default function RecettesPage() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stockMp, setStockMp] = useState<StockMp[]>([]);
  const [productsPf, setProductsPf] = useState<ProductPf[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);

  // Form state
  const [newRecipe, setNewRecipe] = useState<NewRecipeForm>({
    productPfId: 0,
    name: '',
    batchWeight: 10000,
    outputQuantity: 10,
  });

  const [newIngredient, setNewIngredient] = useState<NewIngredientForm>({
    productMpId: 0,
    quantity: 0,
    unit: 'kg',
  });

  const canEdit = user?.role === 'ADMIN' || user?.role === 'PRODUCTION';

  // Charger donnees
  const loadData = useCallback(async () => {
    try {
      const [recipesRes, stockRes, pfRes] = await Promise.all([
        authFetch('/recipes', { credentials: 'include' }),
        authFetch('/stock/mp', { credentials: 'include' }),
        authFetch('/products/pf', { credentials: 'include' }),
      ]);

      if (recipesRes.ok) {
        const data = await recipesRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalizedRecipes = (data || []).map((r: any) => ({
          ...r,
          ingredients: r.items || r.ingredients || [],
        }));
        setRecipes(normalizedRecipes);
      } else {
        toast.error('Erreur lors du chargement des recettes');
      }
      if (stockRes.ok) {
        const data = await stockRes.json();
        setStockMp(data || []);
      } else {
        toast.error('Erreur lors du chargement du stock MP');
      }
      if (pfRes.ok) {
        const data = await pfRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProductsPf((data || []).map((pf: any) => ({ ...pf, id: pf.id || pf.productId })));
      } else {
        toast.error('Erreur lors du chargement des produits finis');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Erreur de connexion au serveur');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => { setSelectedRecipe(null); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Creer une nouvelle recette
  const handleCreateRecipe = async () => {
    if (!newRecipe.productPfId || !newRecipe.name) {
      toast.error('Veuillez s\u00e9lectionner un produit PF et donner un nom \u00e0 la recette');
      return;
    }
    try {
      const res = await authFetch('/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...newRecipe, items: [] }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewRecipe({ productPfId: 0, name: '', batchWeight: 10000, outputQuantity: 10 });
        await loadData();
        toast.success('Recette cr\u00e9\u00e9e avec succ\u00e8s');
      } else {
        const error = await res.json();
        toast.error(`Erreur: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to create recipe:', error);
      toast.error('Erreur lors de la cr\u00e9ation');
    }
  };

  // Ajouter un ingredient
  const handleAddIngredient = async () => {
    if (!selectedRecipe || !newIngredient.productMpId || newIngredient.quantity <= 0) {
      toast.error('Veuillez s\u00e9lectionner une MP et une quantit\u00e9 valide');
      return;
    }
    try {
      const res = await authFetch(`/recipes/${selectedRecipe.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productMpId: newIngredient.productMpId,
          quantity: newIngredient.quantity,
          unit: newIngredient.unit,
          type: 'MP',
        }),
      });
      if (res.ok) {
        setShowIngredientModal(false);
        setNewIngredient({ productMpId: 0, quantity: 0, unit: 'kg' });
        await loadData();
        const updatedRecipe = await authFetch(`/recipes/${selectedRecipe.id}`, { credentials: 'include' });
        if (updatedRecipe.ok) {
          const data = await updatedRecipe.json();
          setSelectedRecipe({ ...data, ingredients: data.items || data.ingredients || [] });
        }
        toast.success('Ingr\u00e9dient ajout\u00e9');
      } else {
        const error = await res.json();
        toast.error(`Erreur: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to add ingredient:', error);
      toast.error('Erreur lors de l\'ajout');
    }
  };

  // Supprimer un ingredient
  const handleDeleteIngredient = async (itemId: number) => {
    if (!selectedRecipe || !confirm('Supprimer cet ingr\u00e9dient ?')) return;
    try {
      const res = await authFetch(`/recipes/${selectedRecipe.id}/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        await loadData();
        const updatedRecipe = await authFetch(`/recipes/${selectedRecipe.id}`, { credentials: 'include' });
        if (updatedRecipe.ok) {
          const data = await updatedRecipe.json();
          setSelectedRecipe({ ...data, ingredients: data.items || data.ingredients || [] });
        }
      }
    } catch (error) {
      console.error('Failed to delete ingredient:', error);
    }
  };

  // Map stock pour lookup rapide
  const stockMap = useMemo(() => {
    const map = new Map<number, number>();
    stockMp.forEach(s => map.set(s.productId, s.currentStock));
    return map;
  }, [stockMp]);

  // Status de la recette selectionnee
  const selectedStatus = useMemo(() => {
    if (!selectedRecipe) return null;
    return getRecipeStatus(selectedRecipe, stockMap);
  }, [selectedRecipe, stockMap]);

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div><Skeleton className="h-6 w-48 mb-2" /><Skeleton className="h-4 w-32" /></div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-12" /></div>
          ))}
        </div>
        <SkeletonTable rows={5} columns={4} />
      </div>
    );
  }

  // ─── Detail View ─────────────────────────────────────────────────────────
  if (selectedRecipe && selectedStatus) {
    return (
      <div className="glass-bg space-y-6">
        <PageHeader
          title={selectedRecipe.name || selectedRecipe.productPf?.name || 'Recette'}
          subtitle={selectedRecipe.productPf?.code || 'Fiche recette'}
          icon={<BookOpen className="w-5 h-5" />}
          badge={selectedStatus.isComplete && selectedStatus.stockSufficient
            ? { text: 'Prête', variant: 'success' }
            : selectedStatus.isComplete
              ? { text: 'Stock insuffisant', variant: 'warning' }
              : { text: 'Incomplète', variant: 'error' }}
          actions={(
            <Button
              onClick={() => { setSelectedRecipe(null); window.history.pushState({}, '', '/dashboard/production/recettes'); }}
              variant="outline"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour aux recettes
            </Button>
          )}
        />

        <RecipeHeader recipe={selectedRecipe} status={selectedStatus} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <RecipeStatusCard status={selectedStatus} />
            <RecipeStockImpact recipe={selectedRecipe} stockMap={stockMap} status={selectedStatus} />
          </div>
          <div className="lg:col-span-2">
            <RecipeIngredientsTable
              recipe={selectedRecipe}
              stockMap={stockMap}
              canEdit={canEdit}
              onAddIngredient={() => setShowIngredientModal(true)}
              onDeleteIngredient={handleDeleteIngredient}
            />
          </div>
        </div>

        <RecipeCTA status={selectedStatus} recipeId={selectedRecipe.id} />

        {/* Add Ingredient Modal (in detail view) */}
        <AddIngredientModal
          isOpen={showIngredientModal}
          onClose={() => setShowIngredientModal(false)}
          stockMp={stockMp}
          formData={newIngredient}
          onFormChange={setNewIngredient}
          onSubmit={handleAddIngredient}
        />
      </div>
    );
  }

  // ─── List View ───────────────────────────────────────────────────────────
  return (
    <div className="glass-bg space-y-6">
      <PageHeader
        title="Recettes de production"
        subtitle="Configurez les compositions pour produire vos fromages"
        icon={<BookOpen className="w-5 h-5" />}
        className="animate-slide-up"
        actions={canEdit ? (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            Nouvelle recette
          </Button>
        ) : undefined}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card-hover p-4 animate-slide-up">
          <p className="text-sm text-[#86868B]">Total recettes</p>
          <p className="text-2xl font-bold text-[#1D1D1F]">{recipes.length}</p>
        </div>
        <div className="glass-card-hover p-4 animate-slide-up">
          <p className="text-sm text-[#86868B]">Pr\u00eates</p>
          <p className="text-2xl font-bold text-[#AF52DE]">
            {recipes.filter(r => getRecipeStatus(r, stockMap).isComplete && getRecipeStatus(r, stockMap).stockSufficient).length}
          </p>
        </div>
        <div className="glass-card-hover p-4 animate-slide-up">
          <p className="text-sm text-[#86868B]">\u00c0 configurer</p>
          <p className="text-2xl font-bold text-red-600">
            {recipes.filter(r => !getRecipeStatus(r, stockMap).isComplete).length}
          </p>
        </div>
      </div>

      {/* Recipes List */}
      <RecipesTable
        recipes={recipes}
        stockMap={stockMap}
        canEdit={canEdit}
        onSelectRecipe={(recipe) => {
          setSelectedRecipe(recipe);
          window.history.pushState({ recipeId: recipe.id }, '', `?recipe=${recipe.id}`);
        }}
        onCreateRecipe={() => setShowCreateModal(true)}
      />

      {/* Create Recipe Modal */}
      <CreateRecipeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        productsPf={productsPf}
        formData={newRecipe}
        onFormChange={setNewRecipe}
        onSubmit={handleCreateRecipe}
      />

      {/* Add Ingredient Modal (in list view, for when selected) */}
      <AddIngredientModal
        isOpen={showIngredientModal && !!selectedRecipe}
        onClose={() => setShowIngredientModal(false)}
        stockMp={stockMp}
        formData={newIngredient}
        onFormChange={setNewIngredient}
        onSubmit={handleAddIngredient}
      />
    </div>
  );
}
