'use client';

import Link from 'next/link';
import { Search, Package, RefreshCw, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MpConsumed {
  mp?: { code: string };
  lotNumber?: string;
}

interface UsageInfo {
  productionOrder: { id: number; reference: string };
  productPf?: { name: string };
  quantityConsumed: number;
  lotsPfProduced?: string[];
}

interface TraceabilityInfo {
  productionOrder?: { id: number; reference: string };
  mpConsumed?: MpConsumed[];
  usedIn?: UsageInfo[];
}

interface LotSearchResult {
  type: 'MP' | 'PF';
  lot: {
    id: number;
    lotNumber: string;
    product: { id: number; code: string; name: string; unit: string };
    quantityInitial: number;
    quantityRemaining: number;
    expiryDate?: string;
  };
  traceability: TraceabilityInfo | null;
}

interface ProductionTraceabilityTabProps {
  lotSearchQuery: string;
  onSearchChange: (query: string) => void;
  lotSearchResults: LotSearchResult[];
  isSearchingLots: boolean;
}

const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

export function ProductionTraceabilityTab({ lotSearchQuery, onSearchChange, lotSearchResults, isSearchingLots }: ProductionTraceabilityTabProps) {
  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-bold text-[#1D1D1F] flex items-center gap-2 mb-6">
          <Search className="w-6 h-6 text-[#AF52DE]" />Tra\u00e7abilit\u00e9 des Lots
        </h2>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#AEAEB2]" />
          <input
            type="text"
            placeholder="Rechercher un num\u00e9ro de lot (MP ou PF)..."
            value={lotSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-4 py-4 border border-black/[0.06] rounded-[14px] bg-white/60 backdrop-blur-sm text-lg focus:ring-2 focus:ring-[#AF52DE]/15 focus:border-[#AF52DE] placeholder:text-[#C7C7CC] transition-all outline-none"
          />
          {isSearchingLots && <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#AEAEB2] animate-spin" />}
        </div>

        {lotSearchResults.length > 0 && (
          <div className="space-y-4">
            {lotSearchResults.map((result, idx) => (
              <div key={idx} className="glass-card overflow-hidden">
                <div className={cn('px-5 py-4 flex items-center gap-4', result.type === 'PF' ? 'bg-[#AF52DE]/[0.06]' : 'bg-[#007AFF]/[0.06]')}>
                  <div className={cn('w-12 h-12 rounded-[14px] flex items-center justify-center backdrop-blur-sm', result.type === 'PF' ? 'bg-gradient-to-br from-[#AF52DE]/15 to-[#AF52DE]/5' : 'bg-gradient-to-br from-[#007AFF]/15 to-[#007AFF]/5')}>
                    <Package className={cn('w-6 h-6', result.type === 'PF' ? 'text-[#AF52DE]' : 'text-[#007AFF]')} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('glass-status-pill px-2.5 py-0.5 rounded-full text-xs font-semibold', result.type === 'PF' ? 'bg-[#AF52DE]/15 text-[#AF52DE]' : 'bg-[#007AFF]/15 text-[#007AFF]')}>{result.type}</span>
                      <span className="font-mono font-bold text-lg">{result.lot.lotNumber}</span>
                    </div>
                    <p className="text-[#6E6E73]">{result.lot.product.name} ({result.lot.product.code})</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{result.lot.quantityRemaining} / {result.lot.quantityInitial} {result.lot.product.unit}</p>
                    {result.lot.expiryDate && <p className="text-sm text-[#86868B]">DLC: {formatDate(result.lot.expiryDate)}</p>}
                  </div>
                </div>

                {result.traceability && (
                  <div className="px-5 py-4 border-t border-black/[0.04]">
                    <h4 className="font-semibold text-[#1D1D1F] mb-3 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-[#AF52DE]" />Tra\u00e7abilit\u00e9</h4>
                    {result.type === 'PF' && result.traceability.productionOrder && (
                      <div className="bg-black/[0.03] rounded-[14px] p-4 backdrop-blur-sm">
                        <p className="font-medium">Ordre de production: <Link href={`/dashboard/production/order/${result.traceability.productionOrder.id}`} className="text-[#AF52DE] hover:underline">{result.traceability.productionOrder.reference}</Link></p>
                        {result.traceability.mpConsumed && result.traceability.mpConsumed.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm text-[#86868B] mb-2">MP consomm\u00e9es:</p>
                            <div className="flex flex-wrap gap-2">
                              {result.traceability.mpConsumed.map((mp, i) => (
                                <span key={i} className="glass-status-pill px-2.5 py-1 bg-[#007AFF]/10 text-[#007AFF] rounded-full text-sm backdrop-blur-sm">
                                  {mp.mp?.code}: {mp.lotNumber || 'N/A'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {result.type === 'MP' && result.traceability.usedIn && result.traceability.usedIn.length > 0 && (
                      <div className="space-y-2">
                        {result.traceability.usedIn.map((usage, i) => (
                          <div key={i} className="bg-black/[0.03] rounded-[14px] p-3 flex items-center justify-between backdrop-blur-sm hover:bg-white/40 transition-colors">
                            <div>
                              <Link href={`/dashboard/production/order/${usage.productionOrder.id}`} className="text-[#AF52DE] hover:underline font-medium">{usage.productionOrder.reference}</Link>
                              <p className="text-sm text-[#86868B]">{usage.productPf?.name}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{usage.quantityConsumed} consomm\u00e9s</p>
                              {usage.lotsPfProduced && usage.lotsPfProduced.length > 0 && (
                                <p className="text-sm text-[#86868B]">\u2192 {usage.lotsPfProduced.join(', ')}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {lotSearchQuery && lotSearchResults.length === 0 && !isSearchingLots && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-[#D1D1D6] mx-auto mb-4" />
            <p className="text-[#86868B]">Aucun lot trouv\u00e9 pour "{lotSearchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
