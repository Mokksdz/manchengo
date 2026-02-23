'use client';

import { Pencil, Plus, Trash2, AlertTriangle } from 'lucide-react';

interface ProductMp {
  id: number;
  code: string;
  name: string;
  unit: string;
}

interface RecipeItem {
  id: number;
  productMp: ProductMp | null;
  name: string | null;
  quantity: number;
  unit: string;
  isMandatory: boolean;
  notes: string | null;
}

interface Recipe {
  id: number;
  name: string;
  version: number;
  batchWeight: number;
  outputQuantity: number;
  lossTolerance: number;
  productionTime: number | null;
  description: string | null;
  items: RecipeItem[];
}

interface ProductRecipeTabProps {
  recipe: Recipe | null;
  productUnit: string;
  isAdmin: boolean;
  onEditRecipe: () => void;
  onAddComponent: () => void;
  onRemoveIngredient: (itemId: number) => void;
}

const formatWeight = (kg: number) => `${kg} kg`;

export function ProductRecipeTab({
  recipe, productUnit, isAdmin,
  onEditRecipe, onAddComponent, onRemoveIngredient
}: ProductRecipeTabProps) {
  return (
    <div className="space-y-6">
      {/* Recipe Header */}
      <div className="glass-card">
        <div className="p-6 border-b border-black/[0.04] flex items-center justify-between">
          <div>
            <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">
              {recipe ? recipe.name : 'Aucune recette définie'}
            </h2>
            {recipe && <p className="text-sm text-[#86868B]">Version {recipe.version}</p>}
          </div>
          {isAdmin && (
            <button onClick={onEditRecipe} className="inline-flex items-center gap-2 px-5 py-2 bg-[#AF52DE] text-white rounded-full hover:bg-[#AF52DE]/90 transition-colors">
              <Pencil className="w-4 h-4" />
              {recipe ? 'Modifier' : 'Créer recette'}
            </button>
          )}
        </div>

        {recipe && (
          <div className="p-6">
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#86868B]">Poids batch</span>
                <p className="font-semibold">{formatWeight(recipe.batchWeight)}</p>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#86868B]">Quantité sortie</span>
                <p className="font-semibold">{recipe.outputQuantity} {productUnit}</p>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#86868B]">Tolérance perte</span>
                <p className="font-semibold">{(recipe.lossTolerance * 100).toFixed(0)}%</p>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#86868B]">Durée production</span>
                <p className="font-semibold">{recipe.productionTime ? `${recipe.productionTime} min` : '-'}</p>
              </div>
            </div>
            {recipe.description && <p className="text-[#6E6E73] mb-6">{recipe.description}</p>}
          </div>
        )}
      </div>

      {/* Ingredients */}
      {recipe && (
        <div className="glass-card">
          <div className="p-4 border-b border-black/[0.04] flex items-center justify-between">
            <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Composants ({recipe.items.length})</h3>
            {isAdmin && (
              <button onClick={onAddComponent} className="inline-flex items-center gap-1 px-4 py-1.5 text-sm bg-[#34C759] text-white rounded-full hover:bg-[#34C759]/90 transition-colors">
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            )}
          </div>
          <table className="w-full">
            <thead className="bg-transparent">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Matière première</th>
                <th className="px-4 py-3 text-right text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Quantité</th>
                <th className="px-4 py-3 text-center text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Obligatoire</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Notes</th>
                {isAdmin && <th className="px-4 py-3 text-right text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {recipe.items.map((item) => (
                <tr key={item.id} className="hover:bg-white/40 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-[#86868B] mr-2">{item.productMp?.code}</span>
                    <span className="font-medium">{item.productMp?.name || item.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{item.quantity} {item.unit}</td>
                  <td className="px-4 py-3 text-center">
                    {item.isMandatory ? <span className="text-[#34C759]">✓</span> : <span className="text-[#AEAEB2]">-</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#86868B]">{item.notes || '-'}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => onRemoveIngredient(item.id)} className="p-1 text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-full transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {recipe.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#86868B]">
                    Aucun ingrédient. Ajoutez les matières premières nécessaires.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!recipe && (
        <div className="glass-card glass-tint-orange p-6 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-[#FF9500] mb-3" />
          <p className="text-[#FF9500]">
            Aucune recette définie pour ce produit. Créez une recette pour pouvoir lancer des productions.
          </p>
        </div>
      )}
    </div>
  );
}
