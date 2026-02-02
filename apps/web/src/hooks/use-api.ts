'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dashboard,
  stockDashboard,
  admin,
  appro,
  suppliers,
  type StockMpWithState,
  type PurchaseOrderStatus,
} from '@/lib/api';

// ═══════════════════════════════════════════════════════════════════════════
// POLLING INTERVALS (configurable constants)
// ═══════════════════════════════════════════════════════════════════════════
export const POLL_INTERVALS = {
  CRITICAL_COUNT: 60_000,  // 1 minute — badge updates
  ALERT_COUNTS: 30_000,    // 30 seconds — alert badge
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT QUERY OPTIONS — shared retry/error config
// ═══════════════════════════════════════════════════════════════════════════
const defaultQueryOptions = {
  retry: 2,
  staleTime: 30_000,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// QUERY KEYS — Single source of truth for cache invalidation
// ═══════════════════════════════════════════════════════════════════════════

export const queryKeys = {
  // Dashboard
  dashboardKpis: ['dashboard', 'kpis'] as const,
  salesChart: (days: number) => ['dashboard', 'sales', days] as const,
  productionChart: (days: number) => ['dashboard', 'production', days] as const,
  productionDashboard: ['dashboard', 'production-dashboard'] as const,
  syncStatus: ['dashboard', 'sync'] as const,
  recentEvents: (limit: number) => ['dashboard', 'events', limit] as const,

  // Stock Dashboard
  stockDashboard: ['stock', 'dashboard'] as const,
  stockCritical: ['stock', 'critical'] as const,
  stockCriticalCount: ['stock', 'critical-count'] as const,
  stockHealth: ['stock', 'health'] as const,
  stockExpiry: ['stock', 'expiry'] as const,

  // Admin
  adminStockMp: ['admin', 'stock', 'mp'] as const,
  adminStockPf: ['admin', 'stock', 'pf'] as const,
  adminInvoices: (page: number, limit: number) => ['admin', 'invoices', page, limit] as const,
  adminInvoice: (id: number) => ['admin', 'invoice', id] as const,
  adminProduction: (page: number) => ['admin', 'production', page] as const,
  adminClients: ['admin', 'clients'] as const,
  adminSuppliers: ['admin', 'suppliers'] as const,
  adminUsers: ['admin', 'users'] as const,
  adminDevices: ['admin', 'devices'] as const,

  // Appro
  approDashboard: ['appro', 'dashboard'] as const,
  approStockMp: (params?: { state?: string; criticite?: string; supplierId?: number }) =>
    ['appro', 'stock-mp', params] as const,
  approCriticalMp: ['appro', 'critical-mp'] as const,
  approSuggestions: ['appro', 'suggestions'] as const,
  approSupplierPerformance: ['appro', 'supplier-performance'] as const,
  approAlerts: ['appro', 'alerts'] as const,
  approActiveAlerts: ['appro', 'alerts', 'active'] as const,
  approCriticalAlerts: ['appro', 'alerts', 'critical'] as const,
  approAlertCounts: ['appro', 'alert-counts'] as const,
  approPurchaseOrders: (params?: { status?: PurchaseOrderStatus; supplierId?: number; limit?: number }) =>
    ['appro', 'purchase-orders', params] as const,
  approPurchaseOrder: (id: string) => ['appro', 'purchase-order', id] as const,

  // Suppliers
  suppliers: (includeInactive?: boolean) => ['suppliers', includeInactive] as const,
  supplier: (id: number) => ['supplier', id] as const,
  supplierHistory: (id: number, params?: { year?: number; month?: number }) =>
    ['supplier', id, 'history', params] as const,
  supplierImpacts: ['suppliers', 'impacts'] as const,
  supplierImpactChain: (id: number) => ['supplier', id, 'impact-chain'] as const,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD HOOKS
// ═══════════════════════════════════════════════════════════════════════════

export function useDashboardKpis(enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboardKpis,
    queryFn: () => dashboard.getKpis(),
    enabled,
  });
}

export function useSalesChart(days = 7, enabled = true) {
  return useQuery({
    queryKey: queryKeys.salesChart(days),
    queryFn: () => dashboard.getSalesChart(days),
    enabled,
  });
}

export function useProductionChart(days = 7) {
  return useQuery({
    queryKey: queryKeys.productionChart(days),
    queryFn: () => dashboard.getProductionChart(days),
  });
}

export function useProductionDashboard(enabled = true) {
  return useQuery({
    queryKey: queryKeys.productionDashboard,
    queryFn: () => dashboard.getProductionDashboard(),
    enabled,
  });
}

export function useSyncStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.syncStatus,
    queryFn: () => dashboard.getSyncStatus(),
    enabled,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STOCK DASHBOARD HOOKS
// ═══════════════════════════════════════════════════════════════════════════

export function useStockDashboard() {
  return useQuery({
    queryKey: queryKeys.stockDashboard,
    queryFn: () => stockDashboard.getDashboard(),
  });
}

export function useStockCriticalAlerts() {
  return useQuery({
    queryKey: queryKeys.stockCritical,
    queryFn: () => stockDashboard.getCriticalAlerts(),
  });
}

export function useStockCriticalCount() {
  return useQuery({
    queryKey: queryKeys.stockCriticalCount,
    queryFn: () => stockDashboard.getCriticalCount(),
    ...defaultQueryOptions,
    refetchInterval: POLL_INTERVALS.CRITICAL_COUNT,
  });
}

export function useStockHealth() {
  return useQuery({
    queryKey: queryKeys.stockHealth,
    queryFn: () => stockDashboard.getHealthMetrics(),
  });
}

export function useStockExpiry() {
  return useQuery({
    queryKey: queryKeys.stockExpiry,
    queryFn: () => stockDashboard.getExpiryStats(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN HOOKS
// ═══════════════════════════════════════════════════════════════════════════

export function useAdminStockMp() {
  return useQuery({
    queryKey: queryKeys.adminStockMp,
    queryFn: () => admin.getStockMp(),
  });
}

export function useAdminStockPf() {
  return useQuery({
    queryKey: queryKeys.adminStockPf,
    queryFn: () => admin.getStockPf(),
  });
}

export function useAdminInvoices(page = 1, limit = 20) {
  return useQuery({
    queryKey: queryKeys.adminInvoices(page, limit),
    queryFn: () => admin.getInvoices(page, limit),
  });
}

export function useAdminClients() {
  return useQuery({
    queryKey: queryKeys.adminClients,
    queryFn: () => admin.getClients(),
  });
}

export function useAdminSuppliers() {
  return useQuery({
    queryKey: queryKeys.adminSuppliers,
    queryFn: () => admin.getSuppliers(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// APPRO HOOKS
// ═══════════════════════════════════════════════════════════════════════════

export function useApproDashboard() {
  return useQuery({
    queryKey: queryKeys.approDashboard,
    queryFn: () => appro.getDashboard(),
  });
}

export function useApproStockMp(params?: { state?: string; criticite?: string; supplierId?: number }) {
  return useQuery({
    queryKey: queryKeys.approStockMp(params),
    queryFn: () => appro.getStockMp(params),
  });
}

export function useApproCriticalMp() {
  return useQuery({
    queryKey: queryKeys.approCriticalMp,
    queryFn: () => appro.getCriticalMp(),
  });
}

export function useApproSuggestions() {
  return useQuery({
    queryKey: queryKeys.approSuggestions,
    queryFn: () => appro.getSuggestions(),
  });
}

export function useApproAlertCounts() {
  return useQuery({
    queryKey: queryKeys.approAlertCounts,
    queryFn: () => appro.getAlertCounts(),
    ...defaultQueryOptions,
    refetchInterval: POLL_INTERVALS.ALERT_COUNTS,
  });
}

export function useApproActiveAlerts() {
  return useQuery({
    queryKey: queryKeys.approActiveAlerts,
    queryFn: () => appro.getActiveAlerts(),
  });
}

export function useApproPurchaseOrders(params?: { status?: PurchaseOrderStatus; supplierId?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.approPurchaseOrders(params),
    queryFn: () => appro.getPurchaseOrders(params),
  });
}

export function useApproPurchaseOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.approPurchaseOrder(id),
    queryFn: () => appro.getPurchaseOrder(id),
    enabled: !!id,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// APPRO MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: number) => appro.acknowledgeAlert(alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appro', 'alerts'] });
      qc.invalidateQueries({ queryKey: queryKeys.approAlertCounts });
    },
  });
}

export function useUpdateMp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StockMpWithState> }) =>
      appro.updateMp(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appro', 'stock-mp'] });
      qc.invalidateQueries({ queryKey: queryKeys.approDashboard });
    },
  });
}

