'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/api';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProductionOrder {
  id: number;
  reference: string;
  productPfId: number;
  productName: string;
  productCode: string;
  quantity: number;
  quantityProduced: number;
  batchCount: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  yieldPercentage: number | null;
  scheduledDate: string | null;
  createdAt: string;
  user: string;
}

export interface ProductPf {
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

export interface DashboardKpis {
  today: { completed: number; inProgress: number; pending: number; totalProduced: number };
  week: { completed: number; totalProduced: number; avgYield: number; lowYieldCount: number };
  month: { completed: number; totalProduced: number };
  activeOrders: number;
  blockedOrders: number;
}

export interface ProductionAlert {
  id: string;
  type: 'DLC_PROCHE' | 'RENDEMENT_FAIBLE' | 'ORDRE_BLOQUE' | 'STOCK_PF_BAS';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  link?: string;
  data?: unknown;
  createdAt: string;
}

export interface AlertsData {
  total: number;
  critical: number;
  warning: number;
  alerts: ProductionAlert[];
}

export interface StockPfItem {
  id: number;
  code: string;
  name: string;
  unit: string;
  minStock: number;
  currentStock: number;
  status: 'ok' | 'bas' | 'rupture';
  coverage: number;
  recipe: { id: number; name: string; outputQuantity: number } | null;
}

export interface CalendarDay {
  date: string;
  dayName: string;
  orders: unknown[];
  totalOrders: number;
  pending: number;
  inProgress: number;
  completed: number;
}

export interface AnalyticsData {
  period: string;
  summary: { totalOrders: number; totalProduced: number; avgYield: number };
  trend: { date: string; quantity: number; orders: number; avgYield: number }[];
  topProducts: { product: { id: number; code: string; name: string }; quantity: number; orders: number }[];
}

export interface WeeklyPlanData {
  orders: ProductionOrder[];
  weekStart: string;
  weekEnd: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════════════════════

export const productionKeys = {
  all: ['production'] as const,
  orders: () => [...productionKeys.all, 'orders'] as const,
  order: (id: number) => [...productionKeys.orders(), id] as const,
  products: () => [...productionKeys.all, 'products'] as const,
  kpis: () => [...productionKeys.all, 'kpis'] as const,
  alerts: () => [...productionKeys.all, 'alerts'] as const,
  stockPf: () => [...productionKeys.all, 'stock-pf'] as const,
  calendar: () => [...productionKeys.all, 'calendar'] as const,
  weeklyPlan: (startDate: string) => [...productionKeys.all, 'weekly-plan', startDate] as const,
  analytics: (period: string) => [...productionKeys.all, 'analytics', period] as const,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS - QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook pour récupérer les ordres de production
 */
export function useProductionOrders(limit = 100) {
  return useQuery({
    queryKey: productionKeys.orders(),
    queryFn: async () => {
      const res = await authFetch(`/production?limit=${limit}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur chargement ordres');
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data.map((o: any) => ({
        id: o.id,
        reference: o.reference,
        productPfId: o.productPfId,
        productName: o.productPf?.name || 'Produit',
        productCode: o.productPf?.code || '-',
        quantity: o.targetQuantity || 0,
        quantityProduced: o.quantityProduced || 0,
        batchCount: o.batchCount || 1,
        status: o.status,
        yieldPercentage: o.yieldPercentage,
        scheduledDate: o.scheduledDate,
        createdAt: o.createdAt,
        user: o.user ? `${o.user.firstName} ${o.user.lastName}` : '-',
      })) as ProductionOrder[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook pour récupérer les produits finis avec recettes
 */
export function useProductsPf() {
  return useQuery({
    queryKey: productionKeys.products(),
    queryFn: async () => {
      const [productsRes, recipesRes] = await Promise.all([
        authFetch('/products/pf', { credentials: 'include' }),
        authFetch('/recipes', { credentials: 'include' }),
      ]);
      if (!productsRes.ok) throw new Error('Erreur chargement produits');

      const productsData = await productsRes.json();
      const recipesData = recipesRes.ok ? await recipesRes.json() : [];
      const recipeMap = new Map();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recipesData.forEach((r: any) => recipeMap.set(r.productPfId, r));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return productsData.map((p: any) => {
        const recipe = recipeMap.get(p.id);
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          unit: p.unit,
          hasRecipe: !!recipe,
          recipeId: recipe?.id || null,
          recipeItemsCount: recipe?.items?.length || 0,
          recipeBatchWeight: recipe?.batchWeight || 0,
          recipeOutputQty: recipe?.outputQuantity || 0,
          recipeShelfLife: recipe?.shelfLifeDays || 0,
        };
      }) as ProductPf[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook pour récupérer les KPIs du dashboard
 */
export function useProductionKpis() {
  return useQuery({
    queryKey: productionKeys.kpis(),
    queryFn: async () => {
      const res = await authFetch('/production/dashboard/kpis', { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur chargement KPIs');
      return res.json() as Promise<DashboardKpis>;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook pour récupérer les alertes production
 */
export function useProductionAlerts() {
  return useQuery({
    queryKey: productionKeys.alerts(),
    queryFn: async () => {
      const res = await authFetch('/production/dashboard/alerts', { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur chargement alertes');
      return res.json() as Promise<AlertsData>;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook pour récupérer le stock PF
 */
export function useStockPf() {
  return useQuery({
    queryKey: productionKeys.stockPf(),
    queryFn: async () => {
      const res = await authFetch('/production/dashboard/stock-pf', { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur chargement stock PF');
      return res.json() as Promise<StockPfItem[]>;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook pour récupérer le calendrier
 */
export function useProductionCalendar() {
  return useQuery({
    queryKey: productionKeys.calendar(),
    queryFn: async () => {
      const res = await authFetch('/production/dashboard/calendar', { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur chargement calendrier');
      const data = await res.json();
      return (data.days || []) as CalendarDay[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook pour récupérer le planning hebdomadaire
 */
export function useWeeklyPlan(startDate: string) {
  return useQuery({
    queryKey: productionKeys.weeklyPlan(startDate),
    queryFn: async () => {
      const res = await authFetch(`/production/planning/week?startDate=${startDate}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur chargement planning');
      return res.json() as Promise<WeeklyPlanData>;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook pour récupérer les analytics
 */
export function useProductionAnalytics(period: 'week' | 'month' | 'year') {
  return useQuery({
    queryKey: productionKeys.analytics(period),
    queryFn: async () => {
      const res = await authFetch(`/production/dashboard/analytics?period=${period}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur chargement analytics');
      return res.json() as Promise<AnalyticsData>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS - MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface CreateProductionOrderInput {
  productPfId: number;
  batchCount: number;
  scheduledDate?: string | null;
  notes?: string;
}

/**
 * Hook pour créer un ordre de production
 */
export function useCreateProductionOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductionOrderInput) => {
      const res = await authFetch('/production', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur création ordre');
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalider les queries liées
      queryClient.invalidateQueries({ queryKey: productionKeys.orders() });
      queryClient.invalidateQueries({ queryKey: productionKeys.kpis() });
      queryClient.invalidateQueries({ queryKey: productionKeys.calendar() });
      queryClient.invalidateQueries({ queryKey: productionKeys.all });
    },
  });
}

/**
 * Hook pour démarrer une production
 */
export function useStartProduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: number) => {
      const res = await authFetch(`/production/${orderId}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur démarrage');
      }
      return res.json();
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: productionKeys.order(orderId) });
      queryClient.invalidateQueries({ queryKey: productionKeys.orders() });
      queryClient.invalidateQueries({ queryKey: productionKeys.kpis() });
    },
  });
}

/**
 * Hook pour compléter une production
 */
export function useCompleteProduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, quantityProduced }: { orderId: number; quantityProduced: number }) => {
      const res = await authFetch(`/production/${orderId}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityProduced }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur complétion');
      }
      return res.json();
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: productionKeys.order(orderId) });
      queryClient.invalidateQueries({ queryKey: productionKeys.orders() });
      queryClient.invalidateQueries({ queryKey: productionKeys.kpis() });
      queryClient.invalidateQueries({ queryKey: productionKeys.stockPf() });
    },
  });
}

/**
 * Hook pour annuler une production
 */
export function useCancelProduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: number; reason?: string }) => {
      const res = await authFetch(`/production/${orderId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur annulation');
      }
      return res.json();
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: productionKeys.order(orderId) });
      queryClient.invalidateQueries({ queryKey: productionKeys.orders() });
      queryClient.invalidateQueries({ queryKey: productionKeys.kpis() });
    },
  });
}

