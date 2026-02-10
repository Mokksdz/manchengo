// ═══════════════════════════════════════════════════════════════════════════
// API CLIENT - Secure httpOnly Cookie Authentication
// ═══════════════════════════════════════════════════════════════════════════
// SECURITY: Tokens are stored in httpOnly cookies (not accessible via JS)
// All requests use credentials: 'include' to send cookies automatically
// NO localStorage usage - XSS protection
// ═══════════════════════════════════════════════════════════════════════════

export const API_BASE = (() => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // In browser production: use relative /api path (works with Vercel rewrites)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return '/api';
  }
  // Server-side or development: use localhost
  return 'http://localhost:3000/api';
})();

/**
 * Custom API Error class that preserves field-level validation errors
 * Enables forms to display per-field error messages from NestJS validation
 */
export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]> | null;

  constructor(message: string, status: number, fieldErrors: Record<string, string[]> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Get full API URL for an endpoint
 * WHY: Centralizes URL construction, prevents hardcoded localhost in components
 */
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${cleanEndpoint}`;
}

/**
 * Simple authenticated fetch - use for direct fetch calls
 * Adds credentials: 'include' for cookie-based auth
 * 
 * @param endpoint - API endpoint (e.g., '/dashboard/production')
 * @param options - fetch options
 */
export function authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : getApiUrl(endpoint);
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * Generic fetch wrapper with httpOnly cookie authentication
 * - credentials: 'include' sends cookies with every request
 * - Automatic token refresh on 401
 * - No localStorage usage (XSS safe)
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // CRITICAL: Send httpOnly cookies
  });

  // Handle 401 - try to refresh token
  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry original request after refresh
      const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });
      if (retryResponse.ok) {
        return retryResponse.json();
      }
    }
    // Refresh failed - dispatch custom event so auth-context can handle redirect via router
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }
    throw new Error('Session expirée');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    // Handle array of validation messages from NestJS
    const message = Array.isArray(error.message)
      ? error.message.join(', ')
      : error.message;
    const statusMessages: Record<number, string> = {
      400: 'Données invalides',
      403: 'Accès non autorisé',
      404: 'Ressource introuvable',
      409: 'Conflit — cette ressource existe déjà',
      422: 'Données non traitables',
      500: 'Erreur serveur — réessayez plus tard',
    };
    // Create enriched error with field info for form validation
    const apiError = new ApiError(
      message || statusMessages[response.status] || `Erreur HTTP ${response.status}`,
      response.status,
      error.errors || null,  // Field-level errors from NestJS validation
    );
    throw apiError;
  }

  return response.json();
}

/**
 * Try to refresh the access token using the refresh token cookie
 * Returns true if refresh was successful
 */
async function tryRefreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Send refresh token cookie
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH API - httpOnly cookie based
// ═══════════════════════════════════════════════════════════════════════════
export const auth = {
  /**
   * Login - tokens are set as httpOnly cookies by the server
   * Returns user info only (no tokens in response body)
   */
  login: (email: string, password: string) =>
    apiFetch<{
      message: string;
      user: User;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  /**
   * Refresh - uses httpOnly cookie automatically
   * Server rotates both access and refresh tokens
   */
  refresh: () =>
    apiFetch<{ message: string }>('/auth/refresh', {
      method: 'POST',
    }),

  /**
   * Logout - server clears all auth cookies
   */
  logout: () =>
    apiFetch<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),

  /**
   * Get current user - uses httpOnly cookie for auth
   * NOTE: This does NOT redirect on 401 to avoid login page loops
   */
  me: async (): Promise<User> => {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Not authenticated');
    }
    return response.json();
  },
};

// Dashboard API
export const dashboard = {
  getKpis: () => apiFetch<KPIs>('/dashboard/kpis'),
  getSalesChart: (days = 7) =>
    apiFetch<ChartData[]>(`/dashboard/charts/sales?days=${days}`),
  getProductionChart: (days = 7) =>
    apiFetch<ProductionChartData[]>(`/dashboard/charts/production?days=${days}`),
  getProductionDashboard: () => apiFetch<ProductionDashboard>('/dashboard/production'),
  getSyncStatus: () => apiFetch<DeviceSyncStatus[]>('/dashboard/sync/status'),
  getRecentEvents: (limit = 20) =>
    apiFetch<SyncEvent[]>(`/dashboard/sync/events?limit=${limit}`),
};

export interface ProductionDashboard {
  production: {
    ordersToday: number;
    ordersPending: number;
    ordersInProgress: number;
    ordersCompleted: number;
    quantiteProduite: number;
    rendementMoyen: number;
  };
  approvisionnement: {
    mpSousSeuil: number;
    mpCritiques: number;
    demandesEnvoyees: number;
    demandesEnAttente: number;
  };
  alertes: {
    recettesNonConfigurees: number;
    mpAlertList: { code: string; name: string; stock: number; minStock: number; status: string }[];
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STOCK DASHBOARD API - 3 Zones actionables
// ═══════════════════════════════════════════════════════════════════════════
export interface StockAlert {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  entityType: 'MP' | 'PF' | 'LOT' | 'INVENTORY';
  entityId: number;
  actionRequired: string;
  actionUrl?: string;
  createdAt: string;
  dismissable: boolean;
}

export interface ZoneCritique {
  totalCount: number;
  ruptures: { productId: number; code: string; name: string; stock: number; minStock: number }[];
  expiresJ3: { lotId: number; lotNumber: string; productName: string; expiryDate: string; quantity: number }[];
  inventairesCritiques: { id: number; productName: string; ecart: number; ecartPercent: number; status: string }[];
  alerts: StockAlert[];
}

export interface ZoneATraiter {
  totalCount: number;
  sousSeuilItems: { productId: number; code: string; name: string; stock: number; minStock: number; deficit: number }[];
  expiresJ7: { lotId: number; lotNumber: string; productName: string; expiryDate: string; quantity: number }[];
  inventairesEnAttente: { id: number; productName: string; declaredQty: number; systemQty: number; status: string }[];
  alerts: StockAlert[];
}

export interface ZoneSante {
  fifoCompliance: number;
  stockRotation: number;
  inventoryFreshness: number;
  blockedLotsRatio: number;
  expiryRiskScore: number;
}

export interface StockDashboardSummary {
  healthScore: number;
  criticalCount: number;
  warningCount: number;
  totalProducts: number;
  lastUpdated: string;
}

export interface StockDashboardData {
  critique: ZoneCritique;
  aTraiter: ZoneATraiter;
  sante: ZoneSante;
  summary: StockDashboardSummary;
  _meta: { generatedAt: string; cacheHit: boolean };
}

export interface ExpiryStats {
  stats: {
    expiredBlocked: number;
    expiringJ1: number;
    expiringJ3: number;
    expiringJ7: number;
  };
  lots: { id: number; lotNumber: string; productName: string; expiryDate: string; daysUntilExpiry: number; quantity: number }[];
  summary: { totalAtRisk: number; valueAtRisk: number };
}

export const stockDashboard = {
  getDashboard: () => apiFetch<{ success: boolean; data: StockDashboardData }>('/stock/dashboard'),
  getCriticalAlerts: () => apiFetch<{ success: boolean; data: { alerts: StockAlert[]; count: number } }>('/stock/dashboard/critical'),
  getCriticalCount: () => apiFetch<{ success: boolean; data: { criticalCount: number; hasCritical: boolean } }>('/stock/dashboard/count'),
  getHealthMetrics: () => apiFetch<{ success: boolean; data: { metrics: ZoneSante; interpretation: Record<string, string> } }>('/stock/dashboard/health'),
  getExpiryStats: () => apiFetch<{ success: boolean; data: ExpiryStats }>('/stock/dashboard/expiry'),
};

// Admin API
export const admin = {
  getStockMp: () => apiFetch<StockItem[]>('/stock/mp'),
  getStockPf: () => apiFetch<StockItem[]>('/stock/pf'),
  getInvoices: (page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<Invoice>>(`/admin/invoices?page=${page}&limit=${limit}`),
  getInvoice: (id: number) => apiFetch<Invoice>(`/admin/invoices/${id}`),
  getProductionOrders: (page = 1) =>
    apiFetch<PaginatedResponse<ProductionOrder>>(`/admin/production?page=${page}`),
  getClients: () => apiFetch<Client[]>('/admin/clients'),
  getSuppliers: () => apiFetch<Supplier[]>('/admin/suppliers'),
  getUsers: () => apiFetch<User[]>('/admin/users'),
  getDevices: () => apiFetch<Device[]>('/admin/devices'),
};

// Types
export interface User {
  id: string;
  code: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'APPRO' | 'PRODUCTION' | 'COMMERCIAL';
  isActive?: boolean;
}

export interface KPIs {
  stock: { mp: { total: number; lowStock: number }; pf: { total: number; lowStock: number } };
  sales: { todayAmount: number; todayInvoices: number };
  sync: { devicesOffline: number; pendingEvents: number };
}

export interface ChartData {
  date: string;
  amount: number;
}

export interface ProductionChartData {
  date: string;
  planned: number;
  completed: number;
}

export interface DeviceSyncStatus {
  id: string;
  name: string;
  platform: string;
  lastSyncAt: string | null;
  isActive: boolean;
  user: { firstName: string; lastName: string };
}

export interface SyncEvent {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  occurredAt: string;
  device?: { id: string; name: string };
}

export interface StockItem {
  productId: number;
  id?: number;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  totalStock?: number;
  minStock: number;
  priceHt?: number;
  stockValue?: number;
  status: 'OK' | 'ALERTE' | 'RUPTURE';
  lastMovementAt?: string;
  isLowStock?: boolean;
  impactProduction?: number;
}

export interface Invoice {
  id: number;
  reference: string;
  date: string;
  totalHt: number;
  totalTtc: number;
  netToPay: number;
  status: string;
  client: { id: number; name: string };
}

export interface ProductionOrder {
  id: number;
  reference: string;
  quantity: number;
  status: string;
  createdAt: string;
}

export interface Client {
  id: number;
  code: string;
  name: string;
  type: string;
  _count?: { invoices: number };
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  _count?: { lots: number };
}

export interface Device {
  id: string;
  name: string;
  platform: string;
  lastSyncAt: string | null;
  isActive: boolean;
  user: { firstName: string; lastName: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// APPRO API V1.2 - Cockpit de pilotage
// ═══════════════════════════════════════════════════════════════════════════

export interface ApproDashboard {
  irs: {
    value: number;
    status: 'SAIN' | 'SURVEILLANCE' | 'CRITIQUE';
    details: {
      mpRupture: number;
      mpSousSeuil: number;
      mpCritiquesProduction: number;
    };
  };
  stockStats: {
    total: number;
    sain: number;
    sousSeuil: number;
    aCommander: number;
    rupture: number;
    bloquantProduction: number;
  };
  mpCritiquesProduction: StockMpWithState[];
  alertesActives: number;
  bcEnAttente: number;
}

export interface StockMpWithState {
  id: number;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  seuilSecurite: number;
  seuilCommande: number;
  state: 'SAIN' | 'SOUS_SEUIL' | 'A_COMMANDER' | 'RUPTURE' | 'BLOQUANT_PRODUCTION';
  criticiteParam: 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'BLOQUANTE';
  criticiteEffective: 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'BLOQUANTE';
  joursCouverture: number | null;
  leadTimeFournisseur: number;
  usedInRecipes: number;
  supplierId: number | null;
  supplierName: string | null;
  // P0: BC en cours pour cette MP
  bcEnCours?: {
    id: string;
    reference: string;
    status: string;
    expectedDelivery: string | null;
  } | null;
}

export interface ApproAlert {
  id: number;
  type: 'MP_CRITIQUE' | 'RUPTURE' | 'FOURNISSEUR_RETARD' | 'PRODUCTION_BLOQUEE';
  niveau: 'INFO' | 'WARNING' | 'CRITICAL';
  entityType: 'MP' | 'SUPPLIER' | 'PRODUCTION';
  entityId: number | null;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface RequisitionSuggestion {
  productMpId: number;
  productMp: {
    code: string;
    name: string;
    unit: string;
  };
  currentStock: number;
  seuilCommande: number;
  quantiteRecommandee: number;
  priority: 'CRITIQUE' | 'ELEVEE' | 'NORMALE';
  fournisseurSuggere: { id: number; name: string; grade: string } | null;
  justification: string;
  joursCouvertureActuels: number | null;
  impactProduction: { recipeId: number; recipeName: string }[];
}

export interface SupplierPerformance {
  id: number;
  code: string;
  name: string;
  grade: 'A' | 'B' | 'C';
  scorePerformance: number;
  metrics: {
    tauxRetard: number;
    tauxNonConformite: number;
    leadTimeReel: number;
  };
  stats: {
    totalLivraisons: number;
    livraisonsRetard: number;
  };
  productsMpCount: number;
}

export interface AlertCounts {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
  criticalUnacknowledged: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDER (BC) TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  id: string;
  productMpId: number;
  productMp: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
  quantity: number;
  quantityReceived: number;
  unitPrice: number;
  totalHT: number;
  tvaRate: number;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  supplierId: number;
  supplier: {
    id: number;
    code: string;
    name: string;
    email?: string | null;
  };
  linkedDemandId: number;
  linkedDemand?: {
    id: number;
    reference: string;
    createdBy?: { firstName: string; lastName: string };
  };
  status: PurchaseOrderStatus;
  totalHT: number;
  currency: string;
  expectedDelivery: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  createdById: string;
  createdBy?: { firstName: string; lastName: string };
  createdAt: string;
  sentAt: string | null;
  sentBy?: { firstName: string; lastName: string } | null;
  confirmedAt: string | null;
  confirmedBy?: { firstName: string; lastName: string } | null;
  receivedAt: string | null;
  receivedBy?: { firstName: string; lastName: string } | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  receptionMpId: number | null;
  items: PurchaseOrderItem[];
}

export interface GenerateBcResponse {
  count: number;
  purchaseOrders: {
    id: string;
    reference: string;
    supplierId: number;
    supplierName: string;
    totalHT: number;
    itemsCount: number;
  }[];
  message: string;
}

export interface SendBcResponse {
  id: string;
  reference: string;
  status: string;
  sentAt: string;
  emailSent: boolean;
  message: string;
}

export interface ReceiveBcResponse {
  id: string;
  reference: string;
  status: string;
  receptionMpId: number;
  receptionMpReference: string;
  stockMovementsCreated: number;
  demandClosed: boolean;
  message: string;
}

// P0.2: Response après annulation BC
export interface CancelBcResponse {
  id: string;
  reference: string;
  status: string;
  cancelledAt: string;
  reason: string;
  message: string;
}

// APPRO API Functions
export const appro = {
  // Dashboard complet
  getDashboard: () => apiFetch<ApproDashboard>('/appro/dashboard'),
  
  // Stock MP avec état calculé
  getStockMp: (params?: { state?: string; criticite?: string; supplierId?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.state) searchParams.append('state', params.state);
    if (params?.criticite) searchParams.append('criticite', params.criticite);
    if (params?.supplierId) searchParams.append('supplierId', params.supplierId.toString());
    const query = searchParams.toString();
    return apiFetch<StockMpWithState[]>(`/appro/stock-mp${query ? `?${query}` : ''}`);
  },
  
  // MP critiques uniquement
  getCriticalMp: () => apiFetch<StockMpWithState[]>('/appro/stock-mp/critical'),
  
  // Suggestions de réquisitions
  getSuggestions: () => apiFetch<RequisitionSuggestion[]>('/appro/requisitions/suggested'),
  
  // Performance fournisseurs
  getSupplierPerformance: () => apiFetch<SupplierPerformance[]>('/appro/suppliers/performance'),
  
  // Créer un fournisseur
  createSupplier: (data: {
    name: string;
    rc: string;
    nif: string;
    ai: string;
    nis?: string;
    phone: string;
    address: string;
  }) => apiFetch<{ id: number; code: string; name: string }>('/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  // Vérification production
  checkProduction: (recipeId: number, batchCount: number) =>
    apiFetch<{ canStart: boolean; blockers: Array<{ productMpId: number; name: string; required: number; available: number; shortage: number }> }>(
      '/appro/check-production',
      { method: 'POST', body: JSON.stringify({ recipeId, batchCount }) }
    ),
  
  // Alertes V1.2
  getAllAlerts: () => apiFetch<ApproAlert[]>('/appro/alerts/all'),
  getActiveAlerts: () => apiFetch<ApproAlert[]>('/appro/alerts/active'),
  getCriticalAlerts: () => apiFetch<ApproAlert[]>('/appro/alerts/critical'),
  getAlertCounts: () => apiFetch<AlertCounts>('/appro/alerts/counts'),
  acknowledgeAlert: (alertId: number) =>
    apiFetch<ApproAlert>(`/appro/alerts/${alertId}/acknowledge`, { method: 'POST' }),
  
  // V1: Reporter une alerte avec motif obligatoire (audit)
  postponeAlert: (mpId: number, data: { duration: string; reason: string }) =>
    apiFetch<{ success: boolean; expiresAt: string }>(`/appro/alerts/mp/${mpId}/postpone`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  scanAlerts: () =>
    apiFetch<{ mpCritiques: number; ruptures: number; fournisseurs: number }>('/appro/alerts/scan', { method: 'POST' }),
  
  // Mise à jour MP
  updateMp: (id: number, data: Partial<StockMpWithState>) =>
    apiFetch<StockMpWithState>(`/appro/stock-mp/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // ═══════════════════════════════════════════════════════════════════════════════
  // BONS DE COMMANDE (BC) — Flux verrouillé depuis Demandes
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // Générer BC depuis une Demande validée
  generateBc: (demandId: number, data?: {
    expectedDelivery?: string;
    deliveryAddress?: string;
    notes?: string;
    priceOverrides?: { productMpId: number; unitPrice: number }[];
  }) =>
    apiFetch<GenerateBcResponse>(`/appro/demands/${demandId}/generate-bc`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  // Liste des BC
  getPurchaseOrders: (params?: { status?: PurchaseOrderStatus; supplierId?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.supplierId) searchParams.append('supplierId', params.supplierId.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString();
    return apiFetch<PurchaseOrder[]>(`/appro/purchase-orders${query ? `?${query}` : ''}`);
  },

  // Détail d'un BC
  getPurchaseOrder: (id: string) =>
    apiFetch<PurchaseOrder>(`/appro/purchase-orders/${id}`),

  // BC d'une Demande
  getDemandPurchaseOrders: (demandId: number) =>
    apiFetch<PurchaseOrder[]>(`/appro/demands/${demandId}/purchase-orders`),

  // P0.1: Envoyer un BC au fournisseur avec PREUVE TRAÇABLE (DRAFT → SENT)
  sendPurchaseOrder: (id: string, data: {
    sendVia: 'EMAIL' | 'MANUAL';
    supplierEmail?: string;
    ccEmail?: string;
    message?: string;
    proofNote?: string;
    proofUrl?: string;
    idempotencyKey?: string;
  }) =>
    apiFetch<SendBcResponse>(`/appro/purchase-orders/${id}/send`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Confirmer un BC (SENT → CONFIRMED)
  confirmPurchaseOrder: (id: string) =>
    apiFetch<{ id: string; reference: string; status: string; message: string }>(
      `/appro/purchase-orders/${id}/confirm`,
      { method: 'POST' }
    ),

  // P0.2: Annuler un BC (ADMIN uniquement, motif obligatoire)
  cancelPurchaseOrder: (id: string, data: {
    reason: string;
    idempotencyKey?: string;
  }) =>
    apiFetch<CancelBcResponse>(`/appro/purchase-orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Réceptionner un BC (SENT/CONFIRMED/PARTIAL → PARTIAL/RECEIVED)
  receivePurchaseOrder: (id: string, data: {
    lines: {
      itemId: string;
      quantityReceived: number;
      lotNumber?: string;
      expiryDate?: string;
      note?: string;
    }[];
    blNumber?: string;
    receptionDate?: string;
    notes?: string;
  }) =>
    apiFetch<ReceiveBcResponse>(`/appro/purchase-orders/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIERS IMPACT API — Chaîne d'impact réelle
// ═══════════════════════════════════════════════════════════════════════════════

export type SupplierRiskLevel = 'CRITICAL' | 'WARNING' | 'STABLE';

export interface SupplierImpact {
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  reliabilityScore: number;
  riskLevel: SupplierRiskLevel;
  bcBlockingCount: number;
  delayedBcCount: number;
  blockedMpCount: number;
  impactedRecipesCount: number;
  lastIncidentAt: string | null;
  isMonoSource: boolean;
  monoSourceMpCount: number;
}

export interface BlockingPurchaseOrderApi {
  id: string;
  reference: string;
  status: PurchaseOrderStatus;
  expectedDeliveryDate: string | null;
  daysUntilDelivery: number | null;
  isDelayed: boolean;
  blockingMpCount: number;
}

export interface BlockedMaterialApi {
  id: number;
  code: string;
  name: string;
  currentStock: number;
  minStock: number;
  status: 'RUPTURE' | 'CRITICAL' | 'LOW';
  daysRemaining: number | null;
}

export interface ImpactedRecipeApi {
  id: number;
  name: string;
  status: 'BLOCKED' | 'AT_RISK';
}

export interface SupplierImpactChain {
  supplier: {
    id: number;
    code: string;
    name: string;
    reliabilityScore: number;
    riskLevel: SupplierRiskLevel;
    incidentsLast30Days: number;
  };
  purchaseOrders: BlockingPurchaseOrderApi[];
  blockedMaterials: BlockedMaterialApi[];
  impactedRecipes: ImpactedRecipeApi[];
}

export const suppliers = {
  // Liste tous les fournisseurs
  getAll: (includeInactive = false) =>
    apiFetch<Supplier[]>(`/suppliers${includeInactive ? '?includeInactive=true' : ''}`),

  // Détail d'un fournisseur
  getById: (id: number) => apiFetch<Supplier>(`/suppliers/${id}`),

  // Historique réceptions
  getHistory: (id: number, params?: { year?: number; month?: number; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.year) searchParams.append('year', params.year.toString());
    if (params?.month) searchParams.append('month', params.month.toString());
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const query = searchParams.toString();
    return apiFetch<unknown>(`/suppliers/${id}/history${query ? `?${query}` : ''}`);
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CHAÎNE D'IMPACT — Données réelles, zéro mock
  // ═══════════════════════════════════════════════════════════════════════════════

  // Tous les fournisseurs avec impact réel
  getImpacts: () => apiFetch<SupplierImpact[]>('/suppliers/impacts'),

  // Chaîne d'impact complète d'un fournisseur
  getImpactChain: (id: number) => apiFetch<SupplierImpactChain>(`/suppliers/${id}/impact-chain`),

  // Bloquer un fournisseur (ADMIN)
  block: (id: number, data: { reason: string; blockedUntil?: string }) =>
    apiFetch<Supplier>(`/suppliers/${id}/block`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Mettre sous surveillance (ADMIN)
  setSurveillance: (id: number, data: { reason: string; surveillanceUntil?: string }) =>
    apiFetch<Supplier>(`/suppliers/${id}/surveillance`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
