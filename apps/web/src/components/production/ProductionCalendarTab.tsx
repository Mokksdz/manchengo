'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight, Plus, GripVertical, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api';

interface ProductPf {
  id: number;
  code: string;
  name: string;
  unit: string;
  hasRecipe: boolean;
  recipeId: number | null;
  recipeItemsCount: number;
  recipeBatchWeight: number;
  recipeOutputQty: number;
  recipeShelfLife: number;
}

interface PlannedOrder {
  id: number;
  reference: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  productPf: { id: number; code: string; name: string };
  recipe: { id: number; name: string; outputQuantity: number } | null;
  batchCount: number;
  targetQuantity: number;
  scheduledDate: string | null;
  canStart?: boolean;
  stockStatus?: 'ok' | 'warning' | 'critical';
}

interface WeekDay {
  date: Date;
  dateStr: string;
  isToday: boolean;
  orders: PlannedOrder[];
}

const statusConfig = {
  PENDING: { label: 'En attente', color: 'bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/20', bg: 'bg-[#FF9500]' },
  IN_PROGRESS: { label: 'En cours', color: 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/20', bg: 'bg-[#007AFF]' },
  COMPLETED: { label: 'Terminé', color: 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20', bg: 'bg-[#34C759]' },
  CANCELLED: { label: 'Annulé', color: 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20', bg: 'bg-[#FF3B30]' },
};

const stockIndicator = {
  ok: { icon: CheckCircle, color: 'text-emerald-500', label: 'Stock OK' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', label: 'Stock limité' },
  critical: { icon: AlertTriangle, color: 'text-red-500', label: 'Rupture' },
};

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface ProductionCalendarTabProps {
  products: ProductPf[];
  onOpenWizard: (date: string | null) => void;
}

export function ProductionCalendarTab({ products: _products, onOpenWizard }: ProductionCalendarTabProps) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [unscheduledOrders, setUnscheduledOrders] = useState<PlannedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedOrder, setDraggedOrder] = useState<PlannedOrder | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Calculer le début de la semaine (lundi)
  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
  }

  // Générer les jours de la semaine
  function generateWeekDays(start: Date): WeekDay[] {
    const days: WeekDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      days.push({
        date,
        dateStr: date.toISOString().split('T')[0],
        isToday: date.getTime() === today.getTime(),
        orders: [],
      });
    }
    return days;
  }

  // Formater la date pour l'affichage
  const formatWeekRange = (start: Date): string => {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startStr = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const endStr = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  // Navigation semaine
  const goToPreviousWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
  };

  const goToToday = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  // Charger le planning de la semaine
  const loadWeeklyPlan = useCallback(async () => {
    setIsLoading(true);
    try {
      const startDateStr = weekStart.toISOString().split('T')[0];
      const res = await authFetch(`/production/planning/week?startDate=${startDateStr}`, { credentials: 'include' });

      if (res.ok) {
        const data = await res.json();
        const days = generateWeekDays(weekStart);

        // Séparer les ordres planifiés des non-planifiés
        const unscheduled: PlannedOrder[] = [];

        data.orders.forEach((order: PlannedOrder) => {
          if (order.scheduledDate) {
            const orderDate = order.scheduledDate.split('T')[0];
            const dayIndex = days.findIndex(d => d.dateStr === orderDate);
            if (dayIndex !== -1) {
              days[dayIndex].orders.push(order);
            }
          } else if (order.status === 'PENDING') {
            unscheduled.push(order);
          }
        });

        setWeekDays(days);
        setUnscheduledOrders(unscheduled);
      }
    } catch (error) {
      console.error('Error loading weekly plan:', error);
    } finally {
      setIsLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadWeeklyPlan();
  }, [loadWeeklyPlan]);

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, order: PlannedOrder) => {
    if (order.status !== 'PENDING') return;
    setDraggedOrder(order);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', order.id.toString());
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string | null) => {
    e.preventDefault();
    if (draggedOrder && draggedOrder.status === 'PENDING') {
      setDropTarget(dateStr);
    }
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, dateStr: string | null) => {
    e.preventDefault();
    setDropTarget(null);

    if (!draggedOrder || draggedOrder.status !== 'PENDING') {
      setDraggedOrder(null);
      return;
    }

    try {
      const res = await authFetch(`/production/${draggedOrder.id}/schedule`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: dateStr }),
      });

      if (res.ok) {
        await loadWeeklyPlan();
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
    }

    setDraggedOrder(null);
  };

  const handleDragEnd = () => {
    setDraggedOrder(null);
    setDropTarget(null);
  };

  // Rendu d'une carte de production
  const renderOrderCard = (order: PlannedOrder, draggable: boolean = true) => {
    const status = statusConfig[order.status as keyof typeof statusConfig];
    const canDrag = draggable && order.status === 'PENDING';
    const StockIcon = order.stockStatus ? stockIndicator[order.stockStatus].icon : null;

    return (
      <div
        key={order.id}
        draggable={canDrag}
        onDragStart={(e) => handleDragStart(e, order)}
        onDragEnd={handleDragEnd}
        onClick={() => router.push(`/dashboard/production/order/${order.id}`)}
        className={cn(
          'p-2.5 rounded-[12px] text-xs cursor-pointer backdrop-blur-sm transition-all group',
          status.color,
          canDrag && 'hover:shadow-md',
          draggedOrder?.id === order.id && 'opacity-50'
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <p className="font-mono font-medium truncate">{order.reference}</p>
            <p className="truncate text-[#6E6E73]">{order.productPf?.name}</p>
          </div>
          {canDrag && (
            <GripVertical className="w-4 h-4 text-current/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1">
            <div className={cn('w-2 h-2 rounded-full', status.bg)} />
            <span>{order.batchCount} batch{order.batchCount > 1 ? 's' : ''}</span>
          </div>
          {StockIcon && (
            <StockIcon className={cn('w-3.5 h-3.5', stockIndicator[order.stockStatus!].color)} />
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-[#AF52DE] border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header avec navigation */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#1D1D1F] flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#AF52DE]" />
          Planning de Production
        </h2>

        <div className="flex items-center gap-3">
          <button
            onClick={goToPreviousWeek}
            className="p-2 rounded-[10px] glass-card hover:bg-white/60 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#1D1D1F]" />
          </button>

          <span className="text-[15px] font-semibold text-[#1D1D1F] min-w-[200px] text-center">
            {formatWeekRange(weekStart)}
          </span>

          <button
            onClick={goToNextWeek}
            className="p-2 rounded-[10px] glass-card hover:bg-white/60 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-[#1D1D1F]" />
          </button>

          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-[13px] font-medium text-[#AF52DE] glass-card rounded-[10px] hover:bg-[#AF52DE]/10 transition-colors"
          >
            Aujourd'hui
          </button>
        </div>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 mb-4">
        <span className="flex items-center gap-1.5 text-sm text-[#86868B]">
          <div className="w-3 h-3 bg-[#FF9500] rounded-full" /> En attente
        </span>
        <span className="flex items-center gap-1.5 text-sm text-[#86868B]">
          <div className="w-3 h-3 bg-[#007AFF] rounded-full" /> En cours
        </span>
        <span className="flex items-center gap-1.5 text-sm text-[#86868B]">
          <div className="w-3 h-3 bg-[#34C759] rounded-full" /> Terminé
        </span>
        <div className="flex-1" />
        <span className="flex items-center gap-1.5 text-sm text-[#86868B]">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Stock OK
        </span>
        <span className="flex items-center gap-1.5 text-sm text-[#86868B]">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Limité
        </span>
        <span className="flex items-center gap-1.5 text-sm text-[#86868B]">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Rupture
        </span>
      </div>

      {/* Grille de la semaine */}
      <div className="grid grid-cols-7 gap-3">
        {weekDays.map((day) => (
          <div
            key={day.dateStr}
            onDragOver={(e) => handleDragOver(e, day.dateStr)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, day.dateStr)}
            className={cn(
              'glass-card overflow-hidden transition-all',
              day.isToday && 'ring-2 ring-[#AF52DE]/40',
              dropTarget === day.dateStr && 'ring-2 ring-[#007AFF] bg-[#007AFF]/5'
            )}
          >
            {/* En-tête du jour */}
            <div className={cn('px-3 py-2.5 text-center', day.isToday ? 'bg-[#AF52DE]/10' : 'bg-black/[0.03]')}>
              <p className="text-[11px] text-[#86868B] uppercase tracking-wider font-medium">
                {DAY_NAMES[day.date.getDay() === 0 ? 6 : day.date.getDay() - 1]}
              </p>
              <p className={cn('text-xl font-bold mt-0.5', day.isToday ? 'text-[#AF52DE]' : 'text-[#1D1D1F]')}>
                {day.date.getDate()}
              </p>
              <p className="text-[11px] text-[#AEAEB2]">
                {day.date.toLocaleDateString('fr-FR', { month: 'short' })}
              </p>
            </div>

            {/* Liste des productions */}
            <div className="p-2 min-h-[180px] max-h-[280px] overflow-y-auto">
              {day.orders.length === 0 ? (
                <p className="text-center text-[#AEAEB2] text-[12px] py-6">Aucune production</p>
              ) : (
                <div className="space-y-2">
                  {day.orders.map((order) => renderOrderCard(order))}
                </div>
              )}
            </div>

            {/* Bouton ajouter */}
            <div className="px-2 pb-2">
              <button
                onClick={() => onOpenWizard(day.dateStr)}
                className="w-full py-2 rounded-[10px] border border-dashed border-black/[0.08] text-[#86868B] hover:border-[#AF52DE]/40 hover:text-[#AF52DE] hover:bg-[#AF52DE]/5 transition-all flex items-center justify-center gap-1.5 text-[12px] font-medium"
              >
                <Plus className="w-4 h-4" />
                Planifier
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Productions non planifiées */}
      {unscheduledOrders.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-[#86868B]" />
            <h3 className="text-[15px] font-semibold text-[#1D1D1F]">
              Non planifiées ({unscheduledOrders.length})
            </h3>
            <span className="text-[12px] text-[#86868B]">— Glissez sur un jour pour planifier</span>
          </div>

          <div
            onDragOver={(e) => handleDragOver(e, null)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null)}
            className={cn(
              'glass-card rounded-[14px] p-3 transition-all',
              dropTarget === null && draggedOrder && 'ring-2 ring-[#FF9500] bg-[#FF9500]/5'
            )}
          >
            <div className="flex flex-wrap gap-2">
              {unscheduledOrders.map((order) => (
                <div key={order.id} className="w-[180px]">
                  {renderOrderCard(order)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
