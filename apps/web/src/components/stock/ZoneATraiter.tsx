'use client';

import { Clock, Package, ClipboardList, ExternalLink, Check } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ZoneATraiter as ZoneATraiterType } from '@/lib/api';

interface ZoneATraiterProps {
  data: ZoneATraiterType;
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
            pct < 30 ? 'bg-[#FF3B30]' : pct < 70 ? 'bg-[#FF9500]' : 'bg-[#34C759]'
          )}
          style={{ width: `${Math.max(pct, 3)}%` }}
        />
      </div>
      <span className="text-[10px] text-[#C7C7CC] tabular-nums w-8 text-right">{current}/{min}</span>
    </div>
  );
}

export function ZoneATraiter({ data, onAction }: ZoneATraiterProps) {
  const hasItems = data.totalCount > 0;

  return (
    <div className={cn(
      'bg-white rounded-2xl border overflow-hidden transition-shadow h-full flex flex-col',
      hasItems ? 'border-[#FF9500]/20 shadow-[0_0_0_1px_rgba(255,149,0,0.05)]' : 'border-[#E5E5E5]'
    )}>
      {/* Accent bar */}
      <div className={cn('h-[3px]', hasItems ? 'bg-gradient-to-r from-[#FF9500] to-[#FFCC00]' : 'bg-[#F0F0F0]')} />

      {/* Header */}
      <div className="px-5 py-4 border-b border-[#F0F0F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-2 h-2 rounded-full',
              hasItems ? 'bg-[#FF9500]' : 'bg-[#34C759]'
            )} />
            <h3 className="text-[15px] font-semibold text-[#1D1D1F]">À traiter</h3>
          </div>
          {hasItems && (
            <span className="text-[22px] font-bold text-[#FF9500] tabular-nums leading-none">
              {data.totalCount}
            </span>
          )}
        </div>
        <p className="text-[12px] text-[#8E8E93] mt-0.5 ml-5">
          {hasItems ? 'Sous 24-48h' : 'Aucun élément'}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-10 px-5">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mb-3">
              <Check className="w-6 h-6 text-[#34C759]" />
            </div>
            <p className="text-[15px] font-medium text-[#1D1D1F]">Rien à signaler</p>
            <p className="text-[13px] text-[#8E8E93] mt-1 text-center">Stocks et inventaires en ordre</p>
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Sous seuil */}
            {data.sousSeuilItems.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-3.5 w-3.5 text-[#C7C7CC]" />
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                    Sous seuil
                  </span>
                  <span className="text-[11px] font-bold text-[#FF9500] ml-auto tabular-nums">{data.sousSeuilItems.length}</span>
                </div>
                <div className="space-y-2">
                  {data.sousSeuilItems.slice(0, 5).map((item) => (
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
                          <StockLevelBar current={item.stock} min={item.minStock} />
                        </div>
                        <button
                          onClick={() => onAction?.('DEMANDE_MP', item.productId)}
                          className="px-3 py-1.5 text-[12px] font-semibold bg-[#1D1D1F] text-white rounded-lg hover:bg-[#333] transition-all active:scale-95 ml-2 flex-shrink-0"
                        >
                          Commander
                        </button>
                      </div>
                    </div>
                  ))}
                  {data.sousSeuilItems.length > 5 && (
                    <Link
                      href="/dashboard/appro/demandes-mp"
                      className="block text-center py-2.5 text-[13px] font-medium text-[#8E8E93] hover:text-[#1D1D1F] transition-colors"
                    >
                      Voir les {data.sousSeuilItems.length} produits →
                    </Link>
                  )}
                </div>
              </section>
            )}

            {/* Expires J-7 */}
            {data.expiresJ7.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-3.5 w-3.5 text-[#C7C7CC]" />
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                    Expire sous 7j
                  </span>
                  <span className="text-[11px] font-bold text-[#FF9500] ml-auto tabular-nums">{data.expiresJ7.length}</span>
                </div>
                <div className="space-y-2">
                  {data.expiresJ7.slice(0, 3).map((lot) => (
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
                      <Link
                        href={`/dashboard/stock/lots?id=${lot.lotId}`}
                        className="p-1.5 rounded-lg text-[#D1D1D6] hover:text-[#8E8E93] hover:bg-[#F5F5F7] transition-colors ml-3"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Inventaires en attente */}
            {data.inventairesEnAttente.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardList className="h-3.5 w-3.5 text-[#C7C7CC]" />
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                    Inventaires
                  </span>
                  <span className="text-[11px] font-bold text-[#FF9500] ml-auto tabular-nums">{data.inventairesEnAttente.length}</span>
                </div>
                <div className="space-y-2">
                  {data.inventairesEnAttente.slice(0, 3).map((inv) => (
                    <div
                      key={inv.id}
                      className="group flex items-center justify-between p-3.5 rounded-xl border border-[#F0F0F0] hover:border-[#E5E5E5] hover:shadow-[0_1px_6px_rgba(0,0,0,0.04)] transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#1D1D1F]">{inv.productName}</p>
                        <p className="text-[11px] text-[#8E8E93] mt-0.5">
                          Déclaré <span className="font-semibold text-[#1D1D1F]">{inv.declaredQty}</span>
                          <span className="text-[#C7C7CC] mx-1">·</span>
                          Système {inv.systemQty}
                        </p>
                      </div>
                      <Link
                        href="/dashboard/stock/inventaire"
                        className="px-3 py-1.5 text-[12px] font-semibold bg-[#1D1D1F] text-white rounded-lg hover:bg-[#333] transition-all active:scale-95 ml-3 flex-shrink-0"
                      >
                        Traiter
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
