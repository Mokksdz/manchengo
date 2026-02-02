'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { stockDashboard, StockDashboardData } from '@/lib/api';
import { ZoneCritique, ZoneATraiter, ZoneSante } from '@/components/stock';
import {
  RefreshCw,
  AlertTriangle,
  Package,
  Clock,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function StockDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<StockDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      const response = await stockDashboard.getDashboard();
      if (response.success) {
        setData(response.data);
        setError(null);
      } else {
        throw new Error('Erreur de chargement');
      }
    } catch (err) {
      console.error('Failed to load stock dashboard:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(() => loadDashboard(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const handleAction = async (type: string, id: number) => {
    switch (type) {
      case 'DEMANDE_MP':
        toast.info(`Redirection vers demande MP #${id}`);
        break;
      case 'BLOQUER_LOT':
        toast.warning(`Blocage lot #${id} - à implémenter`);
        break;
      default:
        console.log('Action:', type, id); // eslint-disable-line no-console
    }
  };

  /* ──── Loading ──── */
  if (isLoading) {
    return (
      <div className="glass-bg space-y-8 animate-in fade-in duration-300">
        <div className="animate-pulse space-y-8">
          <div className="space-y-2">
            <div className="h-7 bg-black/[0.03] rounded-lg w-24" />
            <div className="h-4 bg-black/[0.03] rounded w-48" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-[88px] glass-card rounded-2xl" />)}
          </div>
          <div className="grid lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => <div key={i} className="h-72 glass-card rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  /* ──── Error ──── */
  if (error) {
    return (
      <div className="glass-bg flex items-center justify-center min-h-[60vh]">
        <div className="glass-card rounded-2xl p-10 text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="h-7 w-7 text-[#FF3B30]" />
          </div>
          <p className="text-[17px] font-semibold text-[#1D1D1F] mb-1">Erreur de chargement</p>
          <p className="text-[13px] text-[#86868B] mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => loadDashboard()}
            className="px-5 py-2.5 text-[14px] font-medium bg-[#1D1D1F] text-white rounded-full hover:bg-[#333] transition-all active:scale-[0.97]"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const criticalCount = data.summary.criticalCount;
  const warningCount = data.aTraiter.totalCount;
  const healthScore = data.summary.healthScore;
  const totalProducts = (data.summary as unknown as Record<string, number>).totalProducts ?? 0;

  /* ──── Quick nav items ──── */
  const navLinks = [
    { label: 'Matières premières', href: '/dashboard/stock/mp' },
    { label: 'Produits finis', href: '/dashboard/stock/pf' },
    { label: 'Gestion lots', href: '/dashboard/stock/lots' },
    { label: 'DLC / Expiry', href: '/dashboard/stock/expiry' },
    ...(user?.role === 'ADMIN' || user?.role === 'APPRO'
      ? [{ label: 'Inventaire', href: '/dashboard/stock/inventaire' }]
      : []),
  ];

  return (
    <div className="glass-bg space-y-8">
      {/* ═══════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════ */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#1D1D1F] leading-tight">
            Stock
          </h1>
          <p className="text-[13px] text-[#86868B] mt-0.5">
            Vue d&apos;ensemble temps réel
          </p>
        </div>
        <button
          onClick={() => loadDashboard(true)}
          disabled={isRefreshing}
          className={cn(
            'p-2.5 rounded-full transition-all active:scale-95',
            'glass-card-hover',
            'text-[#86868B] hover:text-[#1D1D1F] disabled:opacity-40'
          )}
        >
          <RefreshCw className={cn('h-[18px] w-[18px]', isRefreshing && 'animate-spin')} />
        </button>
      </div>

      {/* ═══════════════════════════════════════════════
          SUMMARY KPI STRIP
      ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Health Score */}
        <div className="glass-card-hover rounded-2xl p-4 flex items-center gap-4 transition-all">
          <div className="relative w-11 h-11 flex-shrink-0">
            <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-black/[0.03]" />
              <circle
                cx="22" cy="22" r="18"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={2 * Math.PI * 18 * (1 - healthScore / 100)}
                className={cn(
                  'transition-all duration-1000',
                  healthScore >= 80 ? 'stroke-[#34C759]' : healthScore >= 50 ? 'stroke-[#FF9500]' : 'stroke-[#FF3B30]'
                )}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[13px] font-bold text-[#1D1D1F] tabular-nums">{healthScore}</span>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Santé</p>
            <p className={cn(
              'text-[14px] font-semibold',
              healthScore >= 80 ? 'text-[#34C759]' : healthScore >= 50 ? 'text-[#FF9500]' : 'text-[#FF3B30]'
            )}>
              {healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Correct' : healthScore >= 40 ? 'À surveiller' : 'Critique'}
            </p>
          </div>
        </div>

        {/* Critical */}
        <Link
          href="#zone-critique"
          className="glass-card-hover rounded-2xl p-4 flex items-center gap-4 transition-all group"
        >
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
            criticalCount > 0 ? 'bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5' : 'bg-black/[0.03]'
          )}>
            <AlertTriangle className={cn(
              'w-5 h-5',
              criticalCount > 0 ? 'text-[#FF3B30]' : 'text-[#C7C7CC]'
            )} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Critiques</p>
            <p className="text-[20px] font-bold text-[#1D1D1F] leading-tight tabular-nums">{criticalCount}</p>
          </div>
        </Link>

        {/* Warnings */}
        <Link
          href="#zone-atraiter"
          className="glass-card-hover rounded-2xl p-4 flex items-center gap-4 transition-all group"
        >
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
            warningCount > 0 ? 'bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5' : 'bg-black/[0.03]'
          )}>
            <Clock className={cn(
              'w-5 h-5',
              warningCount > 0 ? 'text-[#FF9500]' : 'text-[#C7C7CC]'
            )} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">À traiter</p>
            <p className="text-[20px] font-bold text-[#1D1D1F] leading-tight tabular-nums">{warningCount}</p>
          </div>
        </Link>

        {/* Total products */}
        <div className="glass-card-hover rounded-2xl p-4 flex items-center gap-4 transition-all">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-black/[0.04] to-black/[0.02] flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-[#C7C7CC]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Produits</p>
            <p className="text-[20px] font-bold text-[#1D1D1F] leading-tight tabular-nums">
              {totalProducts || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          3 ZONES
      ═══════════════════════════════════════════════ */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div id="zone-critique">
          <ZoneCritique data={data.critique} onAction={handleAction} />
        </div>
        <div id="zone-atraiter">
          <ZoneATraiter data={data.aTraiter} onAction={handleAction} />
        </div>
        <ZoneSante data={data.sante} summary={data.summary} />
      </div>

      {/* ═══════════════════════════════════════════════
          QUICK NAV
      ═══════════════════════════════════════════════ */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-black/[0.04]">
          <p className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Accès rapide</p>
        </div>
        <div className="divide-y divide-black/[0.04]">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center justify-between px-5 py-3 hover:bg-white/40 transition-colors"
            >
              <span className="text-[14px] font-medium text-[#1D1D1F]">{link.label}</span>
              <ArrowRight className="w-4 h-4 text-[#C7C7CC] group-hover:text-[#86868B] transition-all group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════ */}
      <p className="text-center text-[11px] text-[#C7C7CC] pb-2">
        Mis à jour à {new Date(data._meta.generatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
