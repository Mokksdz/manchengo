'use client';

import { Check, AlertTriangle, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ZoneCritique as ZoneCritiqueType } from '@/lib/api';

interface ZoneCritiqueProps {
  data: ZoneCritiqueType;
  onAction?: (type: string, id: number) => void;
}

function StockLevelBar({ current, min }: { current: number; min: number }) {
  const pct = min > 0 ? Math.min((current / min) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-800/50 rounded-full h-2.5 overflow-hidden relative">
      <div
        className={cn(
          'h-full rounded-full relative',
          pct === 0 ? 'bg-gradient-to-r from-red-600 to-orange-500' : pct < 50 ? 'bg-gradient-to-r from-orange-500 to-amber-400' : 'bg-gradient-to-r from-emerald-500 to-green-400'
        )}
        style={{ width: `${Math.max(pct, 4)}%` }}
      >
        <div className="absolute inset-0 shimmer-overlay rounded-full" />
      </div>
    </div>
  );
}

export function ZoneCritique({ data, onAction }: ZoneCritiqueProps) {
  const hasItems = data.totalCount > 0;

  return (
    <div className="glass-card-dark p-8 flex flex-col h-full transition-all group">
      {/* Top accent bar */}
      <div className={cn(
        'absolute top-0 left-0 w-full h-1',
        hasItems ? 'bg-gradient-to-r from-red-600 via-red-500 to-transparent' : 'bg-gradient-to-r from-emerald-500 to-transparent'
      )} />

      {/* Ambient red glow */}
      {hasItems && (
        <div className="absolute -top-[100px] -left-[100px] w-[300px] h-[300px] bg-red-600/10 blur-[100px] rounded-full pointer-events-none" />
      )}

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            {hasItems && <div className="absolute inset-0 bg-red-500 blur-md opacity-50 animate-pulse" />}
            <div className={cn(
              'w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg border',
              hasItems
                ? 'bg-gradient-to-br from-red-500 to-red-700 border-red-400/30'
                : 'bg-gradient-to-br from-emerald-500 to-emerald-700 border-emerald-400/30'
            )}>
              {hasItems ? <AlertTriangle size={22} fill="currentColor" /> : <Check size={22} />}
            </div>
          </div>
          <div>
            <h3 className="font-display text-[22px] font-bold text-white tracking-tight leading-none">Centre de Crise</h3>
            <p className={cn(
              'text-[13px] font-medium mt-1',
              hasItems ? 'text-red-200/50' : 'text-emerald-200/50'
            )}>
              {hasItems ? 'Actions immédiates requises' : 'Aucune alerte active'}
            </p>
          </div>
        </div>
        {hasItems && (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md bg-red-500/10 text-red-500 border-red-500/20">
            {data.totalCount} Ruptures
          </span>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 space-y-4 flex-1 overflow-y-auto custom-scrollbar-dark pr-2">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-10 px-5">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
              <Check className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-[15px] font-medium text-white">Tout est en ordre</p>
            <p className="text-[13px] text-gray-400 mt-1 text-center">Aucune rupture, expiration ou écart critique</p>
          </div>
        ) : (
          <>
            {/* Ruptures */}
            {data.ruptures.length > 0 && data.ruptures.map((item) => (
              <div
                key={item.productId}
                className="bg-white/5 border border-white/10 rounded-[28px] p-6 hover:bg-white/10 transition-all group/item relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 h-full w-1.5 bg-red-500" />
                <div className="flex justify-between items-start mb-4 pl-3">
                  <div>
                    <span className="flex items-center text-[17px] font-bold text-white group-hover/item:text-red-400 transition-colors">
                      Rupture : {item.name}
                    </span>
                    <p className="text-[13px] text-gray-400 mt-1">
                      Stock critique : <b className="text-red-400">0</b>
                      <span className="text-gray-600 mx-1">&bull;</span>
                      Seuil: {item.minStock}
                    </p>
                  </div>
                  <span className="text-[12px] font-black text-red-500 uppercase tracking-widest px-2 py-1 bg-red-500/10 rounded-lg">
                    Impact Haut
                  </span>
                </div>
                <div className="pl-3 mb-6">
                  <StockLevelBar current={0} min={item.minStock} />
                </div>
                <div className="flex gap-3 pl-3">
                  <button
                    onClick={() => onAction?.('DEMANDE_MP', item.productId)}
                    className="flex-1 h-12 text-[14px] font-bold text-white bg-gradient-to-r from-red-600 to-red-700 rounded-2xl hover:from-red-500 hover:to-red-600 transition-all shadow-xl shadow-red-900/40 border border-red-500/50"
                  >
                    Réapprovisionner &rarr;
                  </button>
                  <Link
                    href={`/dashboard/stock/mp?id=${item.productId}`}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <MoreHorizontal size={20} />
                  </Link>
                </div>
              </div>
            ))}

            {/* Expires J-3 */}
            {data.expiresJ3.length > 0 && (
              <div className="pt-6 border-t border-white/5 mt-4">
                <p className="text-[11px] text-gray-500 font-bold mb-4 uppercase tracking-widest pl-3">Expire sous 3 jours</p>
                <div className="space-y-3 pl-3">
                  {data.expiresJ3.map((lot) => (
                    <div key={lot.lotId} className="flex items-start gap-4 text-[13px] group/alert cursor-pointer">
                      <div className="mt-1 w-2 h-2 rounded-full shrink-0 bg-red-500 shadow-[0_0_8px_#ef4444]" />
                      <div className="flex-1">
                        <p className="text-gray-300 font-medium group-hover/alert:text-white transition-colors">
                          {lot.lotNumber} — {lot.productName}
                        </p>
                        <p className="text-gray-500 text-[11px] mt-0.5">
                          DLC {new Date(lot.expiryDate).toLocaleDateString('fr-FR')} &bull; Qté {lot.quantity}
                        </p>
                      </div>
                      <button
                        onClick={() => onAction?.('BLOQUER_LOT', lot.lotId)}
                        className="px-3 py-1.5 text-[12px] font-bold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all flex-shrink-0"
                      >
                        Bloquer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inventaires critiques */}
            {data.inventairesCritiques.length > 0 && (
              <div className="pt-6 border-t border-white/5 mt-4">
                <p className="text-[11px] text-gray-500 font-bold mb-4 uppercase tracking-widest pl-3">Écarts inventaire</p>
                <div className="space-y-3 pl-3">
                  {data.inventairesCritiques.map((inv) => (
                    <div key={inv.id} className="flex items-start gap-4 text-[13px] group/alert cursor-pointer">
                      <div className="mt-1 w-2 h-2 rounded-full shrink-0 bg-amber-500" />
                      <div className="flex-1">
                        <p className="text-gray-300 font-medium group-hover/alert:text-white transition-colors">{inv.productName}</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">
                          Écart {inv.ecart > 0 ? '+' : ''}{inv.ecart} &bull; {inv.ecartPercent.toFixed(1)}%
                        </p>
                      </div>
                      <Link
                        href="/dashboard/stock/inventaire"
                        className="px-3 py-1.5 text-[12px] font-bold text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-all flex-shrink-0"
                      >
                        Valider
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