/**
 * Hook pour mettre à jour la date planifiée
 */
export function useUpdateScheduledDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, scheduledDate }: { orderId: number; scheduledDate: string | null }) => {
      const res = await authFetch(`/production/${orderId}/schedule`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur mise à jour planning');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productionKeys.orders() });
      queryClient.invalidateQueries({ queryKey: productionKeys.calendar() });
      queryClient.invalidateQueries({ queryKey: productionKeys.all });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK COMPOSITE - DASHBOARD COMPLET
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook composite pour charger toutes les données du dashboard production
 */
export function useProductionDashboard() {
  const orders = useProductionOrders();
  const products = useProductsPf();
  const kpis = useProductionKpis();
  const alerts = useProductionAlerts();
  const stockPf = useStockPf();
  const calendar = useProductionCalendar();

  const isLoading = orders.isLoading || products.isLoading || kpis.isLoading ||
                    alerts.isLoading || stockPf.isLoading || calendar.isLoading;

  const isError = orders.isError || products.isError || kpis.isError ||
                  alerts.isError || stockPf.isError || calendar.isError;

  const refetchAll = () => {
    orders.refetch();
    products.refetch();
    kpis.refetch();
    alerts.refetch();
    stockPf.refetch();
    calendar.refetch();
  };

  return {
    orders: orders.data || [],
    products: products.data || [],
    kpis: kpis.data,
    alerts: alerts.data,
    stockPf: stockPf.data || [],
    calendar: calendar.data || [],
    isLoading,
    isError,
    isRefreshing: orders.isFetching || kpis.isFetching,
    refetchAll,
  };
}
