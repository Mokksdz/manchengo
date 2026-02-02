'use client';

import { authFetch } from '@/lib/api';
import { useAdminStockPf } from '@/hooks/use-api';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  Box, AlertTriangle, History,
  Package, TrendingUp, ShoppingCart,
  X, Check, AlertCircle, Eye,
  ArrowDownCircle, ArrowUpCircle,
  RefreshCw, Search, Filter
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface StockPfItem {
  productId: number;
  id?: number;
  code: string;
  name: string;
  unit: string;
  priceHt: number;
  currentStock: number;
  stockValue?: number;
  minStock: number;
  status: 'OK' | 'ALERTE' | 'RUPTURE';
  lastMovementAt?: string;
}

interface Movement {
  id: number;
  movementType: 'IN' | 'OUT';
  origin: string;
  quantity: number;
  unitCost?: number;
  reference?: string;
  note?: string;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

type StockStatus = 'OK' | 'ALERTE' | 'RUPTURE';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function StatusDot({ status }: { status: StockStatus }) {
  const dotColor = {
    OK: 'bg-[#34C759]',
    ALERTE: 'bg-[#FF9500]',
    RUPTURE: 'bg-[#FF3B30]',
  };
  const labels = { OK: 'OK', ALERTE: 'Alerte', RUPTURE: 'Rupture' };
  const textColor = {
    OK: 'text-[#34C759]',
    ALERTE: 'text-[#FF9500]',
    RUPTURE: 'text-[#FF3B30]',
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full', dotColor[status])} />
      <span className={cn('text-[12px] font-medium', textColor[status])}>{labels[status]}</span>
    </span>
  );
}

function formatPrice(centimes: number): string {
  return (centimes / 100).toLocaleString('fr-DZ', { minimumFractionDigits: 2 }) + ' DA';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL INVENTAIRE PF (ADMIN ONLY)
// ═══════════════════════════════════════════════════════════════════════════════

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: StockPfItem | null;
}

function InventoryModal({ isOpen, onClose, onSuccess, product }: InventoryModalProps) {
  const [physicalQuantity, setPhysicalQuantity] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theoreticalStock = product?.currentStock ?? 0;
  const difference = physicalQuantity - theoreticalStock;

  useEffect(() => {
    if (isOpen && product) {
      setPhysicalQuantity(theoreticalStock);
      setReason('');
      setError(null);
    }
  }, [isOpen, product, theoreticalStock]);

  const canSubmit = reason.trim().length > 0 && physicalQuantity >= 0 && difference !== 0;

  const handleSubmit = async () => {
    if (!canSubmit || !product) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await authFetch('/stock/pf/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.productId || product.id,
          physicalQuantity,
          reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur lors de l\'ajustement');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Erreur inconnue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative glass-card w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.04]">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1D1D1F]">Inventaire Stock PF</h2>
            <p className="text-[13px] text-[#86868B] mt-0.5">Action audit&eacute;e — ADMIN</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/40 transition-colors text-[#86868B] hover:text-[#1D1D1F]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="glass-card p-3 flex items-start gap-2 border-[#FF3B30]/20">
              <AlertCircle className="w-4 h-4 text-[#FF3B30] flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-[#FF3B30]">{error}</p>
            </div>
          )}

