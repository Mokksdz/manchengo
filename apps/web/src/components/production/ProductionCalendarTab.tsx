'use client';

import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarOrder {
  id: number;
  reference: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  productPf?: { name: string };
}

interface CalendarDay {
  date: string;
  dayName: string;
  orders: CalendarOrder[];
  totalOrders: number;
  pending: number;
  inProgress: number;
  completed: number;
}

const statusConfig = {
  PENDING: { label: 'En attente', color: 'bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/20', bg: 'bg-[#FF9500]' },
  IN_PROGRESS: { label: 'En cours', color: 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/20', bg: 'bg-[#007AFF]' },
  COMPLETED: { label: 'Termin\u00e9', color: 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20', bg: 'bg-[#34C759]' },
  CANCELLED: { label: 'Annul\u00e9', color: 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20', bg: 'bg-[#FF3B30]' },
};

interface ProductionCalendarTabProps {
  calendarData: CalendarDay[];
}

export function ProductionCalendarTab({ calendarData }: ProductionCalendarTabProps) {
  const router = useRouter();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#1D1D1F] flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#AF52DE]" />Planning de Production
        </h2>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-[#86868B]"><div className="w-3 h-3 bg-[#FF9500] rounded-full" /> En attente</span>
          <span className="flex items-center gap-1.5 text-sm text-[#86868B]"><div className="w-3 h-3 bg-[#007AFF] rounded-full" /> En cours</span>
          <span className="flex items-center gap-1.5 text-sm text-[#86868B]"><div className="w-3 h-3 bg-[#34C759] rounded-full" /> Termin\u00e9</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-4">
        {calendarData.map((day, i) => (
          <div key={day.date} className={cn('glass-card overflow-hidden', i === 0 ? 'ring-2 ring-[#AF52DE]/30' : '')}>
            <div className={cn('px-4 py-3 text-center', i === 0 ? 'bg-[#AF52DE]/10' : 'bg-black/[0.03]')}>
              <p className="text-[11px] text-[#86868B] uppercase tracking-wider font-medium">{day.dayName}</p>
              <p className="text-2xl font-bold mt-1 text-[#1D1D1F]">{new Date(day.date).getDate()}</p>
              <p className="text-xs text-[#AEAEB2]">{new Date(day.date).toLocaleDateString('fr-FR', { month: 'short' })}</p>
            </div>
            <div className="p-3 min-h-[200px] max-h-[300px] overflow-y-auto">
              {day.orders.length === 0 ? (
                <p className="text-center text-[#AEAEB2] text-sm py-4">Aucune production</p>
              ) : (
                <div className="space-y-2">
                  {day.orders.map((order) => {
                    const status = statusConfig[order.status as keyof typeof statusConfig];
                    return (
                      <div key={order.id} onClick={() => router.push(`/dashboard/production/order/${order.id}`)} className={cn('p-2.5 rounded-[12px] text-xs cursor-pointer backdrop-blur-sm hover:scale-[1.02] transition-transform', status.color)}>
                        <p className="font-mono font-medium">{order.reference}</p>
                        <p className="truncate text-[#6E6E73]">{order.productPf?.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <div className={cn('w-2 h-2 rounded-full', status.bg)} />
                          <span>{status.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-3 py-2 bg-black/[0.03] border-t border-black/[0.04] text-center">
              <span className="text-xs text-[#86868B]">{day.totalOrders} ordre{day.totalOrders !== 1 ? 's' : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
