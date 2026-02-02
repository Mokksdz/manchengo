'use client';

import { useRouter } from 'next/navigation';
import { Factory, Clock, CheckCircle, Play, XCircle, Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionOrder {
  id: number;
  reference: string;
  productName: string;
  quantity: number;
  quantityProduced: number;
  batchCount: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  user: string;
}

const statusConfig = {
  PENDING: { label: 'En attente', color: 'text-amber-600', dot: 'bg-amber-500', icon: Clock, bar: 'bg-amber-500' },
  IN_PROGRESS: { label: 'En cours', color: 'text-blue-600', dot: 'bg-blue-500', icon: Play, bar: 'bg-blue-500' },
  COMPLETED: { label: 'Termin\u00e9', color: 'text-emerald-600', dot: 'bg-emerald-500', icon: CheckCircle, bar: 'bg-emerald-500' },
  CANCELLED: { label: 'Annul\u00e9', color: 'text-red-600', dot: 'bg-red-500', icon: XCircle, bar: 'bg-red-500' },
};

const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

interface ProductionOrdersTabProps {
  orders: ProductionOrder[];
  filter: 'all' | 'pending' | 'in_progress' | 'completed';
  onFilterChange: (filter: 'all' | 'pending' | 'in_progress' | 'completed') => void;
  onNewProduction: () => void;
}

export function ProductionOrdersTab({ orders, filter, onFilterChange, onNewProduction }: ProductionOrdersTabProps) {
  const router = useRouter();

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'PENDING').length,
    inProgress: orders.filter((o) => o.status === 'IN_PROGRESS').length,
    completed: orders.filter((o) => o.status === 'COMPLETED').length,
  };

  const filteredOrders = orders.filter((o) =>
    filter === 'all' ||
    (filter === 'pending' && o.status === 'PENDING') ||
    (filter === 'in_progress' && o.status === 'IN_PROGRESS') ||
    (filter === 'completed' && o.status === 'COMPLETED')
  );

  return (
    <div className="p-6">
      {/* Header: filters + action button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Tous', count: stats.total },
            { key: 'pending', label: 'En attente', count: stats.pending },
            { key: 'in_progress', label: 'En cours', count: stats.inProgress },
            { key: 'completed', label: 'Termin\u00e9s', count: stats.completed }
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key as typeof filter)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all',
                filter === f.key
                  ? 'bg-[#1D1D1F] text-white'
                  : 'glass-pill text-[#86868B] hover:bg-white/60'
              )}
            >
              {f.label}
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-xs font-medium',
                  filter === f.key ? 'bg-white/20 text-white' : 'bg-black/[0.04] text-[#86868B]'
                )}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={onNewProduction}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#AF52DE] text-white rounded-full hover:bg-[#9B3DC8] font-medium transition-all shadow-lg shadow-[#AF52DE]/25"
        >
          <Zap className="w-5 h-5" /> Nouvelle production
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 rounded-xl flex items-center justify-center">
              <Factory className="w-5 h-5 text-[#AF52DE]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1D1D1F]">{stats.total}</p>
              <p className="text-sm text-[#86868B]">Total</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1D1D1F]">{stats.pending}</p>
              <p className="text-sm text-[#86868B]">En attente</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl flex items-center justify-center">
              <Play className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1D1D1F]">{stats.inProgress}</p>
              <p className="text-sm text-[#86868B]">En cours</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1D1D1F]">{stats.completed}</p>
              <p className="text-sm text-[#86868B]">Termin\u00e9s</p>
            </div>
          </div>
        </div>
      </div>

      {/* Order list */}
      <div className="space-y-3">
        {filteredOrders.map((order) => {
          const status = statusConfig[order.status];
          const StatusIcon = status.icon;
          const progress = order.quantity > 0 ? (order.quantityProduced / order.quantity) * 100 : 0;
          return (
            <div
              key={order.id}
              onClick={() => router.push(`/dashboard/production/order/${order.id}`)}
              className="glass-card-hover p-4 hover:bg-white/40 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 rounded-xl flex items-center justify-center">
                    <StatusIcon className={cn('w-6 h-6', status.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold text-[#AF52DE]">{order.reference}</span>
                      <span className="glass-pill px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5">
                        <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
                        <span className={status.color}>{status.label}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-medium text-[#1D1D1F]">{order.productName}</span>
                      <span className="text-[#AEAEB2]">&bull;</span>
                      <span className="text-sm text-[#86868B]">{order.batchCount} batch</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{order.quantityProduced}</span>
                      <span className="text-[#AEAEB2]">/</span>
                      <span className="text-[#86868B]">{order.quantity}</span>
                    </div>
                    {order.status !== 'PENDING' && order.status !== 'CANCELLED' && (
                      <div className="w-24 h-1.5 bg-black/[0.04] rounded-full mt-1">
                        <div
                          className={cn('h-full rounded-full', status.bar)}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-[#86868B]">{formatDate(order.createdAt)}</p>
                    <p className="text-[#AEAEB2]">{order.user}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#AEAEB2]" />
                </div>
              </div>
            </div>
          );
        })}
        {filteredOrders.length === 0 && (
          <div className="text-center py-16">
            <Factory className="w-12 h-12 text-[#D1D1D6] mx-auto mb-4" />
            <p className="text-[#86868B]">Aucun ordre de production</p>
          </div>
        )}
      </div>
    </div>
  );
}
