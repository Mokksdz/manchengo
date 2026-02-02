'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/api';
import { Factory, Clock, Package, Search, Zap, Calendar, RefreshCw, Activity, BarChart3 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';
import {
  NewProductModal,
  ProductionCalendarTab,
  ProductionAnalyticsTab,
  ProductionTraceabilityTab,
  ProductionDashboardTab,
  ProductionProductsTab,
  ProductionOrdersTab,
  type SupplyRisksData,
  type ProductionsAtRiskData,
} from '@/components/production';

const ProductionWizardModal = dynamic(
  () => import('@/components/production/ProductionWizardModal').then(mod => ({ default: mod.ProductionWizardModal })),
  { loading: () => <div className="animate-pulse p-8">Chargement...</div> }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

interface ProductionOrder {
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



interface DashboardKpis {
  today: { completed: number; inProgress: number; pending: number; totalProduced: number };
  week: { completed: number; totalProduced: number; avgYield: number; lowYieldCount: number };
  month: { completed: number; totalProduced: number };
  activeOrders: number;
  blockedOrders: number;
}

interface ProductionAlert {
  id: string;
  type: 'DLC_PROCHE' | 'RENDEMENT_FAIBLE' | 'ORDRE_BLOQUE' | 'STOCK_PF_BAS';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  link?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  createdAt: string;
}

interface AlertsData {
  total: number;
  critical: number;
  warning: number;
  alerts: ProductionAlert[];
}

interface StockPfItem {
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

interface CalendarDay {
  date: string;
  dayName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orders: any[];
  totalOrders: number;
  pending: number;
  inProgress: number;
  completed: number;
}

interface AnalyticsData {
  period: string;
  summary: { totalOrders: number; totalProduced: number; avgYield: number };
  trend: { date: string; quantity: number; orders: number; avgYield: number }[];
  topProducts: { product: { id: number; code: string; name: string }; quantity: number; orders: number }[];
}

interface LotSearchResult {
  type: 'MP' | 'PF';
  lot: {
    id: number;
    lotNumber: string;
    product: { id: number; code: string; name: string; unit: string };
    quantityInitial: number;
    quantityRemaining: number;
    expiryDate?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  traceability: any;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ProductionPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<ProductPf[]>([]);
  const [mainTab, setMainTab] = useState<'dashboard' | 'products' | 'orders' | 'calendar' | 'traceability' | 'analytics'>('dashboard');
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dashboard KPIs & Alerts
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [alertsData, setAlertsData] = useState<AlertsData | null>(null);
  const [stockPf, setStockPf] = useState<StockPfItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // P0.1: Supply Risks (MP critiques, BC en retard, fournisseurs bloquants)
  const [supplyRisks, setSupplyRisks] = useState<SupplyRisksData | null>(null);
  const [isLoadingSupplyRisks, setIsLoadingSupplyRisks] = useState(false);
  const [showSupplyRisksDetails, setShowSupplyRisksDetails] = useState(false);

  // A1: Productions at Risk
  const [productionsAtRisk, setProductionsAtRisk] = useState<ProductionsAtRiskData | null>(null);
  const [isLoadingAtRisk, setIsLoadingAtRisk] = useState(false);
  const [lastSupplyAnalysis, setLastSupplyAnalysis] = useState<Date | null>(null);
  
  // ERP Premium: Responsable Appro (lecture seule)
  const [approManager, setApproManager] = useState<{ id: number; name: string } | null>(null);

  // Calendar
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);

  // Analytics
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'year'>('month');

  // Lot Traceability
  const [lotSearchQuery, setLotSearchQuery] = useState('');
  const [lotSearchResults, setLotSearchResults] = useState<LotSearchResult[]>([]);
  const [isSearchingLots, setIsSearchingLots] = useState(false);

  // New Product Modal
  const [showNewProduct, setShowNewProduct] = useState(false);

  // Production Wizard (extracted to ProductionWizardModal)
  const [showWizard, setShowWizard] = useState(false);
  const [wizardInitialProduct, setWizardInitialProduct] = useState<ProductPf | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════════

  const loadOrders = useCallback(async () => {
    try {
      const res = await authFetch('/production?limit=100', {
        credentials: 'include',
      });
      if (!res.ok) { console.error('Orders API error:', res.status, await res.text()); return; }
      {
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setOrders(data.map((o: any) => ({
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
          createdAt: o.createdAt,
          user: o.user ? `${o.user.firstName} ${o.user.lastName}` : '-',
        })));
      }
    } catch (error: unknown) {
      console.error('Failed to load orders:', (error as Error)?.message || error);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const [productsRes, recipesRes] = await Promise.all([
        authFetch('/products/pf', { credentials: 'include' }),
        authFetch('/recipes', { credentials: 'include' }),
      ]);
      if (!productsRes.ok) { console.error('Products API error:', productsRes.status, await productsRes.text()); return; }
      {
        const productsData = await productsRes.json();
        const recipesData = recipesRes.ok ? await recipesRes.json() : [];
        const recipeMap = new Map();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recipesData.forEach((r: any) => recipeMap.set(r.productPfId, r));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProducts(productsData.map((p: any) => {
          const recipe = recipeMap.get(p.id);
          return {
            id: p.id, code: p.code, name: p.name, unit: p.unit,
            hasRecipe: !!recipe, recipeId: recipe?.id || null,
            recipeItemsCount: recipe?.items?.length || 0,
            recipeBatchWeight: recipe?.batchWeight || 0,
            recipeOutputQty: recipe?.outputQuantity || 0,
            recipeShelfLife: recipe?.shelfLifeDays || 0,
          };
        }));
      }
    } catch (error: unknown) {
      console.error('Failed to load products:', (error as Error)?.message || error);
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      const [kpisRes, alertsRes, stockPfRes, calendarRes] = await Promise.all([
        authFetch('/production/dashboard/kpis', { credentials: 'include' }),
        authFetch('/production/dashboard/alerts', { credentials: 'include' }),
        authFetch('/production/dashboard/stock-pf', { credentials: 'include' }),
        authFetch('/production/dashboard/calendar', { credentials: 'include' }),
      ]);
      if (kpisRes.ok) setKpis(await kpisRes.json());
      if (alertsRes.ok) setAlertsData(await alertsRes.json());
      if (stockPfRes.ok) setStockPf(await stockPfRes.json());
      if (calendarRes.ok) {
        const data = await calendarRes.json();
        setCalendarData(data.days || []);
      }
    } catch (error: unknown) {
      console.error('Failed to load dashboard data:', (error as Error)?.message || error);
    }
  }, []);

  // P0.1: Charger les risques supply chain
  const loadSupplyRisks = useCallback(async () => {
    setIsLoadingSupplyRisks(true);
    try {
      const res = await authFetch('/production/dashboard/supply-risks', { credentials: 'include' });
      if (res.ok) {
        setSupplyRisks(await res.json());
      }
    } catch (error: unknown) {
      console.error('Failed to load supply risks:', (error as Error)?.message || error);
    } finally {
      setIsLoadingSupplyRisks(false);
    }
  }, []);

  // A1: Charger les productions à risque
  const loadProductionsAtRisk = useCallback(async () => {
    setIsLoadingAtRisk(true);
    try {
      const res = await authFetch('/production/dashboard/at-risk', { credentials: 'include' });
      if (res.ok) {
        setProductionsAtRisk(await res.json());
        setLastSupplyAnalysis(new Date()); // ERP Premium: Horodatage
      }
    } catch (error: unknown) {
      console.error('Failed to load productions at risk:', (error as Error)?.message || error);
    } finally {
      setIsLoadingAtRisk(false);
    }
  }, []);

  // ERP Premium: Charger le responsable Appro (lecture seule)
  const loadApproManager = useCallback(async () => {
    try {
      const res = await authFetch('/users?role=APPRO_MANAGER', { credentials: 'include' });
      if (res.ok) {
        const users = await res.json();
        if (users && users.length > 0) {
          const manager = users[0];
          setApproManager({ 
            id: manager.id, 
            name: `${manager.firstName || ''} ${manager.lastName || ''}`.trim() || manager.email 
          });
        }
      }
    } catch (error: unknown) {
      // Silently fail - responsable appro is optional
      // eslint-disable-next-line no-console
      console.debug('Appro manager not found:', (error as Error)?.message);
    }
  }, []);

  const loadAnalytics = useCallback(async (period: 'week' | 'month' | 'year') => {
    try {
      const res = await authFetch(`/production/dashboard/analytics?period=${period}`, { credentials: 'include' });
      if (res.ok) setAnalytics(await res.json());
    } catch (error: unknown) {
      console.error('Failed to load analytics:', (error as Error)?.message || error);
    }
  }, []);

  const searchLots = useCallback(async (query: string) => {
    if (!query || query.length < 2) { setLotSearchResults([]); return; }
    setIsSearchingLots(true);
    try {
      const res = await authFetch(`/production/lots/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLotSearchResults(data.results || []);
      }
    } catch (error: unknown) {
      console.error('Failed to search lots:', (error as Error)?.message || error);
    } finally {
      setIsSearchingLots(false);
    }
  }, []);

  const refreshDashboard = async () => {
    setIsRefreshing(true);
    await Promise.all([loadOrders(), loadProducts(), loadDashboardData(), loadSupplyRisks(), loadProductionsAtRisk()]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      await Promise.all([loadOrders(), loadProducts(), loadDashboardData(), loadSupplyRisks(), loadProductionsAtRisk(), loadApproManager()]);
      setIsLoading(false);
    }
    loadData();
  }, [loadOrders, loadProducts, loadDashboardData, loadSupplyRisks, loadProductionsAtRisk, loadApproManager]);

  useEffect(() => {
    if (mainTab === 'analytics') {
      loadAnalytics(analyticsPeriod);
    }
  }, [mainTab, analyticsPeriod, loadAnalytics]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILTERS & STATS
  // ═══════════════════════════════════════════════════════════════════════════════

  // Filtered data (used by extracted tab components internally)

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((o) => o.status === 'PENDING').length,
    inProgress: orders.filter((o) => o.status === 'IN_PROGRESS').length,
    completed: orders.filter((o) => o.status === 'COMPLETED').length,
  }), [orders]);


  // ═══════════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  // Product creation is handled by NewProductModal component

  const openWizard = (product?: ProductPf) => {
    setWizardInitialProduct(product || null);
    setShowWizard(true);
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-11 h-11 rounded-[14px]" />
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        {/* KPI strip skeleton */}
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        {/* Tab placeholder */}
        <div className="glass-card overflow-hidden">
          <div className="flex border-b border-black/[0.04] px-4 py-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-5 w-24" />
            ))}
          </div>
          <SkeletonTable rows={5} columns={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-bg space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 flex items-center justify-center">
              <Factory className="w-5 h-5 text-[#AF52DE]" />
            </div>
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">
                Production
              </h1>
              <p className="text-[13px] text-[#86868B] mt-0.5">
                Centre de commande production
                {alertsData && alertsData.critical > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-pulse" />
                    <span className="text-[#FF3B30] font-medium">{alertsData.critical} alerte(s)</span>
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshDashboard}
            disabled={isRefreshing}
            className="p-2.5 rounded-full glass-card-hover transition-all text-[#86868B] hover:text-[#1D1D1F] disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </button>
          <button
            onClick={() => openWizard()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white rounded-full hover:bg-[#333336] transition-all font-medium text-[13px] shadow-sm"
          >
            <Zap className="w-4 h-4" /> Nouvelle production
          </button>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="glass-card overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-black/[0.04] overflow-x-auto" role="tablist" aria-label="Sections production">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: Activity },
            { key: 'orders', label: 'Ordres', icon: Clock, badge: stats.inProgress > 0 ? stats.inProgress : null },
            { key: 'products', label: 'Produits', icon: Package },
            { key: 'calendar', label: 'Planning', icon: Calendar },
            { key: 'traceability', label: 'Traçabilité', icon: Search },
            { key: 'analytics', label: 'Analytiques', icon: BarChart3 },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setMainTab(tab.key as typeof mainTab)} role="tab" aria-selected={mainTab === tab.key} aria-controls={`panel-${tab.key}`} id={`tab-${tab.key}`} className={cn(
              'flex-shrink-0 px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-all',
              mainTab === tab.key
                ? 'text-[#AF52DE] border-b-2 border-[#AF52DE] bg-[#AF52DE]/5'
                : 'text-[#86868B] hover:bg-white/40'
            )}>
              <tab.icon className="w-4 h-4" /> {tab.label}
              {tab.badge && (
                <span className="px-2 py-0.5 bg-[#AF52DE]/10 text-[#AF52DE] text-[11px] font-semibold rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* TAB: DASHBOARD (extracted component) */}
        {mainTab === 'dashboard' && (
          <div role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard"><ProductionDashboardTab
            kpis={kpis}
            alertsData={alertsData}
            stockPf={stockPf}
            calendarData={calendarData}
            orders={orders}
            supplyRisks={supplyRisks}
            isLoadingSupplyRisks={isLoadingSupplyRisks}
            showSupplyRisksDetails={showSupplyRisksDetails}
            onToggleSupplyRisksDetails={setShowSupplyRisksDetails}
            productionsAtRisk={productionsAtRisk}
            isLoadingAtRisk={isLoadingAtRisk}
            lastSupplyAnalysis={lastSupplyAnalysis}
            approManager={approManager}
            onNavigateToCalendar={() => setMainTab('calendar')}
            onNavigateToOrders={() => setMainTab('orders')}
          />
          </div>
        )}

        {/* TAB: PRODUITS (extracted component) */}
        {mainTab === 'products' && (
          <div role="tabpanel" id="panel-products" aria-labelledby="tab-products"><ProductionProductsTab
            products={products}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onNewProduct={() => setShowNewProduct(true)}
          />
          </div>
        )}

        {/* TAB: ORDRES (extracted component) */}
        {mainTab === 'orders' && (
          <div role="tabpanel" id="panel-orders" aria-labelledby="tab-orders"><ProductionOrdersTab
            orders={orders}
            filter={orderFilter}
            onFilterChange={setOrderFilter}
            onNewProduction={() => openWizard()}
          />
          </div>
        )}

        {/* TAB: CALENDAR (extracted component) */}
        {mainTab === 'calendar' && <div role="tabpanel" id="panel-calendar" aria-labelledby="tab-calendar"><ProductionCalendarTab calendarData={calendarData} /></div>}

        {/* TAB: TRACEABILITY (extracted component) */}
        {mainTab === 'traceability' && (
          <div role="tabpanel" id="panel-traceability" aria-labelledby="tab-traceability"><ProductionTraceabilityTab
            lotSearchQuery={lotSearchQuery}
            onSearchChange={(q) => { setLotSearchQuery(q); searchLots(q); }}
            lotSearchResults={lotSearchResults}
            isSearchingLots={isSearchingLots}
          />
          </div>
        )}

        {/* TAB: ANALYTICS (extracted component) */}
        {mainTab === 'analytics' && (
          <div role="tabpanel" id="panel-analytics" aria-labelledby="tab-analytics"><ProductionAnalyticsTab
            analytics={analytics}
            analyticsPeriod={analyticsPeriod}
            onPeriodChange={setAnalyticsPeriod}
          />
          </div>
        )}
      </div>

      {/* MODAL: Nouveau Produit (extracted component) */}
      <NewProductModal
        isOpen={showNewProduct}
        onClose={() => setShowNewProduct(false)}
        onSuccess={loadProducts}
      />

      {/* MODAL: Wizard Production (extracted component) */}
      <ProductionWizardModal
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        products={products}
        initialProduct={wizardInitialProduct}
        onSuccess={loadOrders}
      />
    </div>
  );
}
