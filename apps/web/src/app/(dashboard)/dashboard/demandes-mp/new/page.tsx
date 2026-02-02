'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { authFetch } from '@/lib/api';
import { ShoppingCart, Plus, Trash2, ArrowLeft, Send, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton-loader';

interface ProductMp {
  id: number;
  code: string;
  name: string;
  unit: string;
}

interface LigneForm {
  productMpId: number;
  quantiteDemandee: number;
  commentaire: string;
}

export default function NewDemandeMpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductMp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [priority, setPriority] = useState<'NORMALE' | 'URGENTE' | 'CRITIQUE'>('NORMALE');
  const [commentaire, setCommentaire] = useState('');
  const [lignes, setLignes] = useState<LigneForm[]>([]);

  // Pre-select product from query param
  const mpIdParam = searchParams.get('mpId');

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    // Pre-add line if mpId is provided
    if (mpIdParam && products.length > 0 && lignes.length === 0) {
      const mpId = parseInt(mpIdParam);
      if (!isNaN(mpId)) {
        setLignes([{ productMpId: mpId, quantiteDemandee: 0, commentaire: '' }]);
      }
    }
  }, [mpIdParam, products]);

  const loadProducts = async () => {
    try {
      const res = await authFetch('/stock/mp', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProducts(data.map((p: any) => ({
          id: p.productId,
          code: p.code,
          name: p.name,
          unit: p.unit
        })));
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addLine = () => {
    setLignes([...lignes, { productMpId: 0, quantiteDemandee: 0, commentaire: '' }]);
  };

  const removeLine = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateLine = (index: number, field: keyof LigneForm, value: any) => {
    const updated = [...lignes];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[index] as any)[field] = value;
    setLignes(updated);
  };

  const handleSubmit = async (sendImmediately: boolean) => {
    if (lignes.length === 0 || lignes.some(l => !l.productMpId || l.quantiteDemandee <= 0)) {
      toast.error('Veuillez ajouter au moins une ligne avec un produit et une quantité');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authFetch('/demandes-mp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priority, commentaire, lignes }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erreur création');
      }

      const demande = await res.json();

      if (sendImmediately) {
        await authFetch(`/demandes-mp/${demande.id}/envoyer`, {
          method: 'POST',
          credentials: 'include',
        });
      }

      router.push('/dashboard/demandes-mp');
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
        {/* Skeleton header */}
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
        </div>
        {/* Skeleton form */}
        <div className="glass-card p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <Skeleton className="h-4 w-32" />
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </div>
        {/* Skeleton actions */}
        <div className="flex justify-end gap-3">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-44 rounded-full" />
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-black/5 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#86868B]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-xl flex items-center justify-center shadow-lg shadow-[#007AFF]/20">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1D1D1F]">Nouvelle demande MP</h1>
            <p className="text-[#86868B]">Demander des matières premières au stock</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="glass-card p-6 space-y-6">
        {/* Priorité et commentaire */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Priorité</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'NORMALE' | 'URGENTE' | 'CRITIQUE')}
              className="w-full px-3 py-2 text-sm rounded-xl bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
            >
              <option value="NORMALE">Normale</option>
              <option value="URGENTE">Urgente</option>
              <option value="CRITIQUE">Critique (Rupture)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1D1D1F] mb-1">Commentaire</label>
            <input
              type="text"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Motif, production planifiée..."
              className="w-full px-3 py-2 text-sm rounded-xl bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] placeholder:text-[#86868B]"
            />
          </div>
        </div>

        {/* Lignes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-[#1D1D1F]">Matières premières</label>
            <button
              onClick={addLine}
              className="text-sm text-[#007AFF] hover:text-[#0056D6] flex items-center gap-1 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter une ligne
            </button>
          </div>

          {lignes.length === 0 ? (
            <div className="text-center py-8 text-[#86868B] border-2 border-dashed border-black/[0.06] rounded-xl bg-black/[0.02]">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Aucune ligne ajoutée</p>
              <button
                onClick={addLine}
                className="mt-2 text-[#007AFF] hover:text-[#0056D6] text-sm font-medium transition-colors"
              >
                Ajouter une matière première
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {lignes.map((ligne, index) => {
                const selectedProduct = products.find(p => p.id === ligne.productMpId);
                return (
                  <div key={index} className="flex gap-3 items-start p-3 bg-black/[0.02] rounded-xl">
                    <div className="flex-1">
                      <select
                        value={ligne.productMpId}
                        onChange={(e) => updateLine(index, 'productMpId', parseInt(e.target.value))}
                        className="w-full px-3 py-2 text-sm rounded-xl bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                      >
                        <option value={0}>-- Sélectionner un produit --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={ligne.quantiteDemandee || ''}
                          onChange={(e) => updateLine(index, 'quantiteDemandee', parseFloat(e.target.value) || 0)}
                          placeholder="Qté"
                          className="w-full px-3 py-2 pr-10 text-sm rounded-xl bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                        />
                        {selectedProduct && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#AEAEB2]">
                            {selectedProduct.unit}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={ligne.commentaire}
                        onChange={(e) => updateLine(index, 'commentaire', e.target.value)}
                        placeholder="Commentaire..."
                        className="w-full px-3 py-2 text-sm rounded-xl bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] placeholder:text-[#86868B]"
                      />
                    </div>
                    <button
                      onClick={() => removeLine(index)}
                      className="p-2 text-[#FF3B30] hover:bg-[#FF3B30]/5 rounded-full transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium"
        >
          Annuler
        </button>
        <button
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting || lignes.length === 0}
          className={cn(
            'px-5 py-2.5 rounded-full flex items-center gap-2 transition-all font-medium',
            isSubmitting || lignes.length === 0
              ? 'bg-black/5 text-[#AEAEB2] cursor-not-allowed'
              : 'text-[#86868B] bg-black/5 hover:bg-black/10'
          )}
        >
          <Save className="w-4 h-4" />
          Enregistrer (brouillon)
        </button>
        <button
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting || lignes.length === 0}
          className={cn(
            'px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-semibold transition-all active:scale-[0.97]',
            isSubmitting || lignes.length === 0
              ? 'bg-[#007AFF]/50 text-white/70 cursor-not-allowed'
              : 'bg-[#007AFF] text-white hover:bg-[#0056D6] shadow-lg shadow-[#007AFF]/25'
          )}
        >
          <Send className="w-4 h-4" />
          Créer et envoyer
        </button>
      </div>
    </div>
  );
}
