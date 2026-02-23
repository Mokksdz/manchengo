'use client';

import { useMemo } from 'react';
import { BarChart3, TrendingUp, RefreshCw, Target, AlertTriangle, CheckCircle, Clock, Factory } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

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

const COLORS = {
  primary: '#AF52DE',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  blue: '#007AFF',
  gray: '#86868B',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PIE_COLORS = ['#AF52DE', '#007AFF', '#34C759', '#FF9500', '#FF3B30'];

// Custom tooltip pour les graphiques
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 shadow-lg border border-black/[0.04]">
        <p className="text-[13px] font-semibold text-[#1D1D1F] mb-1">{label}</p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-[12px]" style={{ color: entry.color }}>
            {entry.name}: <span className="font-semibold">{entry.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function ProductionAnalyticsTab({ analytics, analyticsPeriod, onPeriodChange }: ProductionAnalyticsTabProps) {
  // Calculer les métriques avancées
  const advancedMetrics = useMemo(() => {
    if (!analytics) return null;

    const trend = analytics.trend;
    const avgQuantity = trend.length > 0 ? trend.reduce((sum, t) => sum + t.quantity, 0) / trend.length : 0;
    const avgOrders = trend.length > 0 ? trend.reduce((sum, t) => sum + t.orders, 0) / trend.length : 0;

    // Calculer tendance (dernier 30% vs premier 30%)
    const splitPoint = Math.floor(trend.length * 0.3);
    const firstPart = trend.slice(0, splitPoint);
    const lastPart = trend.slice(-splitPoint);

    const firstAvg = firstPart.length > 0 ? firstPart.reduce((s, t) => s + t.quantity, 0) / firstPart.length : 0;
    const lastAvg = lastPart.length > 0 ? lastPart.reduce((s, t) => s + t.quantity, 0) / lastPart.length : 0;
    const trendPercent = firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;

    // Calculer rendement moyen pondéré
    const weightedYield = trend.reduce((sum, t) => sum + (t.avgYield * t.quantity), 0);
    const totalQuantity = trend.reduce((sum, t) => sum + t.quantity, 0);
    const realAvgYield = totalQuantity > 0 ? weightedYield / totalQuantity : 0;

    // Distribution des rendements
    const yieldDistribution = [
      { name: 'Excellent (>95%)', value: trend.filter(t => t.avgYield > 95).length, color: COLORS.success },
      { name: 'Bon (85-95%)', value: trend.filter(t => t.avgYield >= 85 && t.avgYield <= 95).length, color: COLORS.warning },
      { name: 'Faible (<85%)', value: trend.filter(t => t.avgYield < 85).length, color: COLORS.danger },
    ].filter(d => d.value > 0);

    return {
      avgQuantity,
      avgOrders,
      trendPercent,
      realAvgYield,
      yieldDistribution,
      peakDay: trend.reduce((max, t) => t.quantity > max.quantity ? t : max, trend[0] || { date: '-', quantity: 0 }),
      lowDay: trend.reduce((min, t) => t.quantity < min.quantity ? t : min, trend[0] || { date: '-', quantity: 0 }),
    };
  }, [analytics]);

  // Préparer données pour graphique combiné
  const combinedChartData = useMemo(() => {
    if (!analytics) return [];
    return analytics.trend.map(t => ({
      date: analyticsPeriod === 'year' ? t.date.slice(5) : t.date.slice(5, 10),
      quantity: t.quantity,
      orders: t.orders,
      yield: t.avgYield,
    }));
  }, [analytics, analyticsPeriod]);

  // Données pour graphique top produits
  const topProductsChartData = useMemo(() => {
    if (!analytics) return [];
    return analytics.topProducts.slice(0, 5).map(tp => ({
      name: tp.product.code,
      fullName: tp.product.name,
      quantity: tp.quantity,
      orders: tp.orders,
    }));
  }, [analytics]);

  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-8 h-8 text-[#AEAEB2] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1D1D1F] flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-[#AF52DE]" />
          Analytique Production Avancée
        </h2>
        <div className="flex gap-1 p-1 glass-card">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              aria-pressed={analyticsPeriod === p}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                analyticsPeriod === p
                  ? 'bg-[#1D1D1F] text-white shadow-sm'
                  : 'glass-pill text-[#86868B] hover:bg-white/40'
              )}
            >
              {p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Année'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1D1D1F] rounded-[20px] p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Factory className="w-5 h-5 text-[#AF52DE]" />
            <p className="text-white/60 text-[13px]">Total produit</p>
          </div>
          <p className="text-3xl font-bold">{analytics.summary.totalProduced.toLocaleString()}</p>
          <p className="text-[#AF52DE] text-[13px] mt-1">unités</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-[#34C759]" />
            <p className="text-[#86868B] text-[13px]">Ordres complétés</p>
          </div>
          <p className="text-3xl font-bold text-[#1D1D1F]">{analytics.summary.totalOrders}</p>
          <p className="text-[#AEAEB2] text-[13px] mt-1">
            ~{advancedMetrics?.avgOrders.toFixed(1)}/jour en moyenne
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className={cn('w-5 h-5', (advancedMetrics?.trendPercent ?? 0) >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]')} />
            <p className="text-[#86868B] text-[13px]">Tendance</p>
          </div>
          <p className={cn('text-3xl font-bold', (advancedMetrics?.trendPercent ?? 0) >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
            {(advancedMetrics?.trendPercent ?? 0) >= 0 ? '+' : ''}{advancedMetrics?.trendPercent.toFixed(1)}%
          </p>
          <p className="text-[#AEAEB2] text-[13px] mt-1">vs début de période</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Target className={cn('w-5 h-5', analytics.summary.avgYield >= 95 ? 'text-[#34C759]' : analytics.summary.avgYield >= 85 ? 'text-[#FF9500]' : 'text-[#FF3B30]')} />
            <p className="text-[#86868B] text-[13px]">Rendement moyen</p>
          </div>
          <p className={cn('text-3xl font-bold', analytics.summary.avgYield >= 95 ? 'text-[#34C759]' : analytics.summary.avgYield >= 85 ? 'text-[#FF9500]' : 'text-[#FF3B30]')}>
            {analytics.summary.avgYield.toFixed(1)}%
          </p>
          <p className="text-[#AEAEB2] text-[13px] mt-1">
            {analytics.summary.avgYield >= 95 ? 'Excellent' : analytics.summary.avgYield >= 85 ? 'Acceptable' : 'À améliorer'}
          </p>
        </div>
      </div>

      {/* Graphiques Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Production & Orders Chart */}
        <div className="col-span-2 glass-card p-6">
          <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4">Évolution de la production</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={combinedChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#86868B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#86868B' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="quantity"
                name="Quantité"
                stroke={COLORS.primary}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorQuantity)"
              />
              <Line
                type="monotone"
                dataKey="orders"
                name="Ordres"
                stroke={COLORS.blue}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Yield Distribution Pie */}
        <div className="glass-card p-6">
          <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4">Distribution des rendements</h3>
          {advancedMetrics?.yieldDistribution && advancedMetrics.yieldDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={advancedMetrics.yieldDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {advancedMetrics.yieldDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span className="text-[12px] text-[#1D1D1F]">{value}</span>}
                />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-[#86868B]">
              Aucune donnée
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top Products Bar Chart */}
        <div className="glass-card p-6">
          <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4">Top 5 Produits</h3>
          {topProductsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topProductsChartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#86868B' }} />
                <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 11, fill: '#86868B' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="glass-card p-3 shadow-lg">
                          <p className="font-semibold text-[13px] text-[#1D1D1F]">{data.fullName}</p>
                          <p className="text-[12px] text-[#AF52DE]">{data.quantity.toLocaleString()} unités</p>
                          <p className="text-[12px] text-[#86868B]">{data.orders} ordres</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="quantity" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-[#86868B]">
              Aucune donnée
            </div>
          )}
        </div>

        {/* Yield Trend Line Chart */}
        <div className="glass-card p-6">
          <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4">Évolution du rendement</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={combinedChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#86868B' }} />
              <YAxis
                domain={[70, 100]}
                tick={{ fontSize: 11, fill: '#86868B' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Rendement']}
                labelStyle={{ color: '#1D1D1F' }}
              />
              {/* Ligne de référence 85% */}
              <Line
                type="monotone"
                dataKey={() => 85}
                stroke={COLORS.warning}
                strokeDasharray="5 5"
                strokeWidth={1}
                dot={false}
                name="Seuil min"
              />
              {/* Ligne de référence 95% */}
              <Line
                type="monotone"
                dataKey={() => 95}
                stroke={COLORS.success}
                strokeDasharray="5 5"
                strokeWidth={1}
                dot={false}
                name="Objectif"
              />
              <Line
                type="monotone"
                dataKey="yield"
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={{ r: 4, fill: COLORS.primary }}
                name="Rendement"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Cards */}
      {advancedMetrics && (
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-[#86868B]" />
              <p className="text-[12px] text-[#86868B]">Moy. par jour</p>
            </div>
            <p className="text-xl font-bold text-[#1D1D1F]">{advancedMetrics.avgQuantity.toFixed(0)}</p>
            <p className="text-[11px] text-[#AEAEB2]">unités</p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-[#34C759]" />
              <p className="text-[12px] text-[#86868B]">Jour record</p>
            </div>
            <p className="text-xl font-bold text-[#34C759]">{advancedMetrics.peakDay?.quantity.toLocaleString()}</p>
            <p className="text-[11px] text-[#AEAEB2]">{advancedMetrics.peakDay?.date}</p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-[#FF9500]" />
              <p className="text-[12px] text-[#86868B]">Jour le plus bas</p>
            </div>
            <p className="text-xl font-bold text-[#FF9500]">{advancedMetrics.lowDay?.quantity.toLocaleString()}</p>
            <p className="text-[11px] text-[#AEAEB2]">{advancedMetrics.lowDay?.date}</p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-[#AF52DE]" />
              <p className="text-[12px] text-[#86868B]">Rendement pondéré</p>
            </div>
            <p className="text-xl font-bold text-[#AF52DE]">{advancedMetrics.realAvgYield.toFixed(1)}%</p>
            <p className="text-[11px] text-[#AEAEB2]">par quantité</p>
          </div>
        </div>
      )}
    </div>
  );
}
