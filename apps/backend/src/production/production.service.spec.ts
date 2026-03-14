/**
 * ===============================================================================
 * PRODUCTION SERVICE TESTS - Workflow de production
 * ===============================================================================
 *
 * INVARIANTS TESTES:
 * 1. Impossible de creer un ordre sans recette
 * 2. Impossible de creer un ordre pour un produit inexistant
 * 3. Impossible de demarrer un ordre non-PENDING
 * 4. Impossible de terminer un ordre non-IN_PROGRESS
 * 5. Impossible d'annuler un ordre termine
 * 6. Completion cree lot PF et mouvement stock
 * 7. Annulation IN_PROGRESS reverse les consommations MP
 * 8. Calcul du rendement correct
 * 9. Verification stock insuffisant au demarrage
 * 10. createOrder() - with insufficient MP stock (should fail)
 * 11. startOrder() - verify MP consumption (FIFO lots)
 * 12. completeOrder() - verify PF stock created, yield calculation
 * 13. cancelOrder() - verify MP stock reversed
 * 14. Recipe validation - missing ingredients
 * 15. Production order status transitions: PENDING->IN_PROGRESS->COMPLETED, PENDING->CANCELLED
 * 16. Reject invalid transitions: COMPLETED->IN_PROGRESS, CANCELLED->anything
 * 17. Production consumption creates correct StockMovement records
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductionService } from './production.service';
import { RecipeService } from './recipe.service';
import { LotConsumptionService } from '../stock/lot-consumption.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../common/logger/logger.service';
import { AuditService } from '../common/audit/audit.service';
import { CacheService } from '../cache/cache.service';

describe('ProductionService - Invariants metier', () => {
  let service: ProductionService;

  // Mocks
  const mockPrisma: any = {
    productPf: {
      findUnique: jest.fn(),
    },
    productionOrder: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    productionConsumption: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    stockMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    lotPf: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    lotMp: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fnOrArray: any) => {
      if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
      return Promise.all(fnOrArray);
    }),
  };

  const mockRecipeService = {
    checkStockAvailability: jest.fn(),
  };

  const mockLotConsumption = {
    previewFIFO: jest.fn(),
    consumeFIFO: jest.fn(),
  };

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    businessWarn: jest.fn(),
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockCacheService = {
    invalidateStockCache: jest.fn().mockResolvedValue(undefined),
    invalidateProductionCache: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RecipeService, useValue: mockRecipeService },
        { provide: LotConsumptionService, useValue: mockLotConsumption },
        { provide: LoggerService, useValue: mockLogger },
        { provide: AuditService, useValue: mockAudit },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<ProductionService>(ProductionService);
    jest.clearAllMocks();
  });

  // ===========================================================================
  // CREATION ORDRE DE PRODUCTION
  // ===========================================================================

  describe('Creation d\'ordre de production', () => {
    it('devrait rejeter quand le produit PF n\'existe pas', async () => {
      mockPrisma.productPf.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ productPfId: 99999, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('devrait rejeter quand le produit n\'a pas de recette', async () => {
      mockPrisma.productPf.findUnique.mockResolvedValue({
        id: 1,
        code: 'PF-001',
        name: 'Fromage sans recette',
        recipe: null,
      });

      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(/Aucune recette définie/);
    });

    it('devrait rejeter quand le stock MP est insuffisant', async () => {
      mockPrisma.productPf.findUnique.mockResolvedValue({
        id: 1,
        code: 'PF-001',
        name: 'Fromage',
        recipe: { id: 1, outputQuantity: 10, batchWeight: 5, name: 'Recette fromage', items: [{ id: 1, quantity: 100, productMpId: 1, productMp: { code: 'MP-LAIT', unit: 'L' } }] },
      });
      mockRecipeService.checkStockAvailability.mockResolvedValue({
        canProduce: false,
        availability: [
          {
            isAvailable: false,
            isMandatory: true,
            shortage: 50,
            productMp: { code: 'MP-LAIT', unit: 'L' },
          },
        ],
      });

      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(/Stock insuffisant/);
    });

    it('devrait creer un ordre avec les bonnes donnees', async () => {
      const recipe = { id: 1, outputQuantity: 10, batchWeight: 5, name: 'Recette fromage', items: [{ id: 1, quantity: 100, productMpId: 1, productMp: { code: 'MP-LAIT', unit: 'L' } }] };
      mockPrisma.productPf.findUnique.mockResolvedValue({
        id: 1,
        code: 'PF-001',
        name: 'Fromage',
        recipe,
      });
      mockRecipeService.checkStockAvailability.mockResolvedValue({
        canProduce: true,
        availability: [],
      });
      // generateReference mocks
      mockPrisma.productionOrder.findFirst.mockResolvedValue(null);
      mockPrisma.productionOrder.create.mockResolvedValue({
        id: 1,
        reference: 'OP-260202-001',
        status: 'PENDING',
        batchCount: 2,
        targetQuantity: 20,
        productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG' },
        recipe: { id: 1, name: 'Recette fromage', batchWeight: 5, outputQuantity: 10 },
      });

      const result = await service.create(
        { productPfId: 1, batchCount: 2 },
        'user-1',
      );

      if (!result) throw new Error('Expected create() to return an order');
      expect(result.status).toBe('PENDING');
      expect(result.batchCount).toBe(2);
      expect(result.targetQuantity).toBe(20); // 2 batches * 10 output
      expect(mockPrisma.productionOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            batchCount: 2,
            targetQuantity: 20,
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // CREATION WITH INSUFFICIENT MP STOCK (should fail)
  // ===========================================================================

  describe('createOrder with insufficient MP stock', () => {
    it('devrait echouer quand plusieurs MP sont en shortage', async () => {
      mockPrisma.productPf.findUnique.mockResolvedValue({
        id: 1,
        code: 'PF-001',
        name: 'Fromage Complet',
        recipe: {
          id: 1,
          outputQuantity: 10,
          batchWeight: 5,
          name: 'Recette fromage complet',
          items: [
            { id: 1, quantity: 100, productMpId: 1, productMp: { code: 'MP-LAIT', unit: 'L' } },
            { id: 2, quantity: 5, productMpId: 2, productMp: { code: 'MP-SEL', unit: 'KG' } },
          ],
        },
      });
      mockRecipeService.checkStockAvailability.mockResolvedValue({
        canProduce: false,
        availability: [
          { isAvailable: false, isMandatory: true, shortage: 50, productMp: { code: 'MP-LAIT', unit: 'L' } },
          { isAvailable: false, isMandatory: true, shortage: 3, productMp: { code: 'MP-SEL', unit: 'KG' } },
        ],
      });

      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(/Stock insuffisant/);
    });

    it('devrait echouer quand batchCount multiplie les besoins au-dela du stock', async () => {
      mockPrisma.productPf.findUnique.mockResolvedValue({
        id: 1,
        code: 'PF-001',
        name: 'Fromage',
        recipe: {
          id: 1,
          outputQuantity: 10,
          batchWeight: 5,
          name: 'Recette',
          items: [{ id: 1, quantity: 100, productMpId: 1, productMp: { code: 'MP-LAIT', unit: 'L' } }],
        },
      });

      // batchCount = 5 means 500L needed, but only 300L available
      mockRecipeService.checkStockAvailability.mockResolvedValue({
        canProduce: false,
        availability: [
          { isAvailable: false, isMandatory: true, shortage: 200, productMp: { code: 'MP-LAIT', unit: 'L' } },
        ],
      });

      await expect(
        service.create({ productPfId: 1, batchCount: 5 }, 'user-1'),
      ).rejects.toThrow(/Stock insuffisant/);
    });
  });

  // ===========================================================================
  // RECIPE VALIDATION - MISSING INGREDIENTS
  // ===========================================================================

  describe('Recipe validation - missing ingredients', () => {
    it('devrait rejeter quand la recette n\'a aucun ingredient', async () => {
      mockPrisma.productPf.findUnique.mockResolvedValue({
        id: 1,
        code: 'PF-001',
        name: 'Fromage',
        recipe: {
          id: 1,
          outputQuantity: 10,
          batchWeight: 5,
          name: 'Recette vide',
          items: [], // Empty items!
        },
      });

      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(/aucun ingrédient/);
    });

    it('devrait rejeter quand la recette n\'a pas de batchWeight', async () => {
      mockPrisma.productPf.findUnique.mockResolvedValue({
        id: 1,
        code: 'PF-001',
        name: 'Fromage',
        recipe: {
          id: 1,
          outputQuantity: 10,
          batchWeight: 0, // Invalid!
          name: 'Recette sans poids',
          items: [{ id: 1, quantity: 100, productMpId: 1 }],
        },
      });

      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(/batchWeight/);
    });

    it('devrait rejeter quand la recette n\'a pas d\'outputQuantity', async () => {
      mockPrisma.productPf.findUnique.mockResolvedValue({
        id: 1,
        code: 'PF-001',
        name: 'Fromage',
        recipe: {
          id: 1,
          outputQuantity: 0, // Invalid!
          batchWeight: 5,
          name: 'Recette sans output',
          items: [{ id: 1, quantity: 100, productMpId: 1 }],
        },
      });

      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ productPfId: 1, batchCount: 1 }, 'user-1'),
      ).rejects.toThrow(/outputQuantity/);
    });
  });

  // ===========================================================================
  // COMPLETION PRODUCTION
  // ===========================================================================

  describe('Completion de production', () => {
    const orderInProgress = {
      id: 1,
      reference: 'OP-260202-001',
      status: 'IN_PROGRESS',
      productPfId: 1,
      targetQuantity: 20,
      batchCount: 2,
      productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG', priceHt: 100000 },
      recipe: {
        id: 1,
        name: 'Recette',
        lossTolerance: 0.1,
        shelfLifeDays: 30,
        items: [],
      },
      consumptions: [
        {
          productMpId: 1,
          quantityConsumed: 100,
          quantityPlanned: 100,
          unitCost: 500,
          productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
          lotMp: { id: 1, lotNumber: 'LOT-MP-001', expiryDate: null },
          lotMpId: 1,
        },
      ],
      lots: [],
      user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
    };

    it('devrait rejeter la completion d\'un ordre PENDING', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...orderInProgress,
        status: 'PENDING',
      });

      await expect(
        service.complete(1, { quantityProduced: 10, qualityStatus: 'PASSED' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.complete(1, { quantityProduced: 10, qualityStatus: 'PASSED' }, 'user-1'),
      ).rejects.toThrow(/statut actuel = PENDING/);
    });

    it('devrait rejeter la completion d\'un ordre deja COMPLETED', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...orderInProgress,
        status: 'COMPLETED',
      });

      await expect(
        service.complete(1, { quantityProduced: 10, qualityStatus: 'PASSED' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.complete(1, { quantityProduced: 10, qualityStatus: 'PASSED' }, 'user-1'),
      ).rejects.toThrow(/statut actuel = COMPLETED/);
    });

    it('devrait rejeter la completion d\'un ordre CANCELLED', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...orderInProgress,
        status: 'CANCELLED',
      });

      await expect(
        service.complete(1, { quantityProduced: 10, qualityStatus: 'PASSED' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait creer un lot PF et un mouvement IN lors de la completion', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderInProgress);
      // generateLotNumber
      mockPrisma.lotPf.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.lotPf.create.mockResolvedValue({
        id: 1,
        lotNumber: 'PF-001-260202-001',
        quantityInitial: 18,
        quantityRemaining: 18,
        manufactureDate: new Date(),
        expiryDate: new Date(),
        unitCost: 2778,
        isActive: true,
        status: 'AVAILABLE',
      });
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderInProgress,
        status: 'COMPLETED',
        quantityProduced: 18,
        yieldPercentage: 90,
        lots: [{ id: 1, lotNumber: 'PF-001-260202-001', quantityInitial: 18 }],
      });

      const result = await service.complete(1, { quantityProduced: 18, qualityStatus: 'PASSED' }, 'user-1');

      expect(result.createdLot).toBeDefined();
      expect(result.createdLot.quantityInitial).toBe(18);
      expect(mockPrisma.lotPf.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantityInitial: 18,
            status: 'AVAILABLE',
          }),
        }),
      );
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'IN',
            productType: 'PF',
            origin: 'PRODUCTION_IN',
            quantity: 18,
          }),
        }),
      );
    });

    it('devrait calculer le rendement correctement', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderInProgress);
      mockPrisma.lotPf.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.lotPf.create.mockResolvedValue({
        id: 1, lotNumber: 'LOT-PF', quantityInitial: 15,
        quantityRemaining: 15, unitCost: 0, isActive: true, status: 'AVAILABLE',
      });
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockImplementation(async ({ data }: any) => {
        // Le rendement est 15/20 = 75%
        expect(data.yieldPercentage).toBe(75);
        return {
          ...orderInProgress,
          status: 'COMPLETED',
          quantityProduced: 15,
          yieldPercentage: 75,
          lots: [],
        };
      });

      await service.complete(1, { quantityProduced: 15, qualityStatus: 'PASSED' }, 'user-1');

      expect(mockPrisma.productionOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantityProduced: 15,
            yieldPercentage: 75,
            status: 'COMPLETED',
          }),
        }),
      );
    });

    it('devrait emettre un warning pour un rendement inferieur a la tolerance', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...orderInProgress,
        recipe: { ...orderInProgress.recipe, lossTolerance: 0.1 },
      });
      mockPrisma.lotPf.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.lotPf.create.mockResolvedValue({
        id: 1, lotNumber: 'LOT', quantityInitial: 10,
        quantityRemaining: 10, unitCost: 0, isActive: true, status: 'AVAILABLE',
      });
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderInProgress, status: 'COMPLETED', quantityProduced: 10, lots: [],
      });

      // quantityProduced=10, targetQuantity=20, minAcceptable=20*0.9=18
      await service.complete(1, { quantityProduced: 10, qualityStatus: 'PASSED' }, 'user-1');

      expect(mockLogger.businessWarn).toHaveBeenCalledWith(
        'PRODUCTION_LOW_YIELD',
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  // ===========================================================================
  // COMPLETE ORDER - VERIFY PF STOCK CREATED & YIELD CALCULATION
  // ===========================================================================

  describe('completeOrder - verify PF stock created and yield calculation', () => {
    const orderInProgress = {
      id: 2,
      reference: 'OP-260202-002',
      status: 'IN_PROGRESS',
      productPfId: 2,
      targetQuantity: 50,
      batchCount: 5,
      productPf: { id: 2, code: 'PF-002', name: 'Yaourt', unit: 'KG', priceHt: 50000 },
      recipe: {
        id: 2,
        name: 'Recette Yaourt',
        lossTolerance: 0.05,
        shelfLifeDays: 14,
        items: [],
      },
      consumptions: [
        {
          productMpId: 1,
          quantityConsumed: 200,
          quantityPlanned: 200,
          unitCost: 300,
          productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
          lotMp: { id: 1, lotNumber: 'LOT-MP-001', expiryDate: null },
          lotMpId: 1,
        },
        {
          productMpId: 3,
          quantityConsumed: 10,
          quantityPlanned: 10,
          unitCost: 1000,
          productMp: { id: 3, code: 'MP-FERMENT', name: 'Ferment', unit: 'KG' },
          lotMp: { id: 2, lotNumber: 'LOT-MP-002', expiryDate: null },
          lotMpId: 2,
        },
      ],
      lots: [],
      user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
    };

    it('devrait creer le mouvement stock PF IN avec le bon cout de revient', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderInProgress);
      mockPrisma.lotPf.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.lotPf.create.mockResolvedValue({
        id: 1,
        lotNumber: 'PF-002-260202-001',
        quantityInitial: 45,
        quantityRemaining: 45,
        unitCost: 1556, // (200*300 + 10*1000) / 45 = 70000/45 = 1555.55 -> 1556
        isActive: true,
        status: 'AVAILABLE',
      });
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderInProgress,
        status: 'COMPLETED',
        quantityProduced: 45,
        yieldPercentage: 90,
        lots: [{ id: 1, lotNumber: 'PF-002-260202-001', quantityInitial: 45 }],
      });

      const result = await service.complete(2, { quantityProduced: 45, qualityStatus: 'PASSED' }, 'user-1');

      expect(result.createdLot).toBeDefined();
      // Verify stock IN movement was created for PF
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'IN',
            productType: 'PF',
            origin: 'PRODUCTION_IN',
            productPfId: 2,
            quantity: 45,
          }),
        }),
      );
    });

    it('devrait calculer le rendement 100% quand production = target', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderInProgress);
      mockPrisma.lotPf.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.lotPf.create.mockResolvedValue({
        id: 1, lotNumber: 'LOT', quantityInitial: 50,
        quantityRemaining: 50, unitCost: 0, isActive: true, status: 'AVAILABLE',
      });
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderInProgress,
        status: 'COMPLETED',
        quantityProduced: 50,
        yieldPercentage: 100,
        lots: [],
      });

      await service.complete(2, { quantityProduced: 50, qualityStatus: 'PASSED' }, 'user-1');

      expect(mockPrisma.productionOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            yieldPercentage: 100, // 50/50 * 100
          }),
        }),
      );
    });

    it('devrait rejeter quantityProduced = 0', async () => {
      await expect(
        service.complete(2, { quantityProduced: 0, qualityStatus: 'PASSED' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.complete(2, { quantityProduced: 0, qualityStatus: 'PASSED' }, 'user-1'),
      ).rejects.toThrow(/strictement positive/);
    });

    it('devrait rejeter quantityProduced negative', async () => {
      await expect(
        service.complete(2, { quantityProduced: -5, qualityStatus: 'PASSED' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait creer le lot PF avec la DLC calculee depuis shelfLifeDays', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderInProgress);
      mockPrisma.lotPf.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.lotPf.create.mockResolvedValue({
        id: 1, lotNumber: 'LOT', quantityInitial: 45,
        quantityRemaining: 45, unitCost: 0, isActive: true, status: 'AVAILABLE',
      });
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderInProgress, status: 'COMPLETED', lots: [],
      });

      await service.complete(2, { quantityProduced: 45, qualityStatus: 'PASSED' }, 'user-1');

      // shelfLifeDays = 14, so expiryDate should be ~14 days from now
      const lotCreateCall = mockPrisma.lotPf.create.mock.calls[0][0];
      const expiryDate = lotCreateCall.data.expiryDate;
      expect(expiryDate).toBeInstanceOf(Date);
      // Verify it's approximately 14 days in the future (within 1 second tolerance)
      const expectedExpiry = new Date();
      expectedExpiry.setDate(expectedExpiry.getDate() + 14);
      expect(Math.abs(expiryDate.getTime() - expectedExpiry.getTime())).toBeLessThan(2000);
    });

    it('devrait invalider les caches stock et production apres completion', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderInProgress);
      mockPrisma.lotPf.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.lotPf.create.mockResolvedValue({
        id: 1, lotNumber: 'LOT', quantityInitial: 45,
        quantityRemaining: 45, unitCost: 0, isActive: true, status: 'AVAILABLE',
      });
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderInProgress, status: 'COMPLETED', lots: [],
      });

      await service.complete(2, { quantityProduced: 45, qualityStatus: 'PASSED' }, 'user-1');

      expect(mockCacheService.invalidateStockCache).toHaveBeenCalled();
      expect(mockCacheService.invalidateProductionCache).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // ANNULATION PRODUCTION
  // ===========================================================================

  describe('Annulation de production', () => {
    const orderCompleted = {
      id: 1,
      reference: 'OP-260202-001',
      status: 'COMPLETED',
      productPfId: 1,
      targetQuantity: 20,
      batchCount: 2,
      productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG', priceHt: 100000 },
      recipe: { id: 1, name: 'Recette', items: [] },
      consumptions: [],
      lots: [],
      user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
    };

    it('devrait rejeter l\'annulation d\'un ordre COMPLETED', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderCompleted);

      await expect(
        service.cancel(1, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.cancel(1, 'user-1'),
      ).rejects.toThrow(/Impossible d'annuler une production terminée/);
    });

    it('devrait annuler un ordre PENDING sans reverser de stock', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...orderCompleted,
        status: 'PENDING',
        consumptions: [],
      });
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderCompleted,
        status: 'CANCELLED',
      });

      const result = await service.cancel(1, 'user-1', 'Test annulation');

      expect(result.status).toBe('CANCELLED');
      // Pas de transaction pour reverser les consommations
      expect(mockPrisma.stockMovement.create).not.toHaveBeenCalled();
    });

    it('devrait annuler un ordre IN_PROGRESS et reverser les consommations MP', async () => {
      const consumptions = [
        {
          productMpId: 1,
          quantityConsumed: 100,
          lotMpId: 10,
          productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
          lotMp: { id: 10, lotNumber: 'LOT-MP-001', expiryDate: null },
        },
      ];

      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...orderCompleted,
        status: 'IN_PROGRESS',
        consumptions,
      });
      mockPrisma.lotMp.findUnique.mockResolvedValue({
        quantityRemaining: 0,
        status: 'CONSUMED',
      });
      mockPrisma.lotMp.update.mockResolvedValue({});
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionConsumption.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderCompleted,
        status: 'CANCELLED',
      });

      const result = await service.cancel(1, 'user-1', 'Defaut qualite');

      expect(result.status).toBe('CANCELLED');
      // Verifie que le mouvement de retour est cree avec l'origin PRODUCTION_CANCEL
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'IN',
            productType: 'MP',
            origin: 'PRODUCTION_CANCEL',
            quantity: 100,
          }),
        }),
      );
      // Verifie que les consommations sont marquees comme reversees (soft delete)
      expect(mockPrisma.productionConsumption.updateMany).toHaveBeenCalledWith({
        where: { productionOrderId: 1, isReversed: false },
        data: expect.objectContaining({ isReversed: true }),
      });
      // Verifie l'audit log
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRODUCTION_ORDER_CANCELLED',
          severity: 'WARNING',
        }),
      );
    });

    it('devrait rejeter quand l\'ordre n\'existe pas', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(null);

      await expect(
        service.cancel(99999, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // CANCEL ORDER - VERIFY MP STOCK REVERSED
  // ===========================================================================

  describe('cancelOrder - verify MP stock reversed', () => {
    it('devrait reverser chaque consommation MP avec un mouvement IN + PRODUCTION_CANCEL', async () => {
      const consumptions = [
        {
          productMpId: 1,
          quantityConsumed: 100,
          lotMpId: 10,
          productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
          lotMp: { id: 10, lotNumber: 'LOT-MP-001', expiryDate: null },
        },
        {
          productMpId: 2,
          quantityConsumed: 20,
          lotMpId: 11,
          productMp: { id: 2, code: 'MP-SEL', name: 'Sel', unit: 'KG' },
          lotMp: { id: 11, lotNumber: 'LOT-MP-002', expiryDate: null },
        },
      ];

      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        id: 1,
        reference: 'OP-260202-001',
        status: 'IN_PROGRESS',
        productPfId: 1,
        targetQuantity: 20,
        batchCount: 2,
        productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG', priceHt: 100000 },
        recipe: { id: 1, name: 'Recette', items: [] },
        consumptions,
        lots: [],
        user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
      });
      mockPrisma.lotMp.findUnique.mockResolvedValue({
        quantityRemaining: 0,
        status: 'CONSUMED',
      });
      mockPrisma.lotMp.update.mockResolvedValue({});
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionConsumption.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.productionOrder.update.mockResolvedValue({ status: 'CANCELLED' });

      await service.cancel(1, 'user-1', 'Annulation test');

      // Two stock reversal movements should be created (one per consumption)
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'IN',
            productType: 'MP',
            origin: 'PRODUCTION_CANCEL',
            productMpId: 1,
            quantity: 100,
          }),
        }),
      );
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'IN',
            productType: 'MP',
            origin: 'PRODUCTION_CANCEL',
            productMpId: 2,
            quantity: 20,
          }),
        }),
      );
    });

    it('devrait restaurer la quantite du lot MP et remettre le status a AVAILABLE', async () => {
      const consumptions = [
        {
          productMpId: 1,
          quantityConsumed: 50,
          lotMpId: 10,
          productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
          lotMp: { id: 10, lotNumber: 'LOT-MP-001', expiryDate: null },
        },
      ];

      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        id: 1,
        reference: 'OP-260202-001',
        status: 'IN_PROGRESS',
        productPfId: 1,
        targetQuantity: 10,
        batchCount: 1,
        productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG', priceHt: 100000 },
        recipe: { id: 1, name: 'Recette', items: [] },
        consumptions,
        lots: [],
        user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
      });
      mockPrisma.lotMp.findUnique.mockResolvedValue({
        quantityRemaining: 0,
        status: 'CONSUMED',
      });
      mockPrisma.lotMp.update.mockResolvedValue({});
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionConsumption.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.productionOrder.update.mockResolvedValue({ status: 'CANCELLED' });

      await service.cancel(1, 'user-1');

      // Lot should be restored: newQty = 0 + 50 = 50, status -> AVAILABLE
      expect(mockPrisma.lotMp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: expect.objectContaining({
            quantityRemaining: 50,
            status: 'AVAILABLE',
          }),
        }),
      );
    });

    it('devrait ne pas remettre a AVAILABLE un lot BLOCKED lors de l\'annulation', async () => {
      const consumptions = [
        {
          productMpId: 1,
          quantityConsumed: 50,
          lotMpId: 10,
          productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
          lotMp: { id: 10, lotNumber: 'LOT-MP-001', expiryDate: null },
        },
      ];

      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        id: 1,
        reference: 'OP-260202-001',
        status: 'IN_PROGRESS',
        productPfId: 1,
        targetQuantity: 10,
        batchCount: 1,
        productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG', priceHt: 100000 },
        recipe: { id: 1, name: 'Recette', items: [] },
        consumptions,
        lots: [],
        user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
      });
      // The lot is now BLOCKED (e.g., quality issue discovered after consumption)
      mockPrisma.lotMp.findUnique.mockResolvedValue({
        quantityRemaining: 0,
        status: 'BLOCKED',
      });
      mockPrisma.lotMp.update.mockResolvedValue({});
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionConsumption.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.productionOrder.update.mockResolvedValue({ status: 'CANCELLED' });

      await service.cancel(1, 'user-1');

      // Lot should stay BLOCKED, not be set back to AVAILABLE
      expect(mockPrisma.lotMp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'BLOCKED',
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // DEMARRAGE PRODUCTION
  // ===========================================================================

  describe('Demarrage de production', () => {
    const orderPending = {
      id: 1,
      reference: 'OP-260202-001',
      status: 'PENDING',
      productPfId: 1,
      targetQuantity: 10,
      batchCount: 1,
      productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG', priceHt: 100000 },
      recipe: {
        id: 1,
        name: 'Recette',
        items: [
          {
            productMpId: 1,
            productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
            quantity: 100,
            affectsStock: true,
            isMandatory: true,
          },
        ],
      },
      consumptions: [],
      lots: [],
      user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
    };

    it('devrait rejeter le demarrage d\'un ordre non-PENDING', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...orderPending,
        status: 'IN_PROGRESS',
      });

      await expect(
        service.start(1, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.start(1, 'user-1'),
      ).rejects.toThrow(/statut actuel = IN_PROGRESS/);
    });

    it('devrait rejeter le demarrage quand le stock MP est insuffisant (FIFO)', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderPending);
      mockLotConsumption.previewFIFO.mockResolvedValue({
        sufficient: false,
        availableStock: 50,
        consumptions: [],
      });

      await expect(
        service.start(1, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.start(1, 'user-1'),
      ).rejects.toThrow(/Stock insuffisant/);
    });

    it('devrait demarrer avec succes quand le stock est suffisant', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderPending);
      mockLotConsumption.previewFIFO.mockResolvedValue({
        sufficient: true,
        availableStock: 200,
        consumptions: [{ lotId: 1, quantity: 100 }],
      });
      mockLotConsumption.consumeFIFO.mockResolvedValue({
        consumptions: [{ lotId: 1, quantity: 100 }],
        lotsUsed: 1,
        totalConsumed: 100,
      });
      mockPrisma.lotMp.findMany.mockResolvedValue([{ id: 1, unitCost: 500 }]);
      mockPrisma.productionConsumption.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderPending,
        status: 'IN_PROGRESS',
        consumptions: [],
      });

      const result = await service.start(1, 'user-1');

      expect(result.status).toBe('IN_PROGRESS');
      expect(mockLotConsumption.consumeFIFO).toHaveBeenCalled();
      expect(mockCacheService.invalidateStockCache).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // START ORDER - VERIFY MP CONSUMPTION (FIFO LOTS)
  // ===========================================================================

  describe('startOrder - verify MP consumption via FIFO lots', () => {
    const orderPendingMultiMP = {
      id: 2,
      reference: 'OP-260202-002',
      status: 'PENDING',
      productPfId: 1,
      targetQuantity: 10,
      batchCount: 1,
      productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG', priceHt: 100000 },
      recipe: {
        id: 1,
        name: 'Recette Fromage',
        items: [
          {
            productMpId: 1,
            productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
            quantity: 100,
            affectsStock: true,
            isMandatory: true,
          },
          {
            productMpId: 2,
            productMp: { id: 2, code: 'MP-SEL', name: 'Sel', unit: 'KG' },
            quantity: 5,
            affectsStock: true,
            isMandatory: true,
          },
        ],
      },
      consumptions: [],
      lots: [],
      user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
    };

    it('devrait appeler consumeFIFO pour chaque MP de la recette', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderPendingMultiMP);

      // Preview for both MP
      mockLotConsumption.previewFIFO
        .mockResolvedValueOnce({ sufficient: true, availableStock: 200, consumptions: [{ lotId: 1, quantity: 100 }] })
        .mockResolvedValueOnce({ sufficient: true, availableStock: 20, consumptions: [{ lotId: 2, quantity: 5 }] });

      // Consume for both MP
      mockLotConsumption.consumeFIFO
        .mockResolvedValueOnce({
          consumptions: [{ lotId: 1, quantity: 100 }],
          lotsUsed: 1,
          totalConsumed: 100,
        })
        .mockResolvedValueOnce({
          consumptions: [{ lotId: 2, quantity: 5 }],
          lotsUsed: 1,
          totalConsumed: 5,
        });

      mockPrisma.lotMp.findMany.mockResolvedValue([
        { id: 1, unitCost: 300 },
        { id: 2, unitCost: 1000 },
      ]);
      mockPrisma.productionConsumption.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderPendingMultiMP,
        status: 'IN_PROGRESS',
        consumptions: [],
      });

      await service.start(2, 'user-1');

      // consumeFIFO should be called twice (once per MP)
      expect(mockLotConsumption.consumeFIFO).toHaveBeenCalledTimes(2);
      // First call: MP-LAIT (100 units)
      expect(mockLotConsumption.consumeFIFO).toHaveBeenCalledWith(
        1, // productMpId
        100, // requiredQty
        'PRODUCTION_OUT',
        'user-1',
        expect.objectContaining({
          referenceType: 'PRODUCTION',
          referenceId: 2,
        }),
      );
      // Second call: MP-SEL (5 units)
      expect(mockLotConsumption.consumeFIFO).toHaveBeenCalledWith(
        2, // productMpId
        5, // requiredQty
        'PRODUCTION_OUT',
        'user-1',
        expect.objectContaining({
          referenceType: 'PRODUCTION',
          referenceId: 2,
        }),
      );
    });

    it('devrait utiliser une idempotencyKey unique pour chaque MP', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderPendingMultiMP);

      mockLotConsumption.previewFIFO
        .mockResolvedValueOnce({ sufficient: true, availableStock: 200, consumptions: [{ lotId: 1, quantity: 100 }] })
        .mockResolvedValueOnce({ sufficient: true, availableStock: 20, consumptions: [{ lotId: 2, quantity: 5 }] });

      mockLotConsumption.consumeFIFO
        .mockResolvedValueOnce({ consumptions: [{ lotId: 1, quantity: 100 }], lotsUsed: 1, totalConsumed: 100 })
        .mockResolvedValueOnce({ consumptions: [{ lotId: 2, quantity: 5 }], lotsUsed: 1, totalConsumed: 5 });

      mockPrisma.lotMp.findMany.mockResolvedValue([
        { id: 1, unitCost: 300 },
        { id: 2, unitCost: 1000 },
      ]);
      mockPrisma.productionConsumption.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderPendingMultiMP,
        status: 'IN_PROGRESS',
        consumptions: [],
      });

      await service.start(2, 'user-1');

      // Verify idempotencyKeys are unique per MP
      const calls = mockLotConsumption.consumeFIFO.mock.calls;
      const key1 = calls[0][4].idempotencyKey; // PROD-2-1
      const key2 = calls[1][4].idempotencyKey; // PROD-2-2
      expect(key1).not.toBe(key2);
      expect(key1).toContain('PROD-2-1');
      expect(key2).toContain('PROD-2-2');
    });

    it('devrait creer des productionConsumption records pour chaque lot consomme', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...orderPendingMultiMP,
        recipe: {
          ...orderPendingMultiMP.recipe,
          items: [orderPendingMultiMP.recipe.items[0]], // Only one MP for simplicity
        },
      });

      mockLotConsumption.previewFIFO.mockResolvedValue({
        sufficient: true,
        availableStock: 200,
        consumptions: [{ lotId: 1, quantity: 60 }, { lotId: 2, quantity: 40 }],
      });
      mockLotConsumption.consumeFIFO.mockResolvedValue({
        consumptions: [{ lotId: 1, quantity: 60 }, { lotId: 2, quantity: 40 }],
        lotsUsed: 2,
        totalConsumed: 100,
      });
      mockPrisma.lotMp.findMany.mockResolvedValue([
        { id: 1, unitCost: 300 },
        { id: 2, unitCost: 350 },
      ]);
      mockPrisma.productionConsumption.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderPendingMultiMP,
        status: 'IN_PROGRESS',
        consumptions: [],
      });

      await service.start(2, 'user-1');

      // Two consumption records created (one per lot used)
      expect(mockPrisma.productionConsumption.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.productionConsumption.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productionOrderId: 2,
            productMpId: 1,
            lotMpId: 1,
            quantityPlanned: 60,
            quantityConsumed: 60,
          }),
        }),
      );
      expect(mockPrisma.productionConsumption.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productionOrderId: 2,
            productMpId: 1,
            lotMpId: 2,
            quantityPlanned: 40,
            quantityConsumed: 40,
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // PRODUCTION ORDER STATUS TRANSITIONS
  // ===========================================================================

  describe('Production order status transitions', () => {
    const baseOrder = {
      id: 1,
      reference: 'OP-260202-001',
      productPfId: 1,
      targetQuantity: 20,
      batchCount: 2,
      productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG', priceHt: 100000 },
      recipe: {
        id: 1,
        name: 'Recette',
        lossTolerance: 0.1,
        shelfLifeDays: 30,
        items: [
          {
            productMpId: 1,
            productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
            quantity: 100,
            affectsStock: true,
            isMandatory: true,
          },
        ],
      },
      consumptions: [],
      lots: [],
      user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
    };

    describe('Valid transitions', () => {
      it('PENDING -> IN_PROGRESS (via start)', async () => {
        mockPrisma.productionOrder.findUnique.mockResolvedValue({
          ...baseOrder,
          status: 'PENDING',
        });
        mockLotConsumption.previewFIFO.mockResolvedValue({
          sufficient: true,
          availableStock: 200,
          consumptions: [{ lotId: 1, quantity: 100 }],
        });
        mockLotConsumption.consumeFIFO.mockResolvedValue({
          consumptions: [{ lotId: 1, quantity: 100 }],
          lotsUsed: 1,
          totalConsumed: 100,
        });
        mockPrisma.lotMp.findMany.mockResolvedValue([{ id: 1, unitCost: 500 }]);
        mockPrisma.productionConsumption.create.mockResolvedValue({});
        mockPrisma.productionOrder.update.mockResolvedValue({
          ...baseOrder,
          status: 'IN_PROGRESS',
        });

        const result = await service.start(1, 'user-1');
        expect(result.status).toBe('IN_PROGRESS');
      });

      it('IN_PROGRESS -> COMPLETED (via complete)', async () => {
        mockPrisma.productionOrder.findUnique.mockResolvedValue({
          ...baseOrder,
          status: 'IN_PROGRESS',
          consumptions: [{
            productMpId: 1, quantityConsumed: 100, quantityPlanned: 100,
            unitCost: 500, productMp: { id: 1 }, lotMp: { id: 1 }, lotMpId: 1,
          }],
        });
        mockPrisma.lotPf.findFirst = jest.fn().mockResolvedValue(null);
        mockPrisma.lotPf.create.mockResolvedValue({
          id: 1, lotNumber: 'LOT', quantityInitial: 18,
          quantityRemaining: 18, unitCost: 0, isActive: true, status: 'AVAILABLE',
        });
        mockPrisma.stockMovement.create.mockResolvedValue({});
        mockPrisma.productionOrder.update.mockResolvedValue({
          ...baseOrder,
          status: 'COMPLETED',
          quantityProduced: 18,
          lots: [],
        });

        const result = await service.complete(1, { quantityProduced: 18, qualityStatus: 'PASSED' }, 'user-1');
        expect(result.status).toBe('COMPLETED');
      });

      it('PENDING -> CANCELLED (via cancel)', async () => {
        mockPrisma.productionOrder.findUnique.mockResolvedValue({
          ...baseOrder,
          status: 'PENDING',
        });
        mockPrisma.productionOrder.update.mockResolvedValue({
          ...baseOrder,
          status: 'CANCELLED',
        });

        const result = await service.cancel(1, 'user-1', 'Annulation');
        expect(result.status).toBe('CANCELLED');
      });

      it('IN_PROGRESS -> CANCELLED (via cancel with reversal)', async () => {
        mockPrisma.productionOrder.findUnique.mockResolvedValue({
          ...baseOrder,
          status: 'IN_PROGRESS',
          consumptions: [{
            productMpId: 1, quantityConsumed: 100, lotMpId: 10,
            productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
            lotMp: { id: 10, lotNumber: 'LOT-MP-001', expiryDate: null },
          }],
        });
        mockPrisma.lotMp.findUnique.mockResolvedValue({ quantityRemaining: 0, status: 'CONSUMED' });
        mockPrisma.lotMp.update.mockResolvedValue({});
        mockPrisma.stockMovement.create.mockResolvedValue({});
        mockPrisma.productionConsumption.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.productionOrder.update.mockResolvedValue({
          ...baseOrder,
          status: 'CANCELLED',
        });

        const result = await service.cancel(1, 'user-1', 'Defaut');
        expect(result.status).toBe('CANCELLED');
        expect(mockPrisma.stockMovement.create).toHaveBeenCalled();
      });
    });

    describe('Invalid transitions', () => {
      it('COMPLETED -> IN_PROGRESS (via start) should be rejected', async () => {
        mockPrisma.productionOrder.findUnique.mockResolvedValue({
          ...baseOrder,
          status: 'COMPLETED',
        });

        await expect(
          service.start(1, 'user-1'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.start(1, 'user-1'),
        ).rejects.toThrow(/statut actuel = COMPLETED/);
      });

      it('COMPLETED -> anything via cancel should be rejected', async () => {
        mockPrisma.productionOrder.findUnique.mockResolvedValue({
          ...baseOrder,
          status: 'COMPLETED',
        });

        await expect(
          service.cancel(1, 'user-1'),
        ).rejects.toThrow(BadRequestException);
      });

      it('CANCELLED -> IN_PROGRESS (via start) should be rejected', async () => {
        mockPrisma.productionOrder.findUnique.mockResolvedValue({
          ...baseOrder,
          status: 'CANCELLED',
        });

        await expect(
          service.start(1, 'user-1'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.start(1, 'user-1'),
        ).rejects.toThrow(/statut actuel = CANCELLED/);
      });

      it('CANCELLED -> COMPLETED (via complete) should be rejected', async () => {
        mockPrisma.productionOrder.findUnique.mockResolvedValue({
          ...baseOrder,
          status: 'CANCELLED',
        });

        await expect(
          service.complete(1, { quantityProduced: 10, qualityStatus: 'PASSED' }, 'user-1'),
        ).rejects.toThrow(BadRequestException);
      });

      it('CANCELLED -> CANCELLED (via cancel again) should be rejected', async () => {
        mockPrisma.productionOrder.findUnique.mockResolvedValue({
          ...baseOrder,
          status: 'CANCELLED',
        });

        await expect(
          service.cancel(1, 'user-1'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.cancel(1, 'user-1'),
        ).rejects.toThrow(/déjà annulé/);
      });

      it('IN_PROGRESS -> IN_PROGRESS (via start again) should be rejected', async () => {
        mockPrisma.productionOrder.findUnique.mockResolvedValue({
          ...baseOrder,
          status: 'IN_PROGRESS',
        });

        await expect(
          service.start(1, 'user-1'),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ===========================================================================
  // PRODUCTION CONSUMPTION CREATES CORRECT STOCKMOVEMENT RECORDS
  // ===========================================================================

  describe('Production consumption creates correct StockMovement records', () => {
    it('devrait creer un mouvement IN PF lors de la completion avec les bons champs', async () => {
      const orderInProgress = {
        id: 1,
        reference: 'OP-260202-001',
        status: 'IN_PROGRESS',
        productPfId: 3,
        targetQuantity: 20,
        batchCount: 2,
        productPf: { id: 3, code: 'PF-003', name: 'Beurre', unit: 'KG', priceHt: 80000 },
        recipe: { id: 1, name: 'Recette Beurre', lossTolerance: 0.1, shelfLifeDays: 60, items: [] },
        consumptions: [
          {
            productMpId: 1,
            quantityConsumed: 200,
            quantityPlanned: 200,
            unitCost: 300,
            productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
            lotMp: { id: 1, lotNumber: 'LOT-001', expiryDate: null },
            lotMpId: 1,
          },
        ],
        lots: [],
        user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderInProgress);
      mockPrisma.lotPf.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.lotPf.create.mockResolvedValue({
        id: 1, lotNumber: 'PF-003-260202-001', quantityInitial: 18,
        quantityRemaining: 18, unitCost: 3333, isActive: true, status: 'AVAILABLE',
      });
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderInProgress, status: 'COMPLETED', lots: [],
      });

      await service.complete(1, { quantityProduced: 18, qualityStatus: 'PASSED' }, 'user-1');

      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'IN',
            productType: 'PF',
            origin: 'PRODUCTION_IN',
            productPfId: 3,
            quantity: 18,
            referenceType: 'PRODUCTION',
            referenceId: 1,
            reference: 'OP-260202-001',
            userId: 'user-1',
          }),
        }),
      );
    });

    it('devrait creer des mouvements de retour PRODUCTION_CANCEL lors de l\'annulation', async () => {
      const order = {
        id: 5,
        reference: 'OP-260202-005',
        status: 'IN_PROGRESS',
        productPfId: 1,
        targetQuantity: 10,
        batchCount: 1,
        productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG', priceHt: 100000 },
        recipe: { id: 1, name: 'Recette', items: [] },
        consumptions: [
          {
            productMpId: 1,
            quantityConsumed: 100,
            lotMpId: 10,
            productMp: { id: 1, code: 'MP-LAIT', name: 'Lait', unit: 'L' },
            lotMp: { id: 10, lotNumber: 'LOT-001', expiryDate: null },
          },
        ],
        lots: [],
        user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(order);
      mockPrisma.lotMp.findUnique.mockResolvedValue({ quantityRemaining: 0, status: 'CONSUMED' });
      mockPrisma.lotMp.update.mockResolvedValue({});
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionConsumption.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.productionOrder.update.mockResolvedValue({ status: 'CANCELLED' });

      await service.cancel(5, 'user-1', 'Test');

      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'IN',
            productType: 'MP',
            origin: 'PRODUCTION_CANCEL',
            productMpId: 1,
            lotMpId: 10,
            quantity: 100,
            referenceType: 'PRODUCTION',
            referenceId: 5,
            reference: expect.stringContaining('ANNUL-OP-260202-005'),
          }),
        }),
      );
    });

    it('devrait calculer le unitCost PF a partir des consommations MP', async () => {
      const orderInProgress = {
        id: 1,
        reference: 'OP-260202-001',
        status: 'IN_PROGRESS',
        productPfId: 1,
        targetQuantity: 20,
        batchCount: 2,
        productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG', priceHt: 100000 },
        recipe: { id: 1, name: 'Recette', lossTolerance: 0.1, shelfLifeDays: 30, items: [] },
        consumptions: [
          { productMpId: 1, quantityConsumed: 100, quantityPlanned: 100, unitCost: 500, productMp: { id: 1 }, lotMp: { id: 1 }, lotMpId: 1 },
          { productMpId: 2, quantityConsumed: 10, quantityPlanned: 10, unitCost: 2000, productMp: { id: 2 }, lotMp: { id: 2 }, lotMpId: 2 },
        ],
        lots: [],
        user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
      };

      mockPrisma.productionOrder.findUnique.mockResolvedValue(orderInProgress);
      mockPrisma.lotPf.findFirst = jest.fn().mockResolvedValue(null);
      mockPrisma.lotPf.create.mockResolvedValue({
        id: 1, lotNumber: 'LOT', quantityInitial: 20,
        quantityRemaining: 20, unitCost: 0, isActive: true, status: 'AVAILABLE',
      });
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.productionOrder.update.mockResolvedValue({
        ...orderInProgress, status: 'COMPLETED', lots: [],
      });

      await service.complete(1, { quantityProduced: 20, qualityStatus: 'PASSED' }, 'user-1');

      // totalCost = (100 * 500) + (10 * 2000) = 50000 + 20000 = 70000
      // unitCost = Math.round(70000 / 20) = 3500
      expect(mockPrisma.lotPf.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitCost: 3500,
          }),
        }),
      );
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitCost: 3500,
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // RECHERCHE PAR ID
  // ===========================================================================

  describe('Recherche par ID', () => {
    it('devrait rejeter quand l\'ordre n\'existe pas', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(null);

      await expect(service.findById(99999)).rejects.toThrow(NotFoundException);
      await expect(service.findById(99999)).rejects.toThrow(/introuvable/);
    });
  });

  // ===========================================================================
  // INVALIDATION CACHE
  // ===========================================================================

  describe('Invalidation du cache', () => {
    it('devrait invalider le cache stock et production apres annulation', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        id: 1,
        reference: 'OP-001',
        status: 'PENDING',
        productPfId: 1,
        targetQuantity: 10,
        batchCount: 1,
        productPf: { id: 1, code: 'PF-001', name: 'Fromage', unit: 'KG', priceHt: 100 },
        recipe: { id: 1, name: 'Recette', items: [] },
        consumptions: [],
        lots: [],
        user: { id: 'user-1', firstName: 'T', lastName: 'U' },
      });
      mockPrisma.productionOrder.update.mockResolvedValue({ status: 'CANCELLED' });

      await service.cancel(1, 'user-1');

      expect(mockCacheService.invalidateStockCache).toHaveBeenCalled();
      expect(mockCacheService.invalidateProductionCache).toHaveBeenCalled();
    });
  });
});
