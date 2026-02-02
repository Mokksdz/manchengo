'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Zap, Package, ChevronRight, AlertTriangle, Check, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api';

interface ProductPf {
  id: number;
  code: string;
  name: string;
  unit: string;
  hasRecipe: boolean;
  recipeId: number | null;
  recipeItemsCount: number;
  recipeBatchWeight: number;
  recipeOutputQty: number;
  recipeShelfLife: number;
}

interface StockAvailability {
  productMpId: number;
  productMp: { code: string; name: string; unit: string };
  requiredQuantity: number;
  availableQuantity: number;
  isAvailable: boolean;
  shortage: number;
  isMandatory: boolean;
}

interface StockCheck {
  canProduce: boolean;
  targetOutput: number;
  availability: StockAvailability[];
}

interface ProductionWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductPf[];
  initialProduct?: ProductPf | null;
  onSuccess: () => void;
}

const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const formatWeight = (grams: number) => grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${grams} g`;

export function ProductionWizardModal({ isOpen, onClose, products, initialProduct, onSuccess }: ProductionWizardModalProps) {
  const router = useRouter();
  const [wizardStep, setWizardStep] = useState(initialProduct?.hasRecipe ? 2 : 1);
  const [wizardData, setWizardData] = useState<{ product: ProductPf | null; batchCount: number; stockCheck: StockCheck | null }>({
    product: initialProduct || null,
    batchCount: 1,
    stockCheck: null,
  });
  const [wizardError, setWizardError] = useState('');
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const selectProduct = (product: ProductPf) => {
    if (!product.hasRecipe) {
      setWizardError('Ce produit n\'a pas de recette configurée.');
      return;
    }
    setWizardData({ ...wizardData, product });
    setWizardError('');
    setWizardStep(2);
  };

  const checkStock = async () => {
    if (!wizardData.product?.recipeId) return;
    setIsCheckingStock(true);
    setWizardError('');
    try {
      const res = await authFetch(`/recipes/${wizardData.product.recipeId}/check-stock?batchCount=${wizardData.batchCount}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWizardData({ ...wizardData, stockCheck: data });
        setWizardStep(3);
      }
    } catch {
      setWizardError('Erreur vérification stock');
    } finally {
      setIsCheckingStock(false);
    }
  };

  const launchProduction = async () => {
    if (!wizardData.product || !wizardData.stockCheck?.canProduce) return;
    setIsCreatingOrder(true);
    try {
      const res = await authFetch('/production', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productPfId: wizardData.product.id, batchCount: wizardData.batchCount }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur');
      }
      const order = await res.json();
      onClose();
      onSuccess();
      router.push(`/dashboard/production/order/${order.id}`);
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative glass-card w-full max-w-2xl overflow-hidden shadow-apple-elevated">
        <div className="px-6 py-5 border-b border-black/[0.04]">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-[#1D1D1F] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#AF52DE]" />Nouvelle production
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/40 transition-colors text-[#86868B] hover:text-[#1D1D1F]" aria-label="Fermer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            {[{ num: 1, label: 'Produit' }, { num: 2, label: 'Quantité' }, { num: 3, label: 'Vérification' }, { num: 4, label: 'Lancement' }].map((step, i) => (
              <div key={step.num} className="flex items-center">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all', wizardStep >= step.num ? 'bg-[#AF52DE] text-white shadow-lg shadow-[#AF52DE]/20' : 'bg-black/[0.03] text-[#AEAEB2]')}>
                  {wizardStep > step.num ? <Check className="w-4 h-4" /> : step.num}
                </div>
                <span className={cn('ml-2 text-[13px] font-medium', wizardStep >= step.num ? 'text-[#1D1D1F]' : 'text-[#AEAEB2]')}>{step.label}</span>
                {i < 3 && <ChevronRight className="w-4 h-4 mx-2 text-black/[0.12]" />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {wizardError && (
            <div className="mb-4 p-3 glass-card glass-tint-red rounded-[14px] text-red-700 text-[13px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />{wizardError}
            </div>
          )}

          {/* Step 1: Select Product */}
          {wizardStep === 1 && (
            <div>
              <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-4">Choisir le produit</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {products.filter(p => p.hasRecipe).map((product) => (
                  <button key={product.id} onClick={() => selectProduct(product)} className="w-full p-4 glass-card glass-card-hover rounded-[14px] text-left hover:border-[#AF52DE]/20 flex items-center gap-4 transition-all">
                    <div className="w-12 h-12 bg-[#AF52DE]/10 rounded-[14px] flex items-center justify-center">
                      <Package className="w-6 h-6 text-[#AF52DE]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-[#1D1D1F]">{product.name}</p>
                      <p className="text-[13px] text-[#86868B]">{product.code} • {product.recipeItemsCount} ingrédients</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#AEAEB2]" />
                  </button>
                ))}
                {products.filter(p => p.hasRecipe).length === 0 && (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                    <p className="text-[#6E6E73]">Aucun produit avec recette</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Quantity */}
          {wizardStep === 2 && wizardData.product && (
            <div>
              <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-4">Définir la quantité</h3>
              <div className="glass-card glass-tint-blue rounded-[14px] p-4 mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#AF52DE]/10 rounded-[10px] flex items-center justify-center">
                  <Package className="w-5 h-5 text-[#AF52DE]" />
                </div>
                <div>
                  <p className="font-semibold text-[#1D1D1F]">{wizardData.product.name}</p>
                  <p className="text-[13px] text-[#86868B]">{wizardData.product.code}</p>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Nombre de batchs</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setWizardData({ ...wizardData, batchCount: Math.max(1, wizardData.batchCount - 1) })} className="w-12 h-12 rounded-[14px] border border-black/[0.06] text-2xl hover:bg-white/60 glass-card transition-colors">-</button>
                  <input type="number" min="1" max="100" value={wizardData.batchCount} onChange={(e) => setWizardData({ ...wizardData, batchCount: Math.max(1, parseInt(e.target.value) || 1) })} className="w-24 h-12 text-center text-2xl font-bold px-3 py-2.5 border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] transition-all" />
                  <button onClick={() => setWizardData({ ...wizardData, batchCount: wizardData.batchCount + 1 })} className="w-12 h-12 rounded-[14px] border border-black/[0.06] text-2xl hover:bg-white/60 glass-card transition-colors">+</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 bg-black/[0.03] rounded-[14px] p-4">
                <div className="text-center">
                  <p className="text-[13px] text-[#86868B] mb-1">Quantité</p>
                  <p className="text-2xl font-bold text-[#AF52DE]">{wizardData.product.recipeOutputQty * wizardData.batchCount}</p>
                  <p className="text-[13px] text-[#86868B]">{wizardData.product.unit}</p>
                </div>
                <div className="text-center">
                  <p className="text-[13px] text-[#86868B] mb-1">Poids</p>
                  <p className="text-2xl font-bold text-[#1D1D1F]">{formatWeight(wizardData.product.recipeBatchWeight * wizardData.batchCount)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[13px] text-[#86868B] mb-1">DLC</p>
                  <p className="text-2xl font-bold text-[#1D1D1F]">{formatDate(new Date(Date.now() + wizardData.product.recipeShelfLife * 86400000).toISOString())}</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Stock Check */}
          {wizardStep === 3 && wizardData.stockCheck && (
            <div>
              <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-4">Vérification du stock</h3>
              <div className={cn('glass-card rounded-[14px] p-4 mb-6 flex items-center gap-4', wizardData.stockCheck.canProduce ? 'glass-tint-emerald' : 'glass-tint-red')}>
                {wizardData.stockCheck.canProduce ? (
                  <>
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-700">Stock suffisant</p>
                      <p className="text-[13px] text-emerald-600">Production de {wizardData.stockCheck.targetOutput} {wizardData.product?.unit} possible</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                      <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-700">Stock insuffisant</p>
                      <p className="text-[13px] text-red-600">Réduisez la quantité ou approvisionnez</p>
                    </div>
                  </>
                )}
              </div>
              <div className="glass-card rounded-[14px] overflow-hidden">
                <table className="w-full">
                  <thead className="bg-black/[0.03]">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wide">Ingrédient</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wide">Requis</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wide">Dispo</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold text-[#86868B] uppercase tracking-wide">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {wizardData.stockCheck.availability.map((item) => (
                      <tr key={item.productMpId} className={!item.isAvailable && item.isMandatory ? 'bg-red-500/5' : ''}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[11px] text-[#AEAEB2] mr-2">{item.productMp.code}</span>
                          <span className="font-medium text-[13px] text-[#1D1D1F]">{item.productMp.name}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[13px]">{item.requiredQuantity}</td>
                        <td className="px-4 py-3 text-right text-[13px]">{item.availableQuantity}</td>
                        <td className="px-4 py-3 text-center">
                          {item.isAvailable ? (
                            <span className="glass-status-pill text-emerald-600 inline-flex items-center gap-1 text-[12px]"><CheckCircle className="w-3.5 h-3.5" />OK</span>
                          ) : (
                            <span className="glass-status-pill text-red-600 inline-flex items-center gap-1 text-[12px]"><XCircle className="w-3.5 h-3.5" />-{item.shortage}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {wizardStep === 4 && wizardData.product && wizardData.stockCheck?.canProduce && (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-[#AF52DE]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-[#AF52DE]" />
              </div>
              <h3 className="text-2xl font-bold text-[#1D1D1F] mb-2">Prêt à produire !</h3>
              <p className="text-[#86868B] text-[13px] mb-6">Confirmez le lancement</p>
              <div className="glass-card bg-black/[0.03] rounded-[14px] p-6 max-w-sm mx-auto text-left space-y-3">
                <div className="flex justify-between"><span className="text-[13px] text-[#86868B]">Produit</span><span className="font-semibold text-[13px] text-[#1D1D1F]">{wizardData.product.name}</span></div>
                <div className="flex justify-between"><span className="text-[13px] text-[#86868B]">Batchs</span><span className="font-semibold text-[13px] text-[#1D1D1F]">{wizardData.batchCount}</span></div>
                <div className="flex justify-between"><span className="text-[13px] text-[#86868B]">Quantité</span><span className="font-semibold text-[13px] text-[#AF52DE]">{wizardData.product.recipeOutputQty * wizardData.batchCount} {wizardData.product.unit}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-black/[0.04] flex justify-between">
          <button onClick={() => wizardStep > 1 ? setWizardStep(wizardStep - 1) : onClose()} className="px-4 py-2.5 text-[13px] font-medium text-[#1D1D1F] glass-card rounded-[14px] hover:bg-white/60 transition-colors">
            {wizardStep > 1 ? 'Retour' : 'Annuler'}
          </button>
          {wizardStep === 2 && (
            <button onClick={checkStock} disabled={isCheckingStock} className={cn('px-5 py-2.5 rounded-full text-[13px] font-medium shadow-lg shadow-black/10 transition-all flex items-center gap-2', isCheckingStock ? 'bg-black/[0.03] text-[#C7C7CC] cursor-not-allowed' : 'bg-[#1D1D1F] text-white hover:bg-[#333336]')}>
              {isCheckingStock ? 'Vérification...' : 'Vérifier le stock'}
            </button>
          )}
          {wizardStep === 3 && wizardData.stockCheck?.canProduce && (
            <button onClick={() => setWizardStep(4)} className="px-5 py-2.5 rounded-full text-[13px] font-medium bg-[#AF52DE] text-white hover:bg-[#9B3DC8] shadow-lg shadow-[#AF52DE]/20 transition-all">
              Continuer
            </button>
          )}
          {wizardStep === 4 && (
            <button onClick={launchProduction} disabled={isCreatingOrder} className={cn('px-5 py-2.5 rounded-full text-[13px] font-medium shadow-lg shadow-black/10 transition-all flex items-center gap-2', isCreatingOrder ? 'bg-black/[0.03] text-[#C7C7CC] cursor-not-allowed' : 'bg-[#1D1D1F] text-white hover:bg-[#333336]')}>
              <Zap className="w-4 h-4" />{isCreatingOrder ? 'Création...' : 'Lancer la production'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
