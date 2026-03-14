'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Factory, Zap, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  type SupplyRisksData,
  type ProductionsAtRiskData,
  type ProductionOrder,
  type ProductPf,
  type DashboardKpis,
  type AlertsData,
  type StockPfItem,
  type CalendarDay,
  type AnalyticsData,
  type LotSearchResult,
  type MainTab,
  type RawProductionOrder,
  type RawProductPf,
  type RawRecipe,
  type AdminUsersResponse,
  ProductionLoadingSkeleton,
  ProductionTabBar,
} from '@/components/production';
import { createLogger } from '@/lib/logger';

const log = createLogger('Production');

const ProductionDashboardTab = dynamic(
  () => import('@/components/production/ProductionDashboardTab').then(mod => ({ default: mod.ProductionDashboardTab })),
  { loading: () => <div className="animate-pulse h-64 bg-gray-100/50 rounded-xl m-6" /> }
);
const ProductionProductsTab = dynamic(
  () => import('@/components/production/ProductionProductsTab').then(mod => ({ default: mod.ProductionProductsTab })),
  { loading: () => <div className="animate-pulse h-64 bg-gray-100/50 rounded-xl m-6" /> }
);
const ProductionOrdersTab = dynamic(
  () => import('@/components/production/ProductionOrdersTab').then(mod => ({ default: mod.ProductionOrdersTab })),
  { loading: () => <div className="animate-pulse h-64 bg-gray-100/50 rounded-xl m-6" /> }
);
const ProductionCalendarTab = dynamic(
  () => import('@/components/production/ProductionCalendarTab').then(mod => ({ default: mod.ProductionCalendarTab })),
  { loading: () => <div className="animate-pulse h-64 bg-gray-100/50 rounded-xl m-6" /> }
);
const ProductionTraceabilityTab = dynamic(
  () => import('@/components/production/ProductionTraceabilityTab').then(mod => ({ default: mod.ProductionTraceabilityTab })),
  { loading: () => <div className="animate-pulse h-64 bg-gray-100/50 rounded-xl m-6" /> }
);
const ProductionAnalyticsTab = dynamic(
  () => import('@/components/production/ProductionAnalyticsTab').then(mod => ({ default: mod.ProductionAnalyticsTab })),
  { loading: () => <div className="animate-pulse h-64 bg-gray-100/50 rounded-xl m-6" />, ssr: false }
);

const NewProductModal = dynamic(
  () => import('@/components/production/NewProductModal').then(mod => ({ default: mod.NewProductModal })),
  { loading: () => null }
);
const ProductionWizardModal = dynamic(
  () => import('@/components/production/ProductionWizardModal').then(mod => ({ default: mod.ProductionWizardModal })),
  { loading: () => <div className="animate-pulse p-8">Chargement...</div> }
);

