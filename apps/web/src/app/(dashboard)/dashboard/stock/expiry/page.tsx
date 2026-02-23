'use client';

import { useEffect, useState, useCallback } from 'react';
import { stockDashboard, ExpiryStats } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Clock,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Lock,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

const log = createLogger('StockExpiry');

const defaultData: ExpiryStats = {
  stats: { expiredBlocked: 0, expiringJ1: 0, expiringJ3: 0, expiringJ7: 0 },
  summary: { totalAtRisk: 0, valueAtRisk: 0 },
  lots: [],
};

export default function ExpiryPage() {
  const [data, setData] = useState<ExpiryStats>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await stockDashboard.getExpiryStats();
      if (response.success) {
        setData(response.data);
        setError(null);
      }
    } catch (err) {
      setError('Erreur de chargement');
      log.error('Failed to load expiry data', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  if (isLoading) {
    return (
      <div className="glass-bg flex items-center justify-center h-96">
        <div className="glass-card flex flex-col items-center gap-3 p-8">
          <div className="w-8 h-8 border-[3px] border-[#E5E5EA] border-t-[#1D1D1F] rounded-full animate-spin" />
          <p className="text-[12px] text-[#86868B]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-bg flex flex-col items-center justify-center h-96">
        <div className="glass-card flex flex-col items-center p-8">
          <div className="w-12 h-12 bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5 rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="h-6 w-6 text-[#FF3B30]" />
          </div>
          <p className="text-[14px] font-medium text-[#1D1D1F] mb-1">Erreur de chargement</p>
          <p className="text-[12px] text-[#86868B] mb-4">{error}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-[#333336] transition-all font-medium text-[13px]"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const stats = data.stats ?? { expiredBlocked: 0, expiringJ1: 0, expiringJ3: 0, expiringJ7: 0 };
  const summary = data.summary ?? { totalAtRisk: 0, valueAtRisk: 0 };
  const lots = data.lots ?? [];

  return (
    <div className="glass-bg space-y-6">
      <PageHeader
        title="Gestion DLC / Expiration"
        subtitle="Suivi des lots par date de péremption"
        icon={<Clock className="w-5 h-5" />}
        badge={
          stats.expiredBlocked > 0
            ? { text: `${stats.expiredBlocked} expiré(s)`, variant: 'error' }
            : stats.expiringJ1 > 0
              ? { text: `${stats.expiringJ1} à J-1`, variant: 'warning' }
              : { text: 'Sous contrôle', variant: 'success' }
        }
        actions={
          <Button onClick={loadData} variant="outline" size="icon" className="rounded-full">
            <RefreshCw className="w-4 h-4" />
          </Button>
        }
      />

      {/* ─── KPI Strip ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold text-[#86868B] uppercase tracking-widest">Expirés (bloqués)</p>
              <p className="font-display text-[34px] font-black text-[#1D1D1F] tracking-tight tabular-nums leading-none mt-1">{stats.expiredBlocked}</p>
            </div>
            <div className="flex items-center gap-2">
              {stats.expiredBlocked > 0 && <span className="w-2 h-2 rounded-full bg-[#FF3B30]" />}
              <div className="w-10 h-10 bg-gradient-to-br from-[#8E8E93]/10 to-[#8E8E93]/5 rounded-[14px] flex items-center justify-center">
                <Lock className="w-5 h-5 text-[#8E8E93]" />
              </div>
            </div>
          </div>
        </div>
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold text-[#86868B] uppercase tracking-widest">Expire demain</p>
              <p className="font-display text-[34px] font-black text-[#1D1D1F] tracking-tight tabular-nums leading-none mt-1">{stats.expiringJ1}</p>
            </div>
            <div className="flex items-center gap-2">
              {stats.expiringJ1 > 0 && <span className="w-2 h-2 rounded-full bg-[#FF3B30]" />}
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5 rounded-[14px] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#FF3B30]" />
              </div>
            </div>
          </div>
        </div>
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold text-[#86868B] uppercase tracking-widest">Expire sous 3j</p>
              <p className="font-display text-[34px] font-black text-[#1D1D1F] tracking-tight tabular-nums leading-none mt-1">{stats.expiringJ3}</p>
            </div>
            <div className="flex items-center gap-2">
              {stats.expiringJ3 > 0 && <span className="w-2 h-2 rounded-full bg-[#FF9500]" />}
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 rounded-[14px] flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#FF9500]" />
              </div>
            </div>
          </div>
        </div>
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold text-[#86868B] uppercase tracking-widest">Expire sous 7j</p>
              <p className="font-display text-[34px] font-black text-[#1D1D1F] tracking-tight tabular-nums leading-none mt-1">{stats.expiringJ7}</p>
            </div>
            <div className="flex items-center gap-2">
              {stats.expiringJ7 > 0 && <span className="w-2 h-2 rounded-full bg-[#FF9500]" />}
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 rounded-[14px] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#FF9500]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Risk Summary ─── */}
      <div className="glass-card p-6">
        <h2 className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wide mb-4">Résumé des risques</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-gradient-to-br from-[#8E8E93]/[0.06] to-[#8E8E93]/[0.02] rounded-xl">
            <div className="text-[12px] text-[#86868B] mb-1">Lots à risque</div>
            <div className="font-display text-[34px] font-black text-[#1D1D1F] tracking-tight tabular-nums leading-none">{summary.totalAtRisk}</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-[#8E8E93]/[0.06] to-[#8E8E93]/[0.02] rounded-xl">
            <div className="text-[12px] text-[#86868B] mb-1">Valeur à risque</div>
            <div className="font-display text-[34px] font-black text-[#1D1D1F] tracking-tight tabular-nums leading-none">
              {new Intl.NumberFormat('fr-DZ', {
                style: 'currency',
                currency: 'DZD',
                maximumFractionDigits: 0,
              }).format(summary.valueAtRisk)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Lots List ─── */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.04] flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wide">
            Lots par date d&apos;expiration
          </h2>
          <span className="glass-pill px-2.5 py-1 text-[12px] text-[#86868B]">{lots.length} lot(s)</span>
        </div>
        <div className="p-6">
          {lots.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gradient-to-br from-[#C7C7CC]/10 to-[#C7C7CC]/5 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="h-6 w-6 text-[#C7C7CC]" />
              </div>
              <p className="text-[14px] font-medium text-[#86868B]">Aucun lot à risque</p>
              <p className="text-[12px] text-[#C7C7CC] mt-1">Tous les lots sont dans les délais</p>
            </div>
          ) : (
            <div className="space-y-2 divide-y divide-black/[0.03]">
              {lots.map((lot) => (
                <div
                  key={lot.id}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-white/40 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'w-2 h-2 rounded-full',
                        lot.daysUntilExpiry <= 0 ? 'bg-[#FF3B30]' :
                        lot.daysUntilExpiry <= 3 ? 'bg-[#FF9500]' :
                        'bg-[#FF9500]'
                      )} />
                      <span className="font-semibold text-[14px] text-[#1D1D1F]">{lot.lotNumber}</span>
                    </div>
                    <div className="text-[13px] text-[#86868B] mt-0.5">{lot.productName}</div>
                    <div className="text-[12px] text-[#C7C7CC] mt-1">
                      Qté: <strong className="text-[#86868B]">{lot.quantity}</strong> · DLC: <strong className="text-[#86868B]">{new Date(lot.expiryDate).toLocaleDateString('fr-FR')}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="glass-pill inline-flex items-center gap-1.5 px-2.5 py-1">
                      <span className={cn(
                        'w-2 h-2 rounded-full',
                        lot.daysUntilExpiry <= 0 ? 'bg-[#FF3B30]' :
                        lot.daysUntilExpiry <= 3 ? 'bg-[#FF9500]' :
                        'bg-[#FF9500]'
                      )} />
                      <span className={cn(
                        'text-[12px] font-semibold',
                        lot.daysUntilExpiry <= 0 ? 'text-[#FF3B30]' :
                        lot.daysUntilExpiry <= 3 ? 'text-[#FF9500]' :
                        'text-[#FF9500]'
                      )}>
                        {lot.daysUntilExpiry <= 0
                          ? 'EXPIRÉ'
                          : lot.daysUntilExpiry === 1
                          ? 'J-1'
                          : `J-${lot.daysUntilExpiry}`}
                      </span>
                    </span>
                    {lot.daysUntilExpiry <= 3 && lot.daysUntilExpiry > 0 && (
                      <button
                        disabled
                        title="Fonctionnalité bientôt disponible"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-[#1D1D1F] text-white rounded-full opacity-50 cursor-not-allowed transition-all"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Bientôt disponible
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
