'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Factory,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  ChevronRight,
  QrCode,
  Plus,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionOrder {
  id: number;
  reference: string;
  productName: string;
  productCode: string;
  quantity: number;
  quantityProduced: number;
  batchCount: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledDate: string | null;
  createdAt: string;
}

interface ProductionMobileViewProps {
  orders: ProductionOrder[];
  onNewProduction: () => void;
  onStartProduction?: (orderId: number) => void;
  onOpenScanner?: () => void;
}

const statusConfig = {
  PENDING: {
    label: 'En attente',
    icon: Clock,
    color: 'text-[#FF9500]',
    bgColor: 'bg-[#FF9500]/10',
    borderColor: 'border-[#FF9500]/20',
  },
  IN_PROGRESS: {
    label: 'En cours',
    icon: Play,
    color: 'text-[#007AFF]',
    bgColor: 'bg-[#007AFF]/10',
    borderColor: 'border-[#007AFF]/20',
  },
  COMPLETED: {
    label: 'Terminé',
    icon: CheckCircle,
    color: 'text-[#34C759]',
    bgColor: 'bg-[#34C759]/10',
    borderColor: 'border-[#34C759]/20',
  },
  CANCELLED: {
    label: 'Annulé',
    icon: XCircle,
    color: 'text-[#FF3B30]',
    bgColor: 'bg-[#FF3B30]/10',
    borderColor: 'border-[#FF3B30]/20',
  },
};

export function ProductionMobileView({
  orders,
  onNewProduction,
  onStartProduction,
  onOpenScanner,
}: ProductionMobileViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrer les ordres
  const filteredOrders = orders.filter((order) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' && order.status === 'PENDING') ||
      (filter === 'in_progress' && order.status === 'IN_PROGRESS');

    const matchesSearch =
      !searchQuery ||
      order.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.productCode.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Statistiques rapides
  const stats = {
    pending: orders.filter((o) => o.status === 'PENDING').length,
    inProgress: orders.filter((o) => o.status === 'IN_PROGRESS').length,
    todayCompleted: orders.filter(
      (o) =>
        o.status === 'COMPLETED' &&
        new Date(o.createdAt).toDateString() === new Date().toDateString()
    ).length,
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header Mobile */}
      <div className="sticky top-0 z-40 silicon-panel border-b border-white/70 safe-area-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 flex items-center justify-center">
                <Factory className="w-5 h-5 text-[#AF52DE]" />
              </div>
              <div>
                <h1 className="text-[17px] font-semibold text-[#1D1D1F]">Production</h1>
                <p className="text-[13px] text-[#86868B]">
                  {stats.inProgress} en cours
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {onOpenScanner && (
                <button
                  onClick={onOpenScanner}
                  className="w-10 h-10 rounded-full bg-[#1D1D1F] flex items-center justify-center"
                  aria-label="Scanner QR code"
                >
                  <QrCode className="w-5 h-5 text-white" />
                </button>
              )}
              <button
                onClick={onNewProduction}
                className="w-10 h-10 rounded-full bg-[#AF52DE] flex items-center justify-center shadow-lg shadow-[#AF52DE]/30"
                aria-label="Nouvelle production"
              >
                <Plus className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input
              type="search"
              placeholder="Rechercher un ordre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black/[0.04] rounded-[12px] text-[15px] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#AF52DE]/20"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { key: 'all', label: 'Tous', count: orders.length },
            { key: 'pending', label: 'En attente', count: stats.pending },
            { key: 'in_progress', label: 'En cours', count: stats.inProgress },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-medium transition-all flex items-center gap-2',
                filter === tab.key
                  ? 'bg-[#1D1D1F] text-white'
                  : 'bg-black/[0.04] text-[#86868B]'
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[11px]',
                  filter === tab.key
                    ? 'bg-white/20 text-white'
                    : 'bg-black/[0.06] text-[#86868B]'
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="px-4 py-4 grid grid-cols-3 gap-3">
        <div className="glass-card rounded-[16px] p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-[#FF9500]" />
            <span className="text-[11px] text-[#86868B]">En attente</span>
          </div>
          <p className="text-2xl font-bold text-[#1D1D1F]">{stats.pending}</p>
        </div>

        <div className="glass-card rounded-[16px] p-3">
          <div className="flex items-center gap-2 mb-1">
            <Play className="w-4 h-4 text-[#007AFF]" />
            <span className="text-[11px] text-[#86868B]">En cours</span>
          </div>
          <p className="text-2xl font-bold text-[#1D1D1F]">{stats.inProgress}</p>
        </div>

        <div className="glass-card rounded-[16px] p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-[#34C759]" />
            <span className="text-[11px] text-[#86868B]">Aujourd'hui</span>
          </div>
          <p className="text-2xl font-bold text-[#34C759]">{stats.todayCompleted}</p>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="glass-card rounded-[20px] p-8 text-center">
            <Package className="w-12 h-12 text-[#AEAEB2] mx-auto mb-3" />
            <p className="text-[15px] font-medium text-[#1D1D1F] mb-1">
              Aucun ordre trouvé
            </p>
            <p className="text-[13px] text-[#86868B]">
              {searchQuery
                ? 'Essayez une autre recherche'
                : 'Créez un nouvel ordre de production'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const status = statusConfig[order.status];
            const StatusIcon = status.icon;
            const progress =
              order.quantity > 0
                ? (order.quantityProduced / order.quantity) * 100
                : 0;

            return (
              <div
                key={order.id}
                onClick={() => router.push(`/dashboard/production/order/${order.id}`)}
                className={cn(
                  'glass-card rounded-[20px] p-4 active:scale-[0.98] transition-transform cursor-pointer',
                  status.borderColor
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[13px] font-semibold text-[#AF52DE]">
                        {order.reference}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1',
                          status.bgColor,
                          status.color
                        )}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    <p className="text-[15px] font-medium text-[#1D1D1F]">
                      {order.productName}
                    </p>
                    <p className="text-[13px] text-[#86868B]">{order.productCode}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#AEAEB2]" />
                </div>

                {/* Progress Bar (for IN_PROGRESS) */}
                {order.status === 'IN_PROGRESS' && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="text-[#86868B]">Progression</span>
                      <span className="font-semibold text-[#1D1D1F]">
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-black/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#007AFF] rounded-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-black/[0.04]">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[11px] text-[#86868B]">Quantité</p>
                      <p className="text-[13px] font-semibold text-[#1D1D1F]">
                        {order.quantityProduced}/{order.quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#86868B]">Batchs</p>
                      <p className="text-[13px] font-semibold text-[#1D1D1F]">
                        {order.batchCount}
                      </p>
                    </div>
                    {order.scheduledDate && (
                      <div>
                        <p className="text-[11px] text-[#86868B]">Planifié</p>
                        <p className="text-[13px] font-semibold text-[#1D1D1F]">
                          {formatDate(order.scheduledDate)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Quick Action */}
                  {order.status === 'PENDING' && onStartProduction && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartProduction(order.id);
                      }}
                      className="px-4 py-2 bg-[#34C759] text-white rounded-full text-[13px] font-medium flex items-center gap-1.5 shadow-sm"
                    >
                      <Play className="w-4 h-4" />
                      Démarrer
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 safe-area-bottom">
        <button
          onClick={onNewProduction}
          className="w-14 h-14 rounded-full bg-[#AF52DE] flex items-center justify-center shadow-lg shadow-[#AF52DE]/40 active:scale-95 transition-transform"
          aria-label="Nouvelle production"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
}

// Hook pour détecter le mode mobile/tablette
export function useIsMobile() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

export function useIsTablet() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 768 && window.innerWidth < 1024;
}
