'use client';

import { Package, Clock, ClipboardList, ExternalLink, Check } from 'lucide-react';
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
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-[3px] bg-[#F0F0F0] rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct === 0 ? 'bg-[#FF3B30]' : pct < 50 ? 'bg-[#FF9500]' : 'bg-[#34C759]'
          )}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="text-[10px] text-[#C7C7CC] tabular-nums w-8 text-right">{current}/{min}</span>
    </div>
  );
}

export function ZoneCritique({ data, onAction }: ZoneCritiqueProps) {
  const hasItems = data.totalCount > 0;

  return (
    <div className={cn(
      'bg-white rounded-2xl border overflow-hidden transition-shadow h-full flex flex-col',
      hasItems ? 'border-[#FF3B30]/20 shadow-[0_0_0_1px_rgba(255,59,48,0.05)]' : 'border-[#E5E5E5]'
    )}>
      {/* Accent bar */}
      <div className={cn('h-[3px]', hasItems ? 'bg-gradient-to-r from-[#FF3B30] to-[#FF6961]' : 'bg-[#F0F0F0]')} />

      {/* Header */}
      <div className="px-5 py-4 border-b border-[#F0F0F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-2 h-2 rounded-full',
              hasItems ? 'bg-[#FF3B30] animate-pulse' : 'bg-[#34C759]'
            )} />
            <h3 className="text-[15px] font-semibold text-[#1D1D1F]">Critique</h3>
          </div>
          {hasItems && (
            <span className="text-[22px] font-bold text-[#FF3B30] tabular-nums leading-none">
              {data.totalCount}
            </span>
          )}
        </div>
        <p className="text-[12px] text-[#8E8E93] mt-0.5 ml-5">
          {hasItems ? 'Action immédiate requise' : 'Aucune alerte'}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-10 px-5">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mb-3">
              <Check className="w-6 h-6 text-[#34C759]" />
            </div>
            <p className="text-[15px] font-medium text-[#1D1D1F]">Tout est en ordre</p>
            <p className="text-[13px] text-[#8E8E93] mt-1 text-center">Aucune rupture, expiration ou écart critique détecté</p>
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Ruptures */}
            {data.ruptures.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-3.5 w-3.5 text-[#C7C7CC]" />
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                    Ruptures
                  </span>
                  <span className="text-[11px] font-bold text-[#FF3B30] ml-auto tabular-nums">{data.ruptures.length}</span>
                </div>
                <div className="space-y-2">
                  {data.ruptures.map((item) => (
                    <div
                      key={item.productId}
                      className="group p-3.5 rounded-xl border border-[#F0F0F0] hover:border-[#E5E5E5] hover:shadow-[0_1px_6px_rgba(0,0,0,0.04)] transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-[#8E8E93] bg-[#F5F5F7] px-1.5 py-0.5 rounded-md tracking-wide">
                              {item.code}
                            </span>
                            <span className="text-[13px] font-semibold text-[#1D1D1F] truncate">{item.name}</span>
                          </div>
                          <StockLevelBar current={0} min={item.minStock} />
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => onAction?.('DEMANDE_MP', item.productId)}
                            className="px-3 py-1.5 text-[12px] font-semibold bg-[#1D1D1F] text-white rounded-lg hover:bg-[#333] transition-all active:scale-95"
                          >
                            Demander
                          </button>
                          <Link
                            href={`/dashboard/stock/mp?id=${item.productId}`}
                            className="p-1.5 rounded-lg text-[#D1D1D6] hover:text-[#8E8E93] hover:bg-[#F5F5F7] transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Expires J-3 */}
            {data.expiresJ3.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-3.5 w-3.5 text-[#C7C7CC]" />
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                    Expire sous 3j
                  </span>
                  <span className="text-[11px] font-bold text-[#FF3B30] ml-auto tabular-nums">{data.expiresJ3.length}</span>
                </div>
                <div className="space-y-2">
                  {data.expiresJ3.map((lot) => (
                    <div
                      key={lot.lotId}
                      className="group flex items-center justify-between p-3.5 rounded-xl border border-[#F0F0F0] hover:border-[#E5E5E5] hover:shadow-[0_1px_6px_rgba(0,0,0,0.04)] transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#1D1D1F]">
                          {lot.lotNumber}
                          <span className="font-normal text-[#8E8E93] ml-2">{lot.productName}</span>
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] text-[#8E8E93]">
                            DLC <span className="font-semibold text-[#1D1D1F]">{new Date(lot.expiryDate).toLocaleDateString('fr-FR')}</span>
                          </span>
                          <span className="text-[11px] text-[#8E8E93]">Qté <span className="font-semibold text-[#1D1D1F]">{lot.quantity}</span></span>
                        </div>
                      </div>
                      <button
                        onClick={() => onAction?.('BLOQUER_LOT', lot.lotId)}
                        className="px-3 py-1.5 text-[12px] font-semibold bg-[#1D1D1F] text-white rounded-lg hover:bg-[#333] transition-all active:scale-95 ml-3 flex-shrink-0"
                      >
                        Bloquer
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Inventaires critiques */}
            {data.inventairesCritiques.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardList className="h-3.5 w-3.5 text-[#C7C7CC]" />
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                    Écarts inventaire
                  </span>
                  <span className="text-[11px] font-bold text-[#FF3B30] ml-auto tabular-nums">{data.inventairesCritiques.length}</span>
                </div>
                <div className="space-y-2">
                  {data.inventairesCritiques.map((inv) => (
                    <div
                      key={inv.id}
                      className="group flex items-center justify-between p-3.5 rounded-xl border border-[#F0F0F0] hover:border-[#E5E5E5] hover:shadow-[0_1px_6px_rgba(0,0,0,0.04)] transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#1D1D1F]">{inv.productName}</p>
                        <p className="text-[11px] text-[#8E8E93] mt-0.5">
                          Écart <span className="font-semibold text-[#1D1D1F]">{inv.ecart > 0 ? '+' : ''}{inv.ecart}</span>
                          <span className="text-[#C7C7CC] mx-1">·</span>
                          {inv.ecartPercent.toFixed(1)}%
                        </p>
                      </div>
                      <Link
                        href="/dashboard/stock/inventaire"
                        className="px-3 py-1.5 text-[12px] font-semibold bg-[#1D1D1F] text-white rounded-lg hover:bg-[#333] transition-all active:scale-95 ml-3 flex-shrink-0"
                      >
                        Valider
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
