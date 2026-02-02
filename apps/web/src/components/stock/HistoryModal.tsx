'use client';

import { memo, useState, useEffect } from 'react';
import { X, History, Filter, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api';

export interface StockMpItem {
  productId: number;
  id?: number;
  code: string;
  name: string;
  unit: string;
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

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: StockMpItem | null;
}

const ORIGIN_LABELS: Record<string, { label: string; color: string }> = {
  RECEPTION: { label: 'Réception', color: 'bg-blue-100 text-blue-700' },
  PRODUCTION_OUT: { label: 'Production', color: 'bg-purple-100 text-purple-700' },
  PRODUCTION_IN: { label: 'Production', color: 'bg-purple-100 text-purple-700' },
  VENTE: { label: 'Vente', color: 'bg-green-100 text-green-700' },
  INVENTAIRE: { label: 'Inventaire', color: 'bg-amber-100 text-amber-700' },
  PERTE: { label: 'Perte', color: 'bg-red-100 text-red-700' },
  RETOUR_CLIENT: { label: 'Retour', color: 'bg-[#F5F5F5] text-[#1D1D1F]' },
};

export const HistoryModal = memo(function HistoryModal({ isOpen, onClose, product }: HistoryModalProps) {
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
        `/stock/mp/${product.productId || product.id}/movements?limit=100`,
        { credentials: 'include' }
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

  const filteredMovements = movements.filter(m => {
    if (filter === 'ALL') return true;
    return m.movementType === filter;
  });

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div role="dialog" aria-modal="true" className="relative bg-white/95 backdrop-blur-xl rounded-[16px] shadow-apple-elevated w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 bg-white/95 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#007AFF]/10 rounded-lg flex items-center justify-center">
              <History className="w-5 h-5 text-[#007AFF]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#1D1D1F]">Historique Mouvements</h2>
              <p className="text-sm text-[#6E6E73]">{product.name} ({product.code})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#86868B] hover:text-[#1D1D1F]">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-[#F0F0F0] bg-[#FAFAFA] flex items-center gap-4">
          <Filter className="w-4 h-4 text-[#AEAEB2]" />
          <div className="flex gap-2">
            {(['ALL', 'IN', 'OUT'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 text-sm rounded-full transition-colors",
                  filter === f
                    ? "bg-[#333336] text-white"
                    : "bg-white text-[#6E6E73] border border-[#F0F0F0] hover:bg-[#F5F5F5]"
                )}
              >
                {f === 'ALL' ? 'Tous' : f === 'IN' ? '↓ Entrées' : '↑ Sorties'}
              </button>
            ))}
          </div>
          <span className="text-sm text-[#86868B] ml-auto">
            {filteredMovements.length} mouvement(s)
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#86868B]" />
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#86868B]">
              <History className="w-12 h-12 text-[#D1D1D6] mb-2" />
              <p>Aucun mouvement trouvé</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#FAFAFA] sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#86868B] uppercase">Date</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-[#86868B] uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#86868B] uppercase">Origine</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[#86868B] uppercase">Quantité</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#86868B] uppercase">Référence</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#86868B] uppercase">Utilisateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {filteredMovements.map((m) => {
                  const origin = ORIGIN_LABELS[m.origin] || { label: m.origin, color: 'bg-[#F5F5F5] text-[#1D1D1F]' };
                  return (
                    <tr key={m.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3 text-sm text-[#6E6E73]">
                        {new Date(m.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.movementType === 'IN' ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <ArrowDownCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">IN</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <ArrowUpCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">OUT</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded text-xs font-medium", origin.color)}>
                          {origin.label}
                        </span>
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-sm text-right font-semibold",
                        m.movementType === 'IN' ? "text-green-600" : "text-red-600"
                      )}>
                        {m.movementType === 'IN' ? '+' : '-'}{m.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6E6E73] font-mono">
                        {m.reference || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6E6E73]">
                        {m.user.firstName} {m.user.lastName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-[#F0F0F0] bg-[#FAFAFA] flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[#1D1D1F] bg-white border border-[#E5E5E5] rounded-lg hover:bg-[#FAFAFA]">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
});
