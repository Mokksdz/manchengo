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
  Activity,
  PackageOpen,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

const log = createLogger('StockDashboard');

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
      log.error('Failed to load stock dashboard', { error: err instanceof Error ? err.message : String(err) });
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
        log.debug('Action', { type, id });
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-[180px] glass-card rounded-[32px]" />)}
          </div>
          <div className="grid xl:grid-cols-4 auto-rows-fr gap-6 min-h-[500px]">
            <div className="xl:col-span-2 xl:row-span-2 h-72 glass-card rounded-[32px]" />
            <div className="xl:col-span-2 h-72 glass-card rounded-[32px]" />
            <div className="xl:col-span-2 h-72 glass-card rounded-[32px]" />
          </div>
        </div>
      </div>
    );
  }

  /* ──── Error ──── */
  if (error) {
    return (
      <div className="glass-bg flex items-center justify-center min-h-[60vh]">
        <div className="glass-card rounded-[32px] p-10 text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="h-7 w-7 text-[#FF3B30]" />
          </div>
          <p className="text-[17px] font-semibold text-[#1D1D1F] mb-1">Erreur de chargement</p>
          <p className="text-[13px] text-[#86868B] mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => loadDashboard()}
            className="px-5 py-2.5 text-[14px] font-bold bg-[#1D1D1F] text-white rounded-2xl hover:bg-[#333] transition-all active:scale-[0.97]"
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
  const totalProducts = data.summary.totalProducts ?? 0;

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
    <div className="glass-bg space-y-10">
      <PageHeader
        title="Pilotage des Stocks"
        subtitle="Vue consolidée de la valorisation et des alertes critiques."
        icon={<Package className="w-5 h-5" />}
        showNotifications
        notificationCount={criticalCount}
        badge={
          criticalCount > 0
            ? { text: `${criticalCount} critique(s)`, variant: 'error' }
            : warningCount > 0
              ? { text: `${warningCount} à traiter`, variant: 'warning' }
              : { text: 'Live System', variant: 'success' }
        }
        actions={
          <div className="flex items-center gap-3">
            <Button
              onClick={() => loadDashboard(true)}
              disabled={isRefreshing}
              variant="outline"
              size="icon"
              className="rounded-2xl w-12 h-12"
            >
              <RefreshCw className={cn('h-[18px] w-[18px]', isRefreshing && 'animate-spin')} />
            </Button>
            <Button variant="amber" className="h-12 px-6 rounded-2xl">
              <Package size={18} className="mr-2" />
              + Nouvelle Réception
            </Button>
          </div>
        }
      />

      {/* ═══════════════════════════════════════════════
          KPI BAND PREMIUM — WITH SPARKLINES
      ═══════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title="Valorisation Stock"
          value={`${totalProducts || '—'} Produits`}
          subtitle="+12.5% vs M-1"
          icon={<Activity size={22} />}
          trend={{ value: 12.5 }}
          color="blue"
          sparklineData="M0 30 C 20 25, 40 35, 60 20 S 90 5, 120 2"
        />
        <StatCard
          title="Alertes Critiques"
          value={criticalCount}
          subtitle="Action immédiate"
          icon={<AlertTriangle size={22} />}
          trend={criticalCount > 0 ? { value: -1.2 } : { value: 0 }}
          color="red"
          sparklineData="M0 10 C 30 15, 50 5, 70 25 S 100 35, 120 30"
        />
        <StatCard
          title="Lots à risque (J-7)"
          value={warningCount}
          subtitle="Qualité à vérifier"
          icon={<Clock size={22} />}
          trend={warningCount > 0 ? { value: -2.1 } : { value: 0 }}
          color="amber"
          sparklineData="M0 20 C 20 20, 40 25, 60 15 S 90 10, 120 15"
        />
        <StatCard
          title="Score Santé"
          value={`${healthScore}%`}
          subtitle={healthScore >= 80 ? 'Objectif atteint' : 'À améliorer'}
          icon={<PackageOpen size={22} />}
          trend={{ value: 2.4 }}
          color="emerald"
          sparklineData="M0 35 C 30 30, 50 25, 70 15 S 100 5, 120 2"
        />
      </section>

      {/* ═══════════════════════════════════════════════
          BENTO GRID DÉCISIONNELLE
      ═══════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 xl:grid-cols-4 auto-rows-fr gap-6 min-h-[500px]">
        {/* Centre de Crise (2x2) */}
        <div id="zone-critique" className="xl:col-span-2 xl:row-span-2">
          <ZoneCritique data={data.critique} onAction={handleAction} />
        </div>

        {/* Flux Logistique (2x1) */}
        <div id="zone-atraiter" className="xl:col-span-2">
          <ZoneATraiter data={data.aTraiter} onAction={handleAction} />
        </div>

        {/* Index Santé (2x1) */}
        <div className="xl:col-span-2">
          <ZoneSante data={data.sante} summary={data.summary} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          QUICK NAV — Glass Card
      ═══════════════════════════════════════════════ */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-white/40">
          <p className="text-[12px] font-bold text-[#6E6E73] uppercase tracking-widest">Accès rapide</p>
        </div>
        <div className="divide-y divide-white/40">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center justify-between px-6 py-4 hover:bg-white/40 transition-all"
            >
              <span className="text-[14px] font-bold text-[#1D1D1F]">{link.label}</span>
              <ArrowRight className="w-4 h-4 text-[#C7C7CC] group-hover:text-[#EC7620] transition-all group-hover:translate-x-1" />
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
