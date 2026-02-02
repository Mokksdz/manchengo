'use client';

import { BarChart3, TrendingUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsData {
  period: string;
  summary: { totalOrders: number; totalProduced: number; avgYield: number };
  trend: { date: string; quantity: number; orders: number; avgYield: number }[];
  topProducts: { product: { id: number; code: string; name: string }; quantity: number; orders: number }[];
}

interface ProductionAnalyticsTabProps {
  analytics: AnalyticsData | null;
  analyticsPeriod: 'week' | 'month' | 'year';
  onPeriodChange: (period: 'week' | 'month' | 'year') => void;
}

export function ProductionAnalyticsTab({ analytics, analyticsPeriod, onPeriodChange }: ProductionAnalyticsTabProps) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1D1D1F] flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-[#AF52DE]" />Analytique Production
        </h2>
        <div className="flex gap-1 p-1 glass-card">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                analyticsPeriod === p ? 'bg-[#1D1D1F] text-white shadow-sm' : 'glass-pill text-[#86868B] hover:bg-white/40'
              )}
            >
              {p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Ann\u00e9e'}
            </button>
          ))}
        </div>
      </div>

      {analytics && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-[#1D1D1F] rounded-[20px] p-6 text-white">
              <p className="text-[#AF52DE]/70 text-sm">Total produit</p>
              <p className="text-4xl font-bold mt-2">{analytics.summary.totalProduced.toLocaleString()}</p>
              <p className="text-[#AF52DE]/70 text-sm mt-1">unit\u00e9s</p>
            </div>
            <div className="glass-card p-6">
              <p className="text-[#86868B] text-sm">Ordres compl\u00e9t\u00e9s</p>
              <p className="text-4xl font-bold mt-2 text-[#1D1D1F]">{analytics.summary.totalOrders}</p>
              <p className="text-[#AEAEB2] text-sm mt-1">ordres de production</p>
            </div>
            <div className="glass-card p-6">
              <div className="flex items-center gap-2">
                <TrendingUp className={cn('w-5 h-5', analytics.summary.avgYield >= 95 ? 'text-[#34C759]' : analytics.summary.avgYield >= 85 ? 'text-[#FF9500]' : 'text-[#FF3B30]')} />
                <p className="text-[#86868B] text-sm">Rendement moyen</p>
              </div>
              <p className={cn('text-4xl font-bold mt-2', analytics.summary.avgYield >= 95 ? 'text-[#34C759]' : analytics.summary.avgYield >= 85 ? 'text-[#FF9500]' : 'text-[#FF3B30]')}>
                {analytics.summary.avgYield.toFixed(1)}%
              </p>
              <p className="text-[#AEAEB2] text-sm mt-1">{analytics.summary.avgYield >= 95 ? 'Excellent' : analytics.summary.avgYield >= 85 ? 'Acceptable' : '\u00c0 am\u00e9liorer'}</p>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="glass-card p-6">
            <h3 className="font-semibold text-[#1D1D1F] mb-6">\u00c9volution de la production</h3>
            <div className="flex items-end gap-1 h-48">
              {analytics.trend.map((d, i) => {
                const maxQty = Math.max(...analytics.trend.map(t => t.quantity), 1);
                const height = (d.quantity / maxQty) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group">
                    <div className="w-full bg-gradient-to-t from-[#AF52DE]/30 to-[#AF52DE]/10 rounded-t-[6px] relative transition-all group-hover:from-[#AF52DE]/50 group-hover:to-[#AF52DE]/20" style={{ height: `${height}%`, minHeight: '4px' }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1D1D1F] text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 whitespace-nowrap shadow-lg">
                        {d.quantity} unit\u00e9s
                      </div>
                    </div>
                    <p className="text-[11px] text-[#AEAEB2] mt-2 truncate w-full text-center">
                      {analyticsPeriod === 'year' ? d.date.slice(5) : d.date.slice(8)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Products */}
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-black/[0.04]">
              <h3 className="font-semibold text-[#1D1D1F]">Top produits</h3>
            </div>
            <div className="divide-y divide-black/[0.04]">
              {analytics.topProducts.map((tp, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-white/40 transition-colors">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#AF52DE]/15 to-[#AF52DE]/5 rounded-[12px] flex items-center justify-center text-[#AF52DE] font-bold backdrop-blur-sm">{i + 1}</div>
                  <div className="flex-1">
                    <p className="font-medium text-[#1D1D1F]">{tp.product.name}</p>
                    <p className="text-sm text-[#86868B]">{tp.product.code} \u2022 {tp.orders} ordres</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-[#AF52DE]">{tp.quantity.toLocaleString()}</p>
                    <p className="text-sm text-[#AEAEB2]">unit\u00e9s</p>
                  </div>
                </div>
              ))}
              {analytics.topProducts.length === 0 && <div className="p-8 text-center text-[#86868B]">Aucune donn\u00e9e</div>}
            </div>
          </div>
        </>
      )}

      {!analytics && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-[#AEAEB2] animate-spin" />
        </div>
      )}
    </div>
  );
}
