/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DASHBOARD SERVICE TESTS - KPIs et donnees agregees
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * INVARIANTS TESTES:
 * 1. getKpis() retourne stock, ventes, sync KPIs
 * 2. getSalesChart(days) retourne un tableau date/montant
 * 3. getSyncStatus() retourne la liste des appareils
 * 4. getRecentSyncEvents(limit) retourne les evenements recents
 * 5. getProductionDashboard(userId) retourne les stats de production
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockPrisma: any = {
    productMp: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    productPf: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    stockMovement: {
      groupBy: jest.fn(),
    },
    invoice: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    device: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    syncEvent: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    productionOrder: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    purchaseOrder: {
      count: jest.fn(),
    },
    recipe: {
      findMany: jest.fn(),
    },
  };

  const mockCacheService = {
    getOrSet: jest.fn((key: string, fn: () => any) => fn()),
    buildKpiKey: jest.fn((role?: string) => `dashboard:kpi${role ? ':' + role : ''}`),
    buildChartKey: jest.fn((chartType: string, days: number) => `chart:${chartType}:${days}d`),
    buildSyncKey: jest.fn((type: string) => `sync:${type}`),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();

    // Re-apply the default mock since clearAllMocks resets implementations
    mockCacheService.getOrSet.mockImplementation((key: string, fn: () => any) => fn());
    mockCacheService.buildKpiKey.mockImplementation((role?: string) => `dashboard:kpi${role ? ':' + role : ''}`);
    mockCacheService.buildChartKey.mockImplementation((chartType: string, days: number) => `chart:${chartType}:${days}d`);
    mockCacheService.buildSyncKey.mockImplementation((type: string) => `sync:${type}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getKpis()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getKpis', () => {
    it('devrait retourner les KPIs stock, ventes et sync', async () => {
      // Stock MP
      mockPrisma.productMp.findMany.mockResolvedValue([
        { id: 1, minStock: 100 },
        { id: 2, minStock: 50 },
      ]);
      // Stock PF
      mockPrisma.productPf.findMany.mockResolvedValue([
        { id: 1, minStock: 20 },
      ]);
      // Stock movements MP
      mockPrisma.stockMovement.groupBy
        .mockResolvedValueOnce([
          { productMpId: 1, movementType: 'IN', _sum: { quantity: 200 } },
          { productMpId: 1, movementType: 'OUT', _sum: { quantity: 50 } },
          { productMpId: 2, movementType: 'IN', _sum: { quantity: 30 } },
        ])
        // Stock movements PF
        .mockResolvedValueOnce([
          { productPfId: 1, movementType: 'IN', _sum: { quantity: 100 } },
          { productPfId: 1, movementType: 'OUT', _sum: { quantity: 10 } },
        ]);

      // Sales today
      mockPrisma.invoice.aggregate.mockResolvedValue({
        _sum: { netToPay: 500000 },
      });
      // Invoices count today
      mockPrisma.invoice.count.mockResolvedValue(5);
      // Offline devices
      mockPrisma.device.count.mockResolvedValue(2);
      // Pending sync events
      mockPrisma.syncEvent.count.mockResolvedValue(3);

      const result = await service.getKpis();

      expect(result).toHaveProperty('stock');
      expect(result).toHaveProperty('sales');
      expect(result).toHaveProperty('sync');
      expect(result).toHaveProperty('_meta');
      expect(result.stock.mp).toHaveProperty('total');
      expect(result.stock.mp).toHaveProperty('lowStock');
      expect(result.stock.pf).toHaveProperty('total');
      expect(result.sales).toHaveProperty('todayAmount');
      expect(result.sales).toHaveProperty('todayInvoices');
      expect(result.sync).toHaveProperty('devicesOffline');
      expect(result.sync).toHaveProperty('pendingEvents');
    });

    it('devrait retourner des KPIs par defaut en cas d\'erreur', async () => {
      // Force the cache to throw so the catch block is triggered
      mockCacheService.getOrSet.mockRejectedValueOnce(new Error('Redis down'));

      const result = await service.getKpis();

      expect(result.stock.mp.total).toBe(0);
      expect(result.stock.pf.total).toBe(0);
      expect(result.sales.todayAmount).toBe(0);
      expect(result.sales.todayInvoices).toBe(0);
      expect(result.sync.devicesOffline).toBe(0);
      expect(result.sync.pendingEvents).toBe(0);
      expect(result._meta).toHaveProperty('error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getSalesChart()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getSalesChart', () => {
    it('devrait retourner un tableau de date/montant pour les N derniers jours', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          date: today,
          netToPay: 150000,
        },
      ]);

      const result = await service.getSalesChart(7);

      expect(Array.isArray(result)).toBe(true);
      // 7 days + today = 8 entries
      expect(result.length).toBe(8);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('amount');
    });

    it('devrait retourner des montants a zero quand aucune vente', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      const result = await service.getSalesChart(3);

      expect(Array.isArray(result)).toBe(true);
      // All amounts should be 0
      for (const day of result) {
        expect(day.amount).toBe(0);
      }
    });

    it('devrait utiliser le cache via CacheService', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      await service.getSalesChart(7);

      expect(mockCacheService.getOrSet).toHaveBeenCalled();
      expect(mockCacheService.buildChartKey).toHaveBeenCalledWith('sales', 7);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getSyncStatus()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getSyncStatus', () => {
    it('devrait retourner la liste des appareils avec statut en ligne', async () => {
      const recentSync = new Date();
      const oldSync = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago

      mockPrisma.device.findMany.mockResolvedValue([
        { id: 'dev-1', name: 'Samsung Galaxy', lastSyncAt: recentSync },
        { id: 'dev-2', name: 'iPad Pro', lastSyncAt: oldSync },
        { id: 'dev-3', name: 'Nouvel appareil', lastSyncAt: null },
      ]);

      const result = await service.getSyncStatus();

      expect(result).toHaveLength(3);

      // Recently synced device should be online
      expect(result[0].deviceId).toBe('dev-1');
      expect(result[0].name).toBe('Samsung Galaxy');
      expect(result[0].online).toBe(true);
      expect(result[0].lastSync).toBeDefined();

      // Old sync device should be offline
      expect(result[1].deviceId).toBe('dev-2');
      expect(result[1].online).toBe(false);

      // No sync device should be offline
      expect(result[2].deviceId).toBe('dev-3');
      expect(result[2].online).toBe(false);
      expect(result[2].lastSync).toBeNull();
    });

    it('devrait retourner un tableau vide quand aucun appareil actif', async () => {
      mockPrisma.device.findMany.mockResolvedValue([]);

      const result = await service.getSyncStatus();
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getRecentSyncEvents()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getRecentSyncEvents', () => {
    it('devrait retourner les evenements de sync recents avec la limite', async () => {
      const events = [
        { id: 'evt-1', entityType: 'Invoice', action: 'CREATE', status: 'APPLIED', deviceId: 'dev-1', createdAt: new Date() },
        { id: 'evt-2', entityType: 'StockMovement', action: 'CREATE', status: 'PENDING', deviceId: 'dev-2', createdAt: new Date() },
      ];
      mockPrisma.syncEvent.findMany.mockResolvedValue(events);

      const result = await service.getRecentSyncEvents(10);

      expect(result).toEqual(events);
      expect(mockPrisma.syncEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('devrait utiliser la limite par defaut de 20', async () => {
      mockPrisma.syncEvent.findMany.mockResolvedValue([]);

      await service.getRecentSyncEvents();

      expect(mockPrisma.syncEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getProductionDashboard()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getProductionDashboard', () => {
    it('devrait retourner les stats de production sans donnees financieres', async () => {
      // ordersToday
      mockPrisma.productionOrder.count
        .mockResolvedValueOnce(3)  // ordersToday
        .mockResolvedValueOnce(5)  // ordersPending
        .mockResolvedValueOnce(2)  // ordersInProgress
        .mockResolvedValueOnce(10); // ordersCompleted (7j)

      // productionStats: completed orders with quantities
      mockPrisma.productionOrder.findMany.mockResolvedValue([
        { targetQuantity: 100, quantityProduced: 95 },
        { targetQuantity: 200, quantityProduced: 190 },
      ]);

      // MP alerts
      mockPrisma.productMp.findMany.mockResolvedValue([
        { id: 1, code: 'MP-001', name: 'Lait', minStock: 100, isStockTracked: true },
      ]);
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { productMpId: 1, movementType: 'IN', _sum: { quantity: 50 } },
      ]);

      // Recettes non configurees
      mockPrisma.recipe.findMany.mockResolvedValue([]);
      mockPrisma.productPf.count.mockResolvedValue(3);

      // Purchase orders
      mockPrisma.purchaseOrder.count
        .mockResolvedValueOnce(2)  // SENT
        .mockResolvedValueOnce(4); // DRAFT

      const result = await service.getProductionDashboard('user-1');

      // Verifier la structure
      expect(result).toHaveProperty('production');
      expect(result).toHaveProperty('approvisionnement');
      expect(result).toHaveProperty('alertes');
      expect(result).toHaveProperty('_meta');

      // Verifier les compteurs production
      expect(result.production.ordersToday).toBe(3);
      expect(result.production.ordersPending).toBe(5);
      expect(result.production.ordersInProgress).toBe(2);
      expect(result.production.ordersCompleted).toBe(10);
      expect(result.production.quantiteProduite).toBe(285); // 95 + 190
      expect(result.production.rendementMoyen).toBe(95); // avg(95%, 95%)

      // Verifier les alertes appro
      expect(result.approvisionnement.mpSousSeuil).toBe(1); // stock 50 <= minStock 100
      expect(result.approvisionnement.demandesEnvoyees).toBe(2);
      expect(result.approvisionnement.demandesEnAttente).toBe(4);

      // Verifier les recettes non configurees
      expect(result.alertes.recettesNonConfigurees).toBe(3);

      // Aucune donnee financiere dans le dashboard production
      expect(result).not.toHaveProperty('sales');
      expect(result).not.toHaveProperty('revenue');
    });

    it('devrait retourner rendement 0 quand aucun ordre complete', async () => {
      mockPrisma.productionOrder.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      mockPrisma.productionOrder.findMany.mockResolvedValue([]);

      mockPrisma.productMp.findMany.mockResolvedValue([]);
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);

      mockPrisma.recipe.findMany.mockResolvedValue([]);
      mockPrisma.productPf.count.mockResolvedValue(0);

      mockPrisma.purchaseOrder.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getProductionDashboard('user-1');

      expect(result.production.quantiteProduite).toBe(0);
      expect(result.production.rendementMoyen).toBe(0);
    });

    it('devrait gerer les erreurs de purchaseOrder gracieusement', async () => {
      mockPrisma.productionOrder.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      mockPrisma.productionOrder.findMany.mockResolvedValue([]);

      mockPrisma.productMp.findMany.mockResolvedValue([]);
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);

      mockPrisma.recipe.findMany.mockResolvedValue([]);
      mockPrisma.productPf.count.mockResolvedValue(0);

      // purchaseOrder.count rejects (table might not exist)
      mockPrisma.purchaseOrder.count
        .mockRejectedValueOnce(new Error('Table not found'))
        .mockRejectedValueOnce(new Error('Table not found'));

      const result = await service.getProductionDashboard('user-1');

      // Should fallback to 0 (caught error)
      expect(result.approvisionnement.demandesEnvoyees).toBe(0);
      expect(result.approvisionnement.demandesEnAttente).toBe(0);
    });
  });
});
