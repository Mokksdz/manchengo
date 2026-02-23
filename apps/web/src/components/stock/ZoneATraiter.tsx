'use client';

import { Clock, Check, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ZoneATraiter as ZoneATraiterType } from '@/lib/api';

interface ZoneATraiterProps {
  data: ZoneATraiterType;
  onAction?: (type: string, id: number) => void;
}

export function ZoneATraiter({ data, onAction: _onAction }: ZoneATraiterProps) {
  const hasItems = data.totalCount > 0;

  return (
    <div className={cn(
      'bg-white/70 backdrop-blur-xl border border-white/60 rounded-[40px] shadow-sm hover:shadow-lg transition-all p-8 flex flex-col justify-between h-full',
    )}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-[#EC7620] shadow-sm border border-orange-200">
              <Clock size={22} />
            </div>
            <h3 className="font-display text-[20px] font-bold text-[#1D1D1F]">Flux Logistique</h3>
          </div>
          {hasItems && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md bg-amber-500/10 text-amber-500 border-amber-500/20">
              {data.totalCount} Actions
            </span>
          )}
        </div>

        {/* Content */}
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-10 px-5">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mb-3">
              <Check className="w-6 h-6 text-[#34C759]" />
            </div>
            <p className="text-[15px] font-medium text-[#1D1D1F]">Rien à signaler</p>
            <p className="text-[13px] text-[#8E8E93] mt-1 text-center">Stocks et inventaires en ordre</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Sous seuil items */}
            {data.sousSeuilItems.slice(0, 3).map((item) => (
              <div
                key={item.productId}
                className="flex items-center justify-between p-4 bg-white/40 rounded-[24px] border border-white/60 shadow-sm hover:bg-white hover:shadow-md hover:-translate-x-1 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full group-hover:scale-150 transition-transform" />
                  <div>
                    <p className="text-[14px] font-bold text-[#1D1D1F]">{item.name}</p>
                    <p className="text-[12px] text-[#86868B] font-medium">Stock {item.stock}/{item.minStock} — Seuil bas</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-bold text-[#86868B] bg-gray-100 px-2 py-1 rounded-lg tabular-nums">{item.code}</span>
                  <ArrowUpRight size={18} className="text-[#86868B] group-hover:text-[#EC7620] transition-colors" />
                </div>
              </div>
            ))}

            {/* Expires J-7 */}
            {data.expiresJ7.slice(0, 2).map((lot) => (
              <div
                key={lot.lotId}
                className="flex items-center justify-between p-4 bg-white/40 rounded-[24px] border border-white/60 shadow-sm hover:bg-white hover:shadow-md hover:-translate-x-1 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-amber-400 rounded-full group-hover:scale-150 transition-transform" />
                  <div>
                    <p className="text-[14px] font-bold text-[#1D1D1F]">{lot.lotNumber} — {lot.productName}</p>
                    <p className="text-[12px] text-[#86868B] font-medium">DLC {new Date(lot.expiryDate).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
                <ArrowUpRight size={18} className="text-[#86868B] group-hover:text-[#EC7620] transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom action */}
      {hasItems && (
        <Link
          href="/dashboard/stock/mp"
          className="block w-full mt-6 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-[13px] font-bold text-[#86868B] hover:bg-gray-50 hover:border-orange-200 hover:text-[#EC7620] transition-all text-center"
        >
          Consulter l&apos;agenda complet
        </Link>
      )}
    </div>
  );
}