          <div className="bg-black/[0.03] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-white/80 to-white/40 rounded-xl flex items-center justify-center shadow-sm">
                <Box className="w-5 h-5 text-[#86868B]" />
              </div>
              <div>
                <p className="font-medium text-[#1D1D1F]">{product.name}</p>
                <p className="text-[12px] text-[#86868B]">{product.code} · {product.unit}</p>
              </div>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#86868B]">Stock th&eacute;orique :</span>
              <span className="font-semibold text-[#1D1D1F]">{theoreticalStock.toLocaleString()} {product.unit}</span>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">
              Stock physique compt&eacute; <span className="text-[#FF3B30]">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={physicalQuantity}
              onChange={(e) => setPhysicalQuantity(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#007AFF]/15 focus:border-[#007AFF] text-[17px] font-semibold transition-all"
            />
          </div>

          {difference !== 0 && (
            <div className="bg-black/[0.03] rounded-xl p-4 text-center">
              <p className={cn(
                "text-[22px] font-bold",
                difference > 0 ? "text-[#34C759]" : "text-[#FF3B30]"
              )}>
                {difference > 0 ? '+' : ''}{difference} {product.unit}
              </p>
              <p className="text-[12px] text-[#86868B] mt-1">
                {difference > 0 ? 'Ajustement IN (surplus)' : 'Ajustement OUT (manquant)'}
              </p>
            </div>
          )}

          {difference === 0 && (
            <div className="bg-black/[0.03] rounded-xl p-4 text-center">
              <div className="w-8 h-8 bg-gradient-to-br from-white/80 to-white/40 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                <Check className="w-4 h-4 text-[#34C759]" />
              </div>
              <p className="text-[13px] text-[#86868B]">Stock conforme — aucun ajustement n&eacute;cessaire</p>
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">
              Motif de l&apos;ajustement <span className="text-[#FF3B30]">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Inventaire physique mensuel..."
              rows={2}
              className="w-full px-3 py-2.5 border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-[#007AFF]/15 focus:border-[#007AFF] text-[13px] transition-all"
            />
          </div>

          {/* Audit note */}
          <div className="glass-card p-3 flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500] mt-1.5 flex-shrink-0" />
            <p className="text-[12px] text-[#86868B]">
              Cette action est <strong className="text-[#1D1D1F]">audit&eacute;e</strong> et cr&eacute;era un mouvement de stock tra&ccedil;able.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-black/[0.04]">
          <button onClick={onClose} className="px-4 py-2.5 text-[13px] font-medium text-[#1D1D1F] glass-card rounded-[14px] hover:bg-white/60 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting || difference === 0}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all",
              canSubmit && !isSubmitting && difference !== 0
                ? "bg-[#1D1D1F] text-white hover:bg-[#333336] shadow-lg shadow-black/10"
                : "bg-black/[0.03] text-[#C7C7CC] cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enregistrement...</>
            ) : (
              <><Check className="w-4 h-4" /> Confirmer</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL HISTORIQUE PF
// ═══════════════════════════════════════════════════════════════════════════════

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: StockPfItem | null;
}

const ORIGIN_LABELS: Record<string, string> = {
  RECEPTION: 'R\u00e9ception',
  PRODUCTION_OUT: 'Production',
  PRODUCTION_IN: 'Production',
  VENTE: 'Vente',
  INVENTAIRE: 'Inventaire',
  PERTE: 'Perte',
  RETOUR_CLIENT: 'Retour',
};

function HistoryModal({ isOpen, onClose, product }: HistoryModalProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  useEffect(() => {
    if (isOpen && product) {
      loadMovements();
    }
  }, [isOpen, product]);

  const loadMovements = async () => {
    if (!product) return;
    setIsLoading(true);
    try {
      const res = await authFetch(
        `/stock/pf/${product.productId || product.id}/movements?limit=100`,
      );
      if (res.ok) {
        setMovements(await res.json());
      }
    } catch (error) {
      console.error('Failed to load movements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMovements = movements.filter(m => filter === 'ALL' || m.movementType === filter);

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative glass-card w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.04]">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1D1D1F]">Historique Mouvements</h2>
            <p className="text-[13px] text-[#86868B] mt-0.5">{product.name} ({product.code})</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/40 transition-colors text-[#86868B] hover:text-[#1D1D1F]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-black/[0.04] flex items-center gap-4">
          <Filter className="w-4 h-4 text-[#C7C7CC]" />
          <div className="flex gap-1.5">
            {(['ALL', 'IN', 'OUT'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 text-[12px] font-medium rounded-full transition-all",
                  filter === f ? "bg-[#1D1D1F] text-white shadow-sm" : "glass-pill text-[#86868B] hover:bg-white/60"
                )}
              >
                {f === 'ALL' ? 'Tous' : f === 'IN' ? '\u2193 Entr\u00e9es' : '\u2191 Sorties'}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-[#86868B] ml-auto">{filteredMovements.length} mouvement(s)</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-[3px] border-[#E5E5EA] border-t-[#1D1D1F] rounded-full animate-spin" />
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48">
              <div className="w-12 h-12 bg-black/[0.03] rounded-full flex items-center justify-center mb-3">
                <History className="w-6 h-6 text-[#C7C7CC]" />
              </div>
              <p className="text-[14px] text-[#86868B]">Aucun mouvement trouv&eacute;</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 backdrop-blur-xl bg-white/60 border-b border-black/[0.04]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[#86868B] uppercase">Date</th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-medium text-[#86868B] uppercase">Type</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[#86868B] uppercase">Origine</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-medium text-[#86868B] uppercase">Quantit&eacute;</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[#86868B] uppercase">R&eacute;f&eacute;rence</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[#86868B] uppercase">Utilisateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {filteredMovements.map((m) => {
                  const originLabel = ORIGIN_LABELS[m.origin] || m.origin;
                  return (
                    <tr key={m.id} className="hover:bg-white/40 transition-colors">
                      <td className="px-4 py-3 text-[13px] text-[#86868B]">
                        {new Date(m.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.movementType === 'IN' ? (
                          <span className="inline-flex items-center gap-1 text-[#34C759]">
                            <ArrowDownCircle className="w-4 h-4" /><span className="text-[11px] font-medium">IN</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#FF3B30]">
                            <ArrowUpCircle className="w-4 h-4" /><span className="text-[11px] font-medium">OUT</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="glass-pill px-2 py-0.5 text-[11px] font-medium text-[#86868B]">{originLabel}</span>
                      </td>
                      <td className={cn("px-4 py-3 text-[13px] text-right font-semibold", m.movementType === 'IN' ? "text-[#34C759]" : "text-[#FF3B30]")}>
                        {m.movementType === 'IN' ? '+' : '-'}{m.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#86868B] font-mono">{m.reference || '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-[#86868B]">{m.user.firstName} {m.user.lastName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-black/[0.04] flex justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-[13px] font-medium text-[#1D1D1F] glass-card rounded-[14px] hover:bg-white/60 transition-colors">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

export default function StockPfPage() {
  const { user } = useAuth();
  const { data: stockPfData = [], isLoading, refetch } = useAdminStockPf();
  const stockPf = stockPfData as StockPfItem[];
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockPfItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OK' | 'ALERTE' | 'RUPTURE'>('ALL');

  const canSeeFinancials = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL';

  const stats = useMemo(() => {
    const disponible = stockPf.filter((item: StockPfItem) => item.status !== 'RUPTURE').length;
    const rupture = stockPf.filter((item: StockPfItem) => item.status === 'RUPTURE').length;
    const valeur = stockPf.reduce((sum: number, item: StockPfItem) => sum + (item.stockValue ?? 0), 0);
    return { total: stockPf.length, disponible, rupture, valeur };
  }, [stockPf]);

  const handleSuccess = () => {
    refetch();
  };

  return (
    <div className="glass-bg space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">
            Produits Finis
          </h1>
          <p className="text-[13px] text-[#86868B] mt-1">
            Fromages, beurre, cr&egrave;me — pr&ecirc;ts &agrave; la vente
            {stats.rupture > 0 && (
              <span className="ml-2 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-pulse" />
                <span className="text-[#FF3B30] font-medium">{stats.rupture} rupture(s)</span>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2.5 rounded-[14px] glass-card hover:bg-white/60 transition-all text-[#86868B] hover:text-[#1D1D1F]"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Modals */}
      <InventoryModal
        isOpen={showInventoryModal}
        onClose={() => { setShowInventoryModal(false); setSelectedProduct(null); }}
        onSuccess={handleSuccess}
        product={selectedProduct}
      />
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => { setShowHistoryModal(false); setSelectedProduct(null); }}
        product={selectedProduct}
      />

      {/* ─── KPI Strip ─── */}
      <div className={cn("grid gap-4", canSeeFinancials ? "grid-cols-4" : "grid-cols-3")}>
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#86868B] uppercase tracking-wide">Total produits</p>
              <p className="text-[28px] font-bold text-[#1D1D1F] mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-[#007AFF]/10 to-[#5856D6]/10 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-[#007AFF]" />
            </div>
          </div>
        </div>
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#86868B] uppercase tracking-wide">Disponibles</p>
              <p className="text-[28px] font-bold text-[#1D1D1F] mt-1">{stats.disponible}</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-[#34C759]/10 to-[#30D158]/10 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-[#34C759]" />
            </div>
          </div>
        </div>
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#86868B] uppercase tracking-wide">En rupture</p>
              <p className="text-[28px] font-bold text-[#1D1D1F] mt-1">{stats.rupture}</p>
            </div>
            <div className="flex items-center gap-2">
              {stats.rupture > 0 && <span className="w-2 h-2 rounded-full bg-[#FF3B30]" />}
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF3B30]/10 to-[#FF9500]/10 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#FF3B30]" />
              </div>
            </div>
          </div>
        </div>
        {canSeeFinancials && (
          <div className="glass-card-hover p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-[#86868B] uppercase tracking-wide">Valeur stock</p>
                <p className="text-[22px] font-bold text-[#1D1D1F] mt-1">{formatPrice(stats.valeur)}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF9500]/10 to-[#FFCC00]/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#FF9500]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Info Note ─── */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#34C759] mt-2 flex-shrink-0" />
          <p className="text-[13px] text-[#86868B] leading-relaxed">
            Les produits finis <span className="text-[#1D1D1F] font-medium">entrent uniquement via Production</span> et
            <span className="text-[#1D1D1F] font-medium"> sortent via les ventes</span>. Pas d&apos;entr&eacute;e/sortie manuelle.
          </p>
        </div>
      </div>

      {/* ─── Stock Table ─── */}
      {isLoading ? (
        <div className="glass-card flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-[#E5E5EA] border-t-[#1D1D1F] rounded-full animate-spin" />
            <p className="text-[12px] text-[#86868B]">Chargement...</p>
          </div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Search & Filter */}
          <div className="px-5 py-3 border-b border-black/[0.04] flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C7C7CC]" />
              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[13px] border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/15 focus:border-[#007AFF] placeholder:text-[#C7C7CC] transition-all"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {(['ALL', 'OK', 'ALERTE', 'RUPTURE'] as const).map((s) => {
                const labels: Record<string, string> = { ALL: 'Tous', OK: 'OK', ALERTE: 'Alerte', RUPTURE: 'Rupture' };
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-3 py-1.5 text-[12px] font-medium rounded-full transition-all',
                      statusFilter === s
                        ? 'bg-[#1D1D1F] text-white shadow-sm'
                        : 'glass-pill text-[#86868B] hover:bg-white/60'
                    )}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
          </div>
          <table className="w-full">
            <thead className="border-b border-black/[0.04]">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Code</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Produit</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Unit&eacute;</th>
                {canSeeFinancials && (
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Prix HT</th>
                )}
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Stock</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Seuil</th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">&Eacute;tat</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {stockPf.filter((item) => {
                const matchesSearch = !searchQuery ||
                  item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.code.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
                return matchesSearch && matchesStatus;
              }).map((item) => {
                const stock = item.currentStock;
                const status = item.status;
                return (
                  <tr key={item.productId || item.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-5 py-4 text-[13px] font-mono text-[#86868B]">{item.code}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-black/[0.03] to-black/[0.06] rounded-xl flex items-center justify-center">
                          <Box className="w-4 h-4 text-[#86868B]" />
                        </div>
                        <span className="font-medium text-[14px] text-[#1D1D1F]">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-[#86868B]">{item.unit}</td>
                    {canSeeFinancials && (
                      <td className="px-5 py-4 text-[13px] text-right font-medium text-[#1D1D1F]">
                        {formatPrice(item.priceHt)}
                      </td>
                    )}
                    <td className="px-5 py-4 text-[13px] text-right font-bold text-[#1D1D1F]">
                      {stock.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-[13px] text-right text-[#86868B]">
                      {item.minStock.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusDot status={status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setSelectedProduct(item); setShowHistoryModal(true); }}
                          className="p-2 text-[#C7C7CC] hover:text-[#1D1D1F] hover:bg-white/40 rounded-lg transition-colors"
                          title="Voir l'historique"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedProduct(item); setShowInventoryModal(true); }}
                          className="p-2 text-[#C7C7CC] hover:text-[#1D1D1F] hover:bg-white/40 rounded-lg transition-colors"
                          title="Ajustement inventaire (ADMIN)"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {stockPf.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-black/[0.03] rounded-full flex items-center justify-center mx-auto mb-3">
                      <Box className="w-6 h-6 text-[#C7C7CC]" />
                    </div>
                    <p className="font-medium text-[#86868B] text-[14px]">Aucun produit fini trouv&eacute;</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
