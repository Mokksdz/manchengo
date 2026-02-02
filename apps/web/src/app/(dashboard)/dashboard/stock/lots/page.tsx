'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Package, Clock, Calendar,
  Droplets, Box, RefreshCw
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LotInfo {
  id: number;
  lotNumber: string;
  productId: number;
  productCode: string;
  productName: string;
  quantityInitial: number;
  quantityRemaining: number;
  manufactureDate?: string;
  expiryDate?: string;
  status: 'OK' | 'SOON_EXPIRED' | 'EXPIRED';
  daysUntilExpiry?: number;
  isActive: boolean;
}

type TabType = 'MP' | 'PF';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function StockBar({ current, total }: { current: number; total: number }) {
  const percent = total > 0 ? (current / total) * 100 : 0;
  const isLow = percent < 20;
  const isEmpty = current === 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-[3px] bg-[#F0F0F0] rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isEmpty ? 'bg-[#D1D1D6]' : isLow ? 'bg-[#FF9500]' : 'bg-[#34C759]'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[11px] text-[#8E8E93] w-10 text-right font-medium">{Math.round(percent)}%</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

export default function LotsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('MP');
  const [lots, setLots] = useState<LotInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ACTIVE');
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    soonExpired: 0,
    expired: 0,
  });

  const loadLots = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = activeTab === 'MP' ? '/api/lots/mp' : '/api/lots/pf';
      const includeInactive = filter === 'ALL' || filter === 'EXPIRED';

      const res = await fetch(
        `${endpoint}?includeInactive=${includeInactive}`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data: LotInfo[] = await res.json();
        setLots(data);

        const active = data.filter((l) => l.isActive && l.status !== 'EXPIRED').length;
        const soonExpired = data.filter((l) => l.status === 'SOON_EXPIRED').length;
        const expired = data.filter((l) => l.status === 'EXPIRED').length;
        setStats({ total: data.length, active, soonExpired, expired });
      }
    } catch (error) {
      console.error('Failed to load lots:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, filter]);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  const filteredLots = lots.filter((lot) => {
    if (filter === 'ACTIVE') return lot.isActive && lot.status !== 'EXPIRED';
    if (filter === 'EXPIRED') return lot.status === 'EXPIRED';
    return true;
  });

  return (
    <div className="glass-bg space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">
            Gestion des Lots
          </h1>
          <p className="text-[13px] text-[#86868B] mt-1">
            Traçabilité, DLC et FIFO
            {stats.expired > 0 && (
              <span className="ml-2 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]" />
                <span className="text-[#FF3B30] font-medium">{stats.expired} expiré(s)</span>
              </span>
            )}
            {stats.soonExpired > 0 && stats.expired === 0 && (
              <span className="ml-2 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />
                <span className="text-[#FF9500] font-medium">{stats.soonExpired} bientôt</span>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadLots}
          className="p-2.5 glass-card-hover transition-all text-[#8E8E93] hover:text-[#1D1D1F]"
          style={{ borderRadius: '14px' }}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ─── Tabs MP / PF ─── */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setActiveTab('MP')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all',
            activeTab === 'MP'
              ? 'bg-[#1D1D1F] text-white shadow-sm'
              : 'glass-card text-[#8E8E93] hover:bg-white/40'
          )}
        >
          <Droplets className="w-4 h-4" />
          Matières Premières
        </button>
        <button
          onClick={() => setActiveTab('PF')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all',
            activeTab === 'PF'
              ? 'bg-[#1D1D1F] text-white shadow-sm'
              : 'glass-card text-[#8E8E93] hover:bg-white/40'
          )}
        >
          <Box className="w-4 h-4" />
          Produits Finis
        </button>
      </div>

      {/* ─── KPI Strip ─── */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide">Total lots</p>
              <p className="text-[28px] font-bold text-[#1D1D1F] mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-[#8E8E93]/10 to-[#AEAEB2]/5 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-[#8E8E93]" />
            </div>
          </div>
        </div>
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide">Lots actifs</p>
              <p className="text-[28px] font-bold text-[#1D1D1F] mt-1">{stats.active}</p>
            </div>
            <div className="flex items-center gap-2">
              {stats.active > 0 && <span className="w-2 h-2 rounded-full bg-[#34C759]" />}
              <div className="w-10 h-10 bg-gradient-to-br from-[#8E8E93]/10 to-[#AEAEB2]/5 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-[#8E8E93]" />
              </div>
            </div>
          </div>
        </div>
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide">Bientôt expirés</p>
              <p className="text-[28px] font-bold text-[#1D1D1F] mt-1">{stats.soonExpired}</p>
            </div>
            <div className="flex items-center gap-2">
              {stats.soonExpired > 0 && <span className="w-2 h-2 rounded-full bg-[#FF9500]" />}
              <div className="w-10 h-10 bg-gradient-to-br from-[#8E8E93]/10 to-[#AEAEB2]/5 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#8E8E93]" />
              </div>
            </div>
          </div>
        </div>
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide">Expirés</p>
              <p className="text-[28px] font-bold text-[#1D1D1F] mt-1">{stats.expired}</p>
            </div>
            <div className="flex items-center gap-2">
              {stats.expired > 0 && <span className="w-2 h-2 rounded-full bg-[#FF3B30]" />}
              <div className="w-10 h-10 bg-gradient-to-br from-[#8E8E93]/10 to-[#AEAEB2]/5 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#8E8E93]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(['ACTIVE', 'ALL', 'EXPIRED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-[12px] font-medium rounded-full transition-all',
                filter === f
                  ? 'bg-[#1D1D1F] text-white'
                  : 'glass-pill text-[#8E8E93]'
              )}
            >
              {f === 'ACTIVE' ? 'Actifs' : f === 'ALL' ? 'Tous' : 'Expirés'}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-[#8E8E93] font-medium">
          {filteredLots.length} lot(s)
        </span>
      </div>

      {/* ─── Info Note ─── */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF] mt-2 flex-shrink-0" />
          <p className="text-[13px] text-[#8E8E93] leading-relaxed">
            Les lots sont consommés automatiquement du <span className="text-[#1D1D1F] font-medium">plus ancien au plus récent</span> (FIFO).
            Les lots expirés sont <span className="text-[#1D1D1F] font-medium">bloqués</span> pour la production et la vente.
          </p>
        </div>
      </div>

      {/* ─── Lots Table ─── */}
      {isLoading ? (
        <div className="glass-card flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-[#E5E5EA] border-t-[#1D1D1F] rounded-full animate-spin" />
            <p className="text-[12px] text-[#8E8E93]">Chargement...</p>
          </div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-black/[0.04]">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">N° Lot</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">Produit</th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">Stock</th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">Fabrication</th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">DLC</th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {filteredLots.map((lot) => (
                <tr
                  key={lot.id}
                  className={cn(
                    'hover:bg-white/40 transition-colors',
                    !lot.isActive && 'opacity-60'
                  )}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          lot.status === 'OK' && 'bg-[#34C759]',
                          lot.status === 'SOON_EXPIRED' && 'bg-[#FF9500]',
                          lot.status === 'EXPIRED' && 'bg-[#FF3B30]'
                        )}
                      />
                      <span className="font-mono text-[13px] font-semibold text-[#1D1D1F]">
                        {lot.lotNumber}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8E8E93]/10 to-[#AEAEB2]/5 flex items-center justify-center">
                        {activeTab === 'MP' ? (
                          <Droplets className="w-4 h-4 text-[#8E8E93]" />
                        ) : (
                          <Box className="w-4 h-4 text-[#8E8E93]" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-[14px] text-[#1D1D1F]">{lot.productName}</p>
                        <p className="text-[11px] text-[#8E8E93]">{lot.productCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="w-32 mx-auto">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-semibold text-[#1D1D1F]">{lot.quantityRemaining}</span>
                        <span className="text-[#C7C7CC]">/ {lot.quantityInitial}</span>
                      </div>
                      <StockBar current={lot.quantityRemaining} total={lot.quantityInitial} />
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center text-[13px] text-[#8E8E93]">
                    {formatDate(lot.manufactureDate)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={cn(
                        'text-[13px] font-medium',
                        lot.status === 'OK' && 'text-[#1D1D1F]',
                        lot.status === 'SOON_EXPIRED' && 'text-[#FF9500]',
                        lot.status === 'EXPIRED' && 'text-[#FF3B30] line-through'
                      )}
                    >
                      {formatDate(lot.expiryDate)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn(
                        'w-2 h-2 rounded-full',
                        lot.status === 'OK' && 'bg-[#34C759]',
                        lot.status === 'SOON_EXPIRED' && 'bg-[#FF9500]',
                        lot.status === 'EXPIRED' && 'bg-[#FF3B30]',
                      )} />
                      <span className={cn(
                        'text-[12px] font-medium',
                        lot.status === 'OK' && 'text-[#34C759]',
                        lot.status === 'SOON_EXPIRED' && 'text-[#FF9500]',
                        lot.status === 'EXPIRED' && 'text-[#FF3B30]',
                      )}>
                        {lot.status === 'OK' ? 'OK' : lot.status === 'EXPIRED' ? 'Expiré' : `${lot.daysUntilExpiry}j`}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
              {filteredLots.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#8E8E93]/10 to-[#AEAEB2]/5 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Package className="w-6 h-6 text-[#C7C7CC]" />
                    </div>
                    <p className="font-medium text-[#8E8E93] text-[14px]">Aucun lot trouvé</p>
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
