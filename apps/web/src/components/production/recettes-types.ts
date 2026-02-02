// ═══════════════════════════════════════════════════════════════════════════════
// Recettes Types — shared across recipe sub-components
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProductPf {
  id: number;
  code: string;
  name: string;
  unit: string;
}

export interface StockMp {
  productId: number;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
}

export interface RecipeIngredient {
  id: number;
  productMpId: number;
  productMp: { id: number; code: string; name: string; unit: string };
  quantity: number;
}

export interface Recipe {
  id: number;
  name: string;
  description?: string;
  batchWeight: number;
  yieldPercent?: number;
  outputUnit?: string;
  outputQuantity?: number;
  productPfId: number;
  productPf: { id: number; code: string; name: string; unit: string };
  ingredients: RecipeIngredient[];
  items?: RecipeIngredient[];
}

export interface RecipeStatus {
  isComplete: boolean;
  hasPf: boolean;
  hasIngredients: boolean;
  hasBatch: boolean;
  hasYield: boolean;
  hasOutput: boolean;
  stockSufficient: boolean;
  maxBatches: number;
}

export interface NewRecipeForm {
  productPfId: number;
  name: string;
  batchWeight: number;
  outputQuantity: number;
}

export interface NewIngredientForm {
  productMpId: number;
  quantity: number;
  unit: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function getRecipeStatus(recipe: Recipe, stockMap: Map<number, number>): RecipeStatus {
  const hasPf = !!recipe.productPfId;
  const ingredients = recipe.ingredients || [];
  const hasIngredients = ingredients.length > 0;
  const hasBatch = recipe.batchWeight > 0;
  const hasYield = (recipe.yieldPercent || 0) > 0;
  const hasOutput = !!(recipe.outputUnit && recipe.outputQuantity);

  let maxBatches = Infinity;
  if (hasIngredients) {
    for (const ing of ingredients) {
      const stockQty = stockMap.get(ing.productMpId) || 0;
      const batchesForIng = ing.quantity > 0 ? Math.floor(stockQty / ing.quantity) : 0;
      maxBatches = Math.min(maxBatches, batchesForIng);
    }
  }
  if (maxBatches === Infinity) maxBatches = 0;

  const stockSufficient = maxBatches > 0;
  const isComplete = hasPf && hasIngredients && hasBatch;

  return { isComplete, hasPf, hasIngredients, hasBatch, hasYield, hasOutput, stockSufficient, maxBatches };
}

export function getStatusBadge(status: RecipeStatus) {
  if (!status.isComplete) {
    return { tint: 'glass-tint-red', icon: 'XCircle' as const, text: 'Incompl\u00e8te' };
  }
  if (!status.stockSufficient) {
    return { tint: 'glass-tint-orange', icon: 'AlertTriangle' as const, text: 'Stock insuffisant' };
  }
  return { tint: 'glass-tint-emerald', icon: 'CheckCircle' as const, text: 'Pr\u00eate \u00e0 produire' };
}
