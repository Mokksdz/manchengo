/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRODUCTION SERVICE TESTS - Workflow de production
 * ═══════════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATION ORDRE DE PRODUCTION
  // ═══════════════════════════════════════════════════════════════════════════

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
        recipe: { id: 1, outputQuantity: 10, batchWeight: 5 },
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
      const recipe = { id: 1, outputQuantity: 10, batchWeight: 5, name: 'Recette fromage' };
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

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLETION PRODUCTION
  // ═══════════════════════════════════════════════════════════════════════════

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
        service.complete(1, { quantityProduced: 10 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.complete(1, { quantityProduced: 10 }, 'user-1'),
      ).rejects.toThrow(/statut actuel = PENDING/);
    });

    it('devrait rejeter la completion d\'un ordre deja COMPLETED', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...orderInProgress,
        status: 'COMPLETED',
      });

      await expect(
        service.complete(1, { quantityProduced: 10 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.complete(1, { quantityProduced: 10 }, 'user-1'),
      ).rejects.toThrow(/statut actuel = COMPLETED/);
    });

    it('devrait rejeter la completion d\'un ordre CANCELLED', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue({
        ...orderInProgress,
        status: 'CANCELLED',
      });

      await expect(
        service.complete(1, { quantityProduced: 10 }, 'user-1'),
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

      const result = await service.complete(1, { quantityProduced: 18 }, 'user-1');

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

      await service.complete(1, { quantityProduced: 15 }, 'user-1');

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
      await service.complete(1, { quantityProduced: 10 }, 'user-1');

      expect(mockLogger.businessWarn).toHaveBeenCalledWith(
        'PRODUCTION_LOW_YIELD',
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ANNULATION PRODUCTION
  // ═══════════════════════════════════════════════════════════════════════════

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
      mockPrisma.productionConsumption.deleteMany.mockResolvedValue({});
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
      // Verifie que les consommations sont supprimees
      expect(mockPrisma.productionConsumption.deleteMany).toHaveBeenCalledWith({
        where: { productionOrderId: 1 },
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

  // ═══════════════════════════════════════════════════════════════════════════
  // DEMARRAGE PRODUCTION
  // ═══════════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════
  // RECHERCHE PAR ID
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Recherche par ID', () => {
    it('devrait rejeter quand l\'ordre n\'existe pas', async () => {
      mockPrisma.productionOrder.findUnique.mockResolvedValue(null);

      await expect(service.findById(99999)).rejects.toThrow(NotFoundException);
      await expect(service.findById(99999)).rejects.toThrow(/introuvable/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INVALIDATION CACHE
  // ═══════════════════════════════════════════════════════════════════════════

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
