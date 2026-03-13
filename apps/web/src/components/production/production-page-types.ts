/**
 * Shared types used by the production page and its sub-components.
 */

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
  data?: Record<string, unknown>;
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
  orders: ProductionOrder[];
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

export interface TraceabilityInfo {
  productionOrder?: { id: number; reference: string };
  mpConsumed?: { mp?: { code: string }; lotNumber?: string }[];
  usedIn?: { productionOrder: { id: number; reference: string }; productPf?: { name: string }; quantityConsumed: number; lotsPfProduced?: string[] }[];
}

export interface LotSearchResult {
  type: 'MP' | 'PF';
  lot: {
    id: number;
    lotNumber: string;
    product: { id: number; code: string; name: string; unit: string };
    quantityInitial: number;
    quantityRemaining: number;
    expiryDate?: string;
  };
  traceability: TraceabilityInfo | null;
}

export type MainTab = 'dashboard' | 'products' | 'orders' | 'calendar' | 'traceability' | 'analytics';

// Raw API response types (before normalization)

export interface RawProductionOrder {
  id: number;
  reference: string;
  productPfId: number;
  productPf?: { name: string; code: string };
  targetQuantity: number;
  quantityProduced: number;
  batchCount: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  yieldPercentage: number | null;
  scheduledDate: string | null;
  createdAt: string;
  user?: { firstName: string; lastName: string };
}

export interface RawProductPf {
  id: number;
  code: string;
  name: string;
  unit: string;
}

export interface RawRecipe {
  id: number;
  productPfId: number;
  items?: unknown[];
  batchWeight?: number;
  outputQuantity?: number;
  shelfLifeDays?: number;
}

export interface AdminUsersResponse {
  users: { id: number; firstName?: string; lastName?: string; email: string }[];
}