export default function ProductionPage() {
  // Core state
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<ProductPf[]>([]);
  const [mainTab, setMainTab] = useState<MainTab>('dashboard');
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Dashboard KPIs & Alerts
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [alertsData, setAlertsData] = useState<AlertsData | null>(null);
  const [stockPf, setStockPf] = useState<StockPfItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Supply Risks & Productions at Risk
  const [supplyRisks, setSupplyRisks] = useState<SupplyRisksData | null>(null);
  const [isLoadingSupplyRisks, setIsLoadingSupplyRisks] = useState(false);
  const [showSupplyRisksDetails, setShowSupplyRisksDetails] = useState(false);
  const [productionsAtRisk, setProductionsAtRisk] = useState<ProductionsAtRiskData | null>(null);
  const [isLoadingAtRisk, setIsLoadingAtRisk] = useState(false);
  const [lastSupplyAnalysis, setLastSupplyAnalysis] = useState<Date | null>(null);
  const [approManager, setApproManager] = useState<{ id: number; name: string } | null>(null);
  // Calendar & Analytics
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'week' | 'month' | 'year'>('month');
  // Lot Traceability
  const [lotSearchQuery, setLotSearchQuery] = useState('');
  const [lotSearchResults, setLotSearchResults] = useState<LotSearchResult[]>([]);
  const [isSearchingLots, setIsSearchingLots] = useState(false);
  // Modals
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardInitialProduct, setWizardInitialProduct] = useState<ProductPf | null>(null);
  const [wizardInitialDate, setWizardInitialDate] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiFetch<RawProductionOrder[]>('/production?limit=100');
      setOrders(data.map((o) => ({
        id: o.id, reference: o.reference, productPfId: o.productPfId,
        productName: o.productPf?.name || 'Produit', productCode: o.productPf?.code || '-',
        quantity: o.targetQuantity || 0, quantityProduced: o.quantityProduced || 0,
        batchCount: o.batchCount || 1, status: o.status, yieldPercentage: o.yieldPercentage,
        createdAt: o.createdAt, user: o.user ? `${o.user.firstName} ${o.user.lastName}` : '-',
      })));
    } catch (error: unknown) {
      log.error('Failed to load orders', { error: (error as Error)?.message || String(error) });
      toast.error('Impossible de charger les ordres de production');
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const [productsResult, recipesResult] = await Promise.allSettled([
        apiFetch<RawProductPf[]>('/products/pf'),
        apiFetch<RawRecipe[]>('/recipes'),
      ]);
      if (productsResult.status !== 'fulfilled') { log.error('Products API error', { error: productsResult.reason }); toast.error('Erreur chargement des produits'); return; }
      const productsData = productsResult.value;
      const recipesData = recipesResult.status === 'fulfilled' ? recipesResult.value : [];
      const recipeMap = new Map<number, RawRecipe>();
      recipesData.forEach((r) => recipeMap.set(r.productPfId, r));
      setProducts(productsData.map((p) => {
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
    } catch (error: unknown) {
      log.error('Failed to load products', { error: (error as Error)?.message || String(error) });
      toast.error('Impossible de charger les produits finis');
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      const [kpisResult, alertsResult, stockPfResult, calendarResult] = await Promise.allSettled([
        apiFetch<DashboardKpis>('/production/dashboard/kpis'),
        apiFetch<AlertsData>('/production/dashboard/alerts'),
        apiFetch<StockPfItem[]>('/production/dashboard/stock-pf'),
        apiFetch<{ days: CalendarDay[] }>('/production/dashboard/calendar'),
      ]);
      if (kpisResult.status === 'fulfilled') setKpis(kpisResult.value);
      else toast.error('Erreur chargement KPIs production');
      if (alertsResult.status === 'fulfilled') setAlertsData(alertsResult.value);
      else toast.error('Erreur chargement alertes');
      if (stockPfResult.status === 'fulfilled') setStockPf(stockPfResult.value);
      else toast.error('Erreur chargement stock produits finis');
      if (calendarResult.status === 'fulfilled') setCalendarData(calendarResult.value.days || []);
      else toast.error('Erreur chargement calendrier');
    } catch (error: unknown) {
      log.error('Failed to load dashboard data', { error: (error as Error)?.message || String(error) });
      toast.error('Erreur réseau — impossible de charger le tableau de bord');
    }
  }, []);

  const loadSupplyRisks = useCallback(async () => {
    setIsLoadingSupplyRisks(true);
    try {
      const data = await apiFetch<SupplyRisksData>('/production/dashboard/supply-risks');
      setSupplyRisks(data);
    } catch (error: unknown) {
      log.error('Failed to load supply risks', { error: (error as Error)?.message || String(error) });
      toast.error('Impossible de charger les risques supply chain');
    } finally { setIsLoadingSupplyRisks(false); }
  }, []);

  const loadProductionsAtRisk = useCallback(async () => {
    setIsLoadingAtRisk(true);
    try {
      const data = await apiFetch<ProductionsAtRiskData>('/production/dashboard/at-risk');
      setProductionsAtRisk(data);
      setLastSupplyAnalysis(new Date()); // ERP Premium: Horodatage
    } catch (error: unknown) {
      log.error('Failed to load productions at risk', { error: (error as Error)?.message || String(error) });
      toast.error('Impossible de charger les productions à risque');
    } finally { setIsLoadingAtRisk(false); }
  }, []);

  const loadApproManager = useCallback(async () => {
    try {
      const data = await apiFetch<AdminUsersResponse>('/admin/users?role=APPRO');
      const mgr = (data.users || [])[0];
      if (mgr) setApproManager({ id: mgr.id, name: `${mgr.firstName || ''} ${mgr.lastName || ''}`.trim() || mgr.email });
    } catch (error: unknown) { log.debug('Appro manager not found', { error: (error as Error)?.message }); }
  }, []);

  const loadAnalytics = useCallback(async (period: 'week' | 'month' | 'year') => {
    try {
      const data = await apiFetch<AnalyticsData>(`/production/dashboard/analytics?period=${period}`);
      setAnalytics(data);
    } catch (error: unknown) {
      log.error('Failed to load analytics', { error: (error as Error)?.message || String(error) });
      toast.error('Impossible de charger les analytics');
    }
  }, []);

  const searchLots = useCallback(async (query: string) => {
    if (!query || query.length < 2) { setLotSearchResults([]); return; }
    setIsSearchingLots(true);
    try {
      const data = await apiFetch<{ results: LotSearchResult[] }>(`/production/lots/search?q=${encodeURIComponent(query)}`);
      setLotSearchResults(data.results || []);
    } catch (error: unknown) {
      log.error('Failed to search lots', { error: (error as Error)?.message || String(error) });
    } finally { setIsSearchingLots(false); }
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
    if (mainTab === 'analytics') loadAnalytics(analyticsPeriod);
  }, [mainTab, analyticsPeriod, loadAnalytics]);

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((o) => o.status === 'PENDING').length,
    inProgress: orders.filter((o) => o.status === 'IN_PROGRESS').length,
    completed: orders.filter((o) => o.status === 'COMPLETED').length,
  }), [orders]);

  const openWizard = (product?: ProductPf, date?: string | null) => {
    setWizardInitialProduct(product || null);
    setWizardInitialDate(date || null);
    setShowWizard(true);
  };

  const openWizardForDate = (date: string | null) => {
    setWizardInitialProduct(null);
    setWizardInitialDate(date);
    setShowWizard(true);
  };

  if (isLoading) return <ProductionLoadingSkeleton />;

  return (
    <div className="glass-bg space-y-6">
      <PageHeader
        title="Production"
        subtitle="Centre de commande production"
        icon={<Factory className="w-5 h-5" />}
        badge={alertsData && alertsData.critical > 0
          ? { text: `${alertsData.critical} alerte(s) critique(s)`, variant: 'error' }
          : undefined}
        actions={(
          <div className="flex items-center gap-2">
            <Button onClick={refreshDashboard} disabled={isRefreshing} variant="outline" size="icon" aria-label="Actualiser la production">
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            </Button>
            <Button onClick={() => openWizard()}>
              <Zap className="w-4 h-4" />
              Nouvelle production
            </Button>
          </div>
        )}
      />

      {/* Main Tabs Container */}
      <div className="glass-card overflow-hidden">
        <ProductionTabBar activeTab={mainTab} onTabChange={setMainTab} inProgressCount={stats.inProgress} />

        {mainTab === 'dashboard' && (
          <div role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard">
            <ProductionDashboardTab
              kpis={kpis} alertsData={alertsData} stockPf={stockPf} calendarData={calendarData} orders={orders}
              supplyRisks={supplyRisks} isLoadingSupplyRisks={isLoadingSupplyRisks}
              showSupplyRisksDetails={showSupplyRisksDetails} onToggleSupplyRisksDetails={setShowSupplyRisksDetails}
              productionsAtRisk={productionsAtRisk} isLoadingAtRisk={isLoadingAtRisk}
              lastSupplyAnalysis={lastSupplyAnalysis} approManager={approManager}
              onNavigateToCalendar={() => setMainTab('calendar')} onNavigateToOrders={() => setMainTab('orders')}
            />
          </div>
        )}
        {mainTab === 'products' && (
          <div role="tabpanel" id="panel-products" aria-labelledby="tab-products">
            <ProductionProductsTab products={products} searchQuery={searchQuery} onSearchChange={setSearchQuery} onNewProduct={() => setShowNewProduct(true)} />
          </div>
        )}
        {mainTab === 'orders' && (
          <div role="tabpanel" id="panel-orders" aria-labelledby="tab-orders">
            <ProductionOrdersTab orders={orders} filter={orderFilter} onFilterChange={setOrderFilter} onNewProduction={() => openWizard()} />
          </div>
        )}
        {mainTab === 'calendar' && (
          <div role="tabpanel" id="panel-calendar" aria-labelledby="tab-calendar">
            <ProductionCalendarTab products={products} onOpenWizard={openWizardForDate} />
          </div>
        )}
        {mainTab === 'traceability' && (
          <div role="tabpanel" id="panel-traceability" aria-labelledby="tab-traceability">
            <ProductionTraceabilityTab lotSearchQuery={lotSearchQuery} onSearchChange={(q) => { setLotSearchQuery(q); searchLots(q); }} lotSearchResults={lotSearchResults} isSearchingLots={isSearchingLots} />
          </div>
        )}
        {mainTab === 'analytics' && (
          <div role="tabpanel" id="panel-analytics" aria-labelledby="tab-analytics">
            <ProductionAnalyticsTab analytics={analytics} analyticsPeriod={analyticsPeriod} onPeriodChange={setAnalyticsPeriod} />
          </div>
        )}
      </div>

      {/* Modals */}
      <NewProductModal isOpen={showNewProduct} onClose={() => setShowNewProduct(false)} onSuccess={loadProducts} />
      <ProductionWizardModal
        isOpen={showWizard} onClose={() => setShowWizard(false)} products={products}
        initialProduct={wizardInitialProduct} initialDate={wizardInitialDate}
        onSuccess={() => { loadOrders(); loadDashboardData(); }}
      />
    </div>
  );
}