export function useScanAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => appro.scanAlerts(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appro', 'alerts'] });
      qc.invalidateQueries({ queryKey: queryKeys.approAlertCounts });
    },
  });
}

export function useSendPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof appro.sendPurchaseOrder>[1] }) =>
      appro.sendPurchaseOrder(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.approPurchaseOrder(id) });
      qc.invalidateQueries({ queryKey: ['appro', 'purchase-orders'] });
    },
  });
}

export function useConfirmPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => appro.confirmPurchaseOrder(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.approPurchaseOrder(id) });
      qc.invalidateQueries({ queryKey: ['appro', 'purchase-orders'] });
    },
  });
}

export function useCancelPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof appro.cancelPurchaseOrder>[1] }) =>
      appro.cancelPurchaseOrder(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.approPurchaseOrder(id) });
      qc.invalidateQueries({ queryKey: ['appro', 'purchase-orders'] });
    },
  });
}

export function useReceivePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof appro.receivePurchaseOrder>[1] }) =>
      appro.receivePurchaseOrder(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appro'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stock'] });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPLIER HOOKS
// ═══════════════════════════════════════════════════════════════════════════

export function useSuppliers(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.suppliers(includeInactive),
    queryFn: () => suppliers.getAll(includeInactive),
  });
}

export function useSupplier(id: number) {
  return useQuery({
    queryKey: queryKeys.supplier(id),
    queryFn: () => suppliers.getById(id),
    enabled: id > 0,
  });
}

export function useSupplierImpacts() {
  return useQuery({
    queryKey: queryKeys.supplierImpacts,
    queryFn: () => suppliers.getImpacts(),
  });
}

export function useSupplierImpactChain(id: number) {
  return useQuery({
    queryKey: queryKeys.supplierImpactChain(id),
    queryFn: () => suppliers.getImpactChain(id),
    enabled: id > 0,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof appro.createSupplier>[0]) =>
      appro.createSupplier(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: queryKeys.adminSuppliers });
    },
  });
}
