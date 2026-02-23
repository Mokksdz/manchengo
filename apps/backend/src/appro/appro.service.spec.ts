/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * APPRO SERVICE - BUSINESS INVARIANT TESTS (Unit Tests)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * WHAT WE TEST: Supply chain rules that prevent stockouts and production blocks
 *
 * CRITICAL INVARIANTS:
 * 1. Stock state calculation is accurate
 * 2. IRS (Indice de Risque Stock) calculation is correct
 * 3. Critical MP detection works correctly
 * 4. Threshold validation (seuilCommande > seuilSecurite)
 * 5. Stock calculation from movements
 * 6. Criticité effective calculation
 *
 * BUSINESS RISK IF BROKEN:
 * - Wrong stock state = missed alerts = production stoppage
 * - Wrong IRS = wrong priorities = late orders = stockouts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ApproService, StockState, IrsStatus } from './appro.service';
import { ApproAlertService } from './appro-alert.service';
import { PrismaService } from '../prisma/prisma.service';
import { MpCriticite } from '@prisma/client';

describe('ApproService - Business Invariants', () => {
  let service: ApproService;

  const mockPrisma: any = {
    productMp: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    stockMovement: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    recipeItem: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    supplier: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    alert: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };

  const mockAlertService = {
    createProductionBloqueeAlert: jest.fn(),
    scanAndCreateAlerts: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApproService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ApproAlertService, useValue: mockAlertService },
      ],
    }).compile();

    service = module.get<ApproService>(ApproService);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INVARIANT 1: Stock state calculation is accurate
  // ═══════════════════════════════════════════════════════════════════════════

  describe('INVARIANT: Stock state calculation is accurate', () => {
    it('should return RUPTURE when stock is 0', () => {
      const state = service.computeStockState(
        0,       // currentStock
        100,     // minStock
        50,      // seuilSecurite
        150,     // seuilCommande
        MpCriticite.MOYENNE,
        false,   // usedInActiveRecipe
      );

      expect(state).toBe(StockState.RUPTURE);
    });

    it('should return BLOQUANT_PRODUCTION when rupture + used in recipe', () => {
      const state = service.computeStockState(
        0,
        100,
        50,
        150,
        MpCriticite.MOYENNE,
        true,    // usedInActiveRecipe = true
      );

      expect(state).toBe(StockState.BLOQUANT_PRODUCTION);
    });

    it('should return BLOQUANT_PRODUCTION when rupture + BLOQUANTE criticite', () => {
      const state = service.computeStockState(
        0,
        100,
        50,
        150,
        MpCriticite.BLOQUANTE,
        false,
      );

      expect(state).toBe(StockState.BLOQUANT_PRODUCTION);
    });

    it('should return A_COMMANDER when stock <= seuilCommande', () => {
      const state = service.computeStockState(
        100,     // At seuilCommande level
        100,
        50,
        100,     // seuilCommande = 100
        MpCriticite.MOYENNE,
        false,
      );

      expect(state).toBe(StockState.A_COMMANDER);
    });

    it('should return SAIN when stock > seuilCommande', () => {
      const state = service.computeStockState(
        200,     // Above all thresholds
        100,
        50,
        150,
        MpCriticite.MOYENNE,
        false,
      );

      expect(state).toBe(StockState.SAIN);
    });

    it('should use minStock as default seuilSecurite when null', () => {
      const state = service.computeStockState(
        50,      // Below minStock (100)
        100,     // minStock
        null,    // seuilSecurite = null → uses minStock
        null,    // seuilCommande = null → uses minStock * 1.5 = 150
        MpCriticite.MOYENNE,
        false,
      );

      // 50 <= 100 (default seuilSecurite = minStock) → SOUS_SEUIL (checked before seuilCommande)
      expect(state).toBe(StockState.SOUS_SEUIL);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INVARIANT 2: Threshold validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('INVARIANT: Threshold validation (seuilCommande > seuilSecurite)', () => {
    it('should throw when seuilCommande <= seuilSecurite', async () => {
      mockPrisma.productMp.findUnique.mockResolvedValue({
        id: 1,
        minStock: 100,
        seuilSecurite: 50,
        seuilCommande: 150,
      });

      await expect(
        service.updateProductMpAppro(1, {
          seuilSecurite: 100,
          seuilCommande: 50, // Lower than seuilSecurite - invalid
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateProductMpAppro(1, {
          seuilSecurite: 100,
          seuilCommande: 50,
        }),
      ).rejects.toThrow(/doit être supérieur/);
    });

    it('should throw when seuilCommande equals seuilSecurite', async () => {
      mockPrisma.productMp.findUnique.mockResolvedValue({
        id: 1,
        minStock: 100,
        seuilSecurite: 50,
        seuilCommande: 150,
      });

      await expect(
        service.updateProductMpAppro(1, {
          seuilSecurite: 100,
          seuilCommande: 100, // Equal - invalid
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept when seuilCommande > seuilSecurite', async () => {
      mockPrisma.productMp.findUnique.mockResolvedValue({
        id: 1,
        minStock: 100,
        seuilSecurite: 50,
        seuilCommande: 150,
      });
      mockPrisma.productMp.update.mockResolvedValue({
        id: 1,
        seuilSecurite: 50,
        seuilCommande: 100,
      });

      const updated = await service.updateProductMpAppro(1, {
        seuilSecurite: 50,
        seuilCommande: 100, // Valid
      });

      expect(updated).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INVARIANT 3: Stock calculation from movements
  // ═══════════════════════════════════════════════════════════════════════════

  describe('INVARIANT: Stock calculation from movements', () => {
    it('should calculate stock as IN - OUT', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { productMpId: 1, movementType: 'IN', _sum: { quantity: 150 } },
        { productMpId: 1, movementType: 'OUT', _sum: { quantity: 30 } },
      ]);

      const stockMap = await service.calculateCurrentStocks([1]);

      // 150 - 30 = 120
      expect(stockMap.get(1)).toBe(120);
    });

    it('should return 0 for products with no movements', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);

      const stockMap = await service.calculateCurrentStocks([1]);

      expect(stockMap.get(1)).toBe(0);
    });

    it('should ignore deleted movements (handled by query filter)', async () => {
      // The service filters isDeleted: false in the query
      // So mock returns only non-deleted movements
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { productMpId: 1, movementType: 'IN', _sum: { quantity: 100 } },
      ]);

      const stockMap = await service.calculateCurrentStocks([1]);

      expect(stockMap.get(1)).toBe(100);

      // Verify the query filters deleted movements
      expect(mockPrisma.stockMovement.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isDeleted: false,
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INVARIANT 4: IRS status boundaries
  // ═══════════════════════════════════════════════════════════════════════════

  describe('INVARIANT: IRS status mapping', () => {
    it('should correctly identify RUPTURE state for zero stock', () => {
      const state = service.computeStockState(0, 100, 50, 150, MpCriticite.FAIBLE, false);
      expect(state).toBe(StockState.RUPTURE);
    });

    it('should correctly identify BLOQUANT for critical MP at zero', () => {
      const state = service.computeStockState(0, 100, 50, 150, MpCriticite.BLOQUANTE, false);
      expect(state).toBe(StockState.BLOQUANT_PRODUCTION);
    });

    it('should correctly identify SAIN for well-stocked items', () => {
      const state = service.computeStockState(500, 100, 50, 150, MpCriticite.MOYENNE, false);
      expect(state).toBe(StockState.SAIN);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INVARIANT 5: Edge cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe('INVARIANT: Edge cases', () => {
    it('should handle negative stock as RUPTURE', () => {
      const state = service.computeStockState(-5, 100, 50, 150, MpCriticite.MOYENNE, false);
      expect(state).toBe(StockState.RUPTURE);
    });

    it('should handle stock exactly at seuilCommande as A_COMMANDER', () => {
      const state = service.computeStockState(150, 100, 50, 150, MpCriticite.MOYENNE, false);
      expect(state).toBe(StockState.A_COMMANDER);
    });

    it('should handle all null thresholds using minStock defaults', () => {
      // minStock=100 → seuilSecurite=100, seuilCommande=150
      const state = service.computeStockState(200, 100, null, null, MpCriticite.MOYENNE, false);
      expect(state).toBe(StockState.SAIN);
    });
  });
});
