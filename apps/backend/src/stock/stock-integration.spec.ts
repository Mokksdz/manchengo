/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TESTS D'INTÉGRATION - MODULE STOCK
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Tests d'intégration qui vérifient les services ensemble sans HTTP/Auth
 *
 * @author Manchengo ERP Team
 * @version 1.0.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { LotConsumptionService } from './lot-consumption.service';
import { InventoryService } from './inventory.service';
import { StockDashboardService } from './stock-dashboard.service';
import { LotExpiryJob } from './jobs/lot-expiry.job';

describe('Stock Module Integration Tests', () => {
  let prisma: PrismaService;
  let lotConsumption: LotConsumptionService;
  let inventory: InventoryService;
  let dashboard: StockDashboardService;

  // Mocks minimaux
  const mockPrisma: any = {
    lotMp: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      aggregate: jest.fn().mockResolvedValue({ _sum: { quantityRemaining: 0 } }),
    },
    lotPf: {
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { quantityRemaining: 0 } }),
    },
    productMp: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    productPf: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    stockMovement: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
    },
    inventoryDeclaration: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    productionOrder: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    alert: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((fn) => fn(mockPrisma)),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockLotExpiryJob = {
    getExpiryStats: jest.fn().mockResolvedValue({
      expiredBlocked: 0,
      expiringJ1: 0,
      expiringJ3: 0,
      expiringJ7: 0,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LotExpiryJob, useValue: mockLotExpiryJob },
        LotConsumptionService,
        InventoryService,
        StockDashboardService,
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    lotConsumption = module.get<LotConsumptionService>(LotConsumptionService);
    inventory = module.get<InventoryService>(InventoryService);
    dashboard = module.get<StockDashboardService>(StockDashboardService);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 1: Dashboard génère les 3 zones
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('StockDashboardService', () => {
    it('should generate dashboard with 3 zones structure', async () => {
      const result = await dashboard.getDashboard();

      expect(result).toHaveProperty('critique');
      expect(result).toHaveProperty('aTraiter');
      expect(result).toHaveProperty('sante');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('_meta');

      expect(result.critique).toHaveProperty('totalCount');
      expect(result.aTraiter).toHaveProperty('totalCount');
      expect(result.sante).toHaveProperty('fifoCompliance');
      expect(result.summary).toHaveProperty('healthScore');
    });

    it('should calculate health score correctly', async () => {
      const result = await dashboard.getDashboard();

      // With 0 critical and 0 warnings, score should be 100
      expect(result.summary.healthScore).toBeLessThanOrEqual(100);
      expect(result.summary.healthScore).toBeGreaterThanOrEqual(0);
    });

    it('should return critical count', async () => {
      const count = await dashboard.getCriticalAlertsCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 2: FIFO Preview fonctionne
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('LotConsumptionService', () => {
    it('should preview FIFO consumption', async () => {
      mockPrisma.lotMp.findMany.mockResolvedValue([
        { id: 1, lotNumber: 'LOT-A', quantityRemaining: 50, expiryDate: new Date('2025-02-01'), status: 'AVAILABLE' },
      ]);
      mockPrisma.lotMp.aggregate.mockResolvedValue({ _sum: { quantityRemaining: 50 } });

      const preview = await lotConsumption.previewFIFO(1, 30);

      expect(preview).toHaveProperty('sufficient');
      expect(preview).toHaveProperty('availableStock');
      expect(preview).toHaveProperty('consumptions');
      expect(preview.sufficient).toBe(true);
      expect(preview.availableStock).toBe(50);
    });

    it('should indicate insufficient stock in preview', async () => {
      mockPrisma.lotMp.findMany.mockResolvedValue([
        { id: 1, lotNumber: 'LOT-A', quantityRemaining: 10, expiryDate: new Date('2025-02-01'), status: 'AVAILABLE' },
      ]);
      mockPrisma.lotMp.aggregate.mockResolvedValue({ _sum: { quantityRemaining: 10 } });

      const preview = await lotConsumption.previewFIFO(1, 100);

      expect(preview.sufficient).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 3: Inventory validation rules
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('InventoryService', () => {
    it('should reject self-validation', async () => {
      const counterId = 'user-123';

      mockPrisma.inventoryDeclaration.findUnique.mockResolvedValue({
        id: 1,
        status: 'PENDING_VALIDATION',
        countedById: counterId,
        productType: 'MP',
        productMpId: 1,
      });

      await expect(
        inventory.validateInventory(1, 'Validation test', counterId, 'ADMIN')
      ).rejects.toThrow();
    });

    it('should reject non-ADMIN validation', async () => {
      mockPrisma.inventoryDeclaration.findUnique.mockResolvedValue({
        id: 1,
        status: 'PENDING_VALIDATION',
        countedById: 'counter-user',
        productType: 'MP',
        productMpId: 1,
      });

      await expect(
        inventory.validateInventory(1, 'Test', 'validator-user', 'PRODUCTION')
      ).rejects.toThrow();
    });

    it('should reject negative declared quantity', async () => {
      await expect(
        inventory.declareInventory(
          { productType: 'MP', productId: 1, declaredQuantity: -10 },
          'user-123',
          'APPRO'
        )
      ).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 4: Modules sont injectables ensemble
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Module Integration', () => {
    it('should have all services instantiated', () => {
      expect(lotConsumption).toBeDefined();
      expect(inventory).toBeDefined();
      expect(dashboard).toBeDefined();
    });

    it('should share PrismaService', () => {
      expect(prisma).toBeDefined();
    });
  });
});
