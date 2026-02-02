'use client';

import { cn } from '@/lib/utils';
import {
  BookOpen,
  Plus,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { type Recipe, type RecipeStatus, getRecipeStatus, getStatusBadge } from './recettes-types';

// ═══════════════════════════════════════════════════════════════════════════════
// RecipeCard (individual item in the list)
// ═══════════════════════════════════════════════════════════════════════════════

const iconMap = {
  XCircle,
  AlertTriangle,
  CheckCircle,
} as const;

function RecipeCard({ recipe, status, onClick }: { recipe: Recipe; status: RecipeStatus; onClick: () => void }) {
  const badge = getStatusBadge(status);
  const BadgeIcon = iconMap[badge.icon];

  return (
    <div
      onClick={onClick}
      className="glass-card-hover p-4 cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[14px] bg-gradient-to-b from-[#AF52DE]/10 to-[#AF52DE]/5 flex items-center justify-center">
            <BookOpen className={cn("w-6 h-6", status.isComplete ? "text-[#AF52DE]" : "text-[#AEAEB2]")} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#86868B]">{recipe.productPf?.code}</span>
              <span className={cn("glass-status-pill", badge.tint)}>
                {badge.text}
              </span>
            </div>
            <h3 className="font-semibold text-[#1D1D1F]">{recipe.name || recipe.productPf?.name}</h3>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="text-[#86868B]">Batch: {(recipe.batchWeight / 1000).toFixed(1)} kg</p>
            <p className="text-[#86868B]">{recipe.ingredients?.length || 0} MP</p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#D1D1D6] group-hover:text-[#AF52DE] transition-colors" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RecipesTable (list view)
// ═══════════════════════════════════════════════════════════════════════════════

interface RecipesTableProps {
  recipes: Recipe[];
  stockMap: Map<number, number>;
  canEdit: boolean;
  onSelectRecipe: (recipe: Recipe) => void;
  onCreateRecipe: () => void;
}

export function RecipesTable({
  recipes,
  stockMap,
  canEdit,
  onSelectRecipe,
  onCreateRecipe,
}: RecipesTableProps) {
  if (recipes.length === 0) {
    return (
      <div className="glass-card p-12 text-center animate-slide-up">
        <BookOpen className="w-16 h-16 text-[#E5E5E5] mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-[#1D1D1F] mb-2">
          Aucune recette configur\u00e9e
        </h3>
        <p className="text-[#86868B] mb-6 max-w-md mx-auto">
          Les recettes d\u00e9finissent les ingr\u00e9dients (MP) n\u00e9cessaires pour produire chaque produit fini (PF).
          Commencez par cr\u00e9er votre premi\u00e8re recette.
        </p>
        {canEdit && (
          <button
            onClick={onCreateRecipe}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-[#333336] transition-all font-medium text-[13px]"
          >
            <Plus className="w-4 h-4" />
            Cr\u00e9er une recette
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          status={getRecipeStatus(recipe, stockMap)}
          onClick={() => onSelectRecipe(recipe)}
        />
      ))}
    </div>
  );
}
