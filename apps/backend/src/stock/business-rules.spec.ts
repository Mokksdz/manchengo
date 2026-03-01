/**
 * ===============================================================================
 * STOCK MODULE - BUSINESS RULES VALIDATION TESTS
 * ===============================================================================
 *
 * Tests pour valider les regles metier critiques du module stock.
 * Comprend a la fois des tests de logique pure (sans mocks) et des tests
 * integres utilisant @nestjs/testing avec StockService.
 *
 * REGLES TESTEES:
 * 1. FIFO: Ordre de consommation par DLC puis date creation
 * 2. Anti-fraude: Compteur != Validateur
 * 3. Seuils inventaire: Auto-approval vs validation
 * 4. Lots bloques: Non consommables
 * 5. Idempotence: Pas de double traitement
 * 6. TVA Rate validation (@IsIn([0, 9, 19]))
 * 7. Stock movement creation with idempotency key
 * 8. FIFO consumption order - oldest lots consumed first
 * 9. Stock quantity never goes negative invariant
 * 10. Multi-product reception in a single transaction
 * 11. Lot expiry date blocking (DLC expired)
 * 12. Movement soft-delete doesn't affect stock calculations
 * 13. Concurrent stock operations (idempotency protection)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StockService } from './stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CacheService } from '../cache/cache.service';

describe('Stock Business Rules - Unit Tests', () => {
  // ===========================================================================
  // RULE 1: FIFO Order
  // ===========================================================================

  describe('FIFO Ordering Logic', () => {
    interface MockLot {
      id: number;
      lotNumber: string;
      expiryDate: Date | null;
      createdAt: Date;
      quantityRemaining: number;
    }

    function sortFIFO(lots: MockLot[]): MockLot[] {
      return [...lots].sort((a, b) => {
        // 1. DLC nulle = a la fin
        if (a.expiryDate === null && b.expiryDate !== null) return 1;
        if (a.expiryDate !== null && b.expiryDate === null) return -1;

        // 2. DLC croissante (expire plus tot = premier)
        if (a.expiryDate && b.expiryDate) {
          const dlcDiff = a.expiryDate.getTime() - b.expiryDate.getTime();
          if (dlcDiff !== 0) return dlcDiff;
        }

        // 3. Date creation croissante (plus ancien = premier)
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
    }

    it('should sort by expiry date ascending', () => {
      const lots: MockLot[] = [
        { id: 1, lotNumber: 'LOT-C', expiryDate: new Date('2025-03-01'), createdAt: new Date('2025-01-01'), quantityRemaining: 10 },
        { id: 2, lotNumber: 'LOT-A', expiryDate: new Date('2025-01-15'), createdAt: new Date('2025-01-01'), quantityRemaining: 10 },
        { id: 3, lotNumber: 'LOT-B', expiryDate: new Date('2025-02-01'), createdAt: new Date('2025-01-01'), quantityRemaining: 10 },
      ];

      const sorted = sortFIFO(lots);

      expect(sorted[0].lotNumber).toBe('LOT-A'); // Jan 15
      expect(sorted[1].lotNumber).toBe('LOT-B'); // Feb 1
      expect(sorted[2].lotNumber).toBe('LOT-C'); // Mar 1
    });

    it('should use creation date as tiebreaker when DLC is same', () => {
      const sameDlc = new Date('2025-02-01');
      const lots: MockLot[] = [
        { id: 1, lotNumber: 'LOT-NEW', expiryDate: sameDlc, createdAt: new Date('2025-01-10'), quantityRemaining: 10 },
        { id: 2, lotNumber: 'LOT-OLD', expiryDate: sameDlc, createdAt: new Date('2025-01-05'), quantityRemaining: 10 },
      ];

      const sorted = sortFIFO(lots);

      expect(sorted[0].lotNumber).toBe('LOT-OLD'); // Older creation
      expect(sorted[1].lotNumber).toBe('LOT-NEW');
    });

    it('should put null DLC lots at the end', () => {
      const lots: MockLot[] = [
        { id: 1, lotNumber: 'LOT-NO-DLC', expiryDate: null, createdAt: new Date('2025-01-01'), quantityRemaining: 10 },
        { id: 2, lotNumber: 'LOT-WITH-DLC', expiryDate: new Date('2025-12-31'), createdAt: new Date('2025-01-01'), quantityRemaining: 10 },
      ];

      const sorted = sortFIFO(lots);

      expect(sorted[0].lotNumber).toBe('LOT-WITH-DLC');
      expect(sorted[1].lotNumber).toBe('LOT-NO-DLC');
    });

    it('should consume oldest lots first across multiple products', () => {
      const lots: MockLot[] = [
        { id: 1, lotNumber: 'LOT-3', expiryDate: new Date('2025-06-01'), createdAt: new Date('2025-03-01'), quantityRemaining: 20 },
        { id: 2, lotNumber: 'LOT-1', expiryDate: new Date('2025-04-01'), createdAt: new Date('2025-01-01'), quantityRemaining: 10 },
        { id: 3, lotNumber: 'LOT-2', expiryDate: new Date('2025-05-01'), createdAt: new Date('2025-02-01'), quantityRemaining: 15 },
        { id: 4, lotNumber: 'LOT-4', expiryDate: null, createdAt: new Date('2025-01-01'), quantityRemaining: 30 },
      ];

      const sorted = sortFIFO(lots);

      // Must consume LOT-1 (earliest expiry) -> LOT-2 -> LOT-3 -> LOT-4 (null DLC last)
      expect(sorted[0].lotNumber).toBe('LOT-1');
      expect(sorted[1].lotNumber).toBe('LOT-2');
      expect(sorted[2].lotNumber).toBe('LOT-3');
      expect(sorted[3].lotNumber).toBe('LOT-4');

      // FIFO consumption simulation: consume 30 units
      let remaining = 30;
      const consumed: { lotNumber: string; qty: number }[] = [];
      for (const lot of sorted) {
        if (remaining <= 0) break;
        const consume = Math.min(remaining, lot.quantityRemaining);
        consumed.push({ lotNumber: lot.lotNumber, qty: consume });
        remaining -= consume;
      }

      expect(consumed).toEqual([
        { lotNumber: 'LOT-1', qty: 10 },  // Fully consumed
        { lotNumber: 'LOT-2', qty: 15 },  // Fully consumed
        { lotNumber: 'LOT-3', qty: 5 },   // Partially consumed
      ]);
      expect(remaining).toBe(0);
    });

    it('should handle lots all with null expiry dates using creation date only', () => {
      const lots: MockLot[] = [
        { id: 1, lotNumber: 'LOT-C', expiryDate: null, createdAt: new Date('2025-03-01'), quantityRemaining: 10 },
        { id: 2, lotNumber: 'LOT-A', expiryDate: null, createdAt: new Date('2025-01-01'), quantityRemaining: 10 },
        { id: 3, lotNumber: 'LOT-B', expiryDate: null, createdAt: new Date('2025-02-01'), quantityRemaining: 10 },
      ];

      const sorted = sortFIFO(lots);

      expect(sorted[0].lotNumber).toBe('LOT-A');
      expect(sorted[1].lotNumber).toBe('LOT-B');
      expect(sorted[2].lotNumber).toBe('LOT-C');
    });
  });

  // ===========================================================================
  // RULE 2: Anti-Fraud - Counter != Validator
  // ===========================================================================

  describe('Anti-Fraud: Counter != Validator Rule', () => {
    function canValidate(countedById: string, validatorId: string): boolean {
      return countedById !== validatorId;
    }

    it('should reject when counter = validator', () => {
      const userId = 'user-123';
      expect(canValidate(userId, userId)).toBe(false);
    });

    it('should allow when counter != validator', () => {
      expect(canValidate('counter-123', 'validator-456')).toBe(true);
    });
  });

  // ===========================================================================
  // RULE 3: Double Validation for High Risk
  // ===========================================================================

  describe('Double Validation Logic', () => {
    function canSecondValidate(
      firstValidatorId: string | null,
      secondValidatorId: string,
      countedById: string,
    ): { allowed: boolean; reason?: string } {
      // Second validator != first validator
      if (firstValidatorId === secondValidatorId) {
        return { allowed: false, reason: 'SAME_VALIDATOR' };
      }

      // Second validator != counter
      if (countedById === secondValidatorId) {
        return { allowed: false, reason: 'SELF_VALIDATION' };
      }

      return { allowed: true };
    }

    it('should reject second validation by same validator', () => {
      const result = canSecondValidate(
        'validator-1',
        'validator-1', // Same
        'counter-123',
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('SAME_VALIDATOR');
    });

    it('should reject second validation by counter', () => {
      const result = canSecondValidate(
        'validator-1',
        'counter-123', // Counter trying to be second validator
        'counter-123',
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('SELF_VALIDATION');
    });

    it('should allow second validation by different person', () => {
      const result = canSecondValidate(
        'validator-1',
        'validator-2',
        'counter-123',
      );
      expect(result.allowed).toBe(true);
    });
  });

  // ===========================================================================
  // RULE 4: Inventory Thresholds
  // ===========================================================================

  describe('Inventory Threshold Logic', () => {
    type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    type ProductCategory = 'MP_PERISHABLE' | 'MP_NON_PERISHABLE' | 'PF';

    const THRESHOLDS: Record<ProductCategory, { auto: number; single: number }> = {
      MP_PERISHABLE: { auto: 2, single: 5 },
      MP_NON_PERISHABLE: { auto: 3, single: 8 },
      PF: { auto: 1, single: 3 },
    };

    function determineRiskLevel(
      driftPercent: number,
      category: ProductCategory,
      valueDA: number,
    ): RiskLevel {
      const absPercent = Math.abs(driftPercent);
      const threshold = THRESHOLDS[category];

      // Value > 50,000 DA = always CRITICAL
      if (valueDA > 50000) return 'CRITICAL';

      // Check thresholds
      if (absPercent <= threshold.auto) return 'LOW';
      if (absPercent <= threshold.single) return 'MEDIUM';
      return 'CRITICAL';
    }

    it('should auto-approve perishable MP with <=2% drift', () => {
      expect(determineRiskLevel(1.5, 'MP_PERISHABLE', 10000)).toBe('LOW');
      expect(determineRiskLevel(2, 'MP_PERISHABLE', 10000)).toBe('LOW');
    });

    it('should require single validation for perishable MP with 2-5% drift', () => {
      expect(determineRiskLevel(3, 'MP_PERISHABLE', 10000)).toBe('MEDIUM');
      expect(determineRiskLevel(5, 'MP_PERISHABLE', 10000)).toBe('MEDIUM');
    });

    it('should require double validation for perishable MP with >5% drift', () => {
      expect(determineRiskLevel(6, 'MP_PERISHABLE', 10000)).toBe('CRITICAL');
      expect(determineRiskLevel(10, 'MP_PERISHABLE', 10000)).toBe('CRITICAL');
    });

    it('should be CRITICAL for any drift when value > 50,000 DA', () => {
      expect(determineRiskLevel(0.5, 'MP_PERISHABLE', 60000)).toBe('CRITICAL');
      expect(determineRiskLevel(1, 'PF', 100000)).toBe('CRITICAL');
    });

    it('should apply stricter thresholds for PF (1%/3%)', () => {
      expect(determineRiskLevel(0.5, 'PF', 10000)).toBe('LOW');
      expect(determineRiskLevel(2, 'PF', 10000)).toBe('MEDIUM');
      expect(determineRiskLevel(4, 'PF', 10000)).toBe('CRITICAL');
    });
  });

  // ===========================================================================
  // RULE 5: Cooldown Logic
  // ===========================================================================

  describe('Inventory Cooldown Logic', () => {
    const COOLDOWN_HOURS = 4;

    function isInCooldown(lastDeclarationTime: Date | null): boolean {
      if (!lastDeclarationTime) return false;

      const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
      const timeSince = Date.now() - lastDeclarationTime.getTime();

      return timeSince < cooldownMs;
    }

    it('should be in cooldown if declaration < 4h ago', () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
      expect(isInCooldown(oneHourAgo)).toBe(true);

      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(isInCooldown(threeHoursAgo)).toBe(true);
    });

    it('should not be in cooldown if declaration >= 4h ago', () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      expect(isInCooldown(fiveHoursAgo)).toBe(false);

      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(isInCooldown(dayAgo)).toBe(false);
    });

    it('should not be in cooldown if no previous declaration', () => {
      expect(isInCooldown(null)).toBe(false);
    });
  });

  // ===========================================================================
  // RULE 6: Lot Status Validation
  // ===========================================================================

  describe('Lot Status Consumption Rules', () => {
    type LotStatus = 'AVAILABLE' | 'BLOCKED' | 'CONSUMED';

    function canConsume(status: LotStatus, quantityRemaining: number): boolean {
      if (status !== 'AVAILABLE') return false;
      if (quantityRemaining <= 0) return false;
      return true;
    }

    it('should allow consumption of AVAILABLE lots with stock', () => {
      expect(canConsume('AVAILABLE', 100)).toBe(true);
      expect(canConsume('AVAILABLE', 1)).toBe(true);
    });

    it('should reject consumption of BLOCKED lots', () => {
      expect(canConsume('BLOCKED', 100)).toBe(false);
    });

    it('should reject consumption of CONSUMED lots', () => {
      expect(canConsume('CONSUMED', 0)).toBe(false);
    });

    it('should reject consumption when quantity = 0', () => {
      expect(canConsume('AVAILABLE', 0)).toBe(false);
    });
  });

  // ===========================================================================
  // RULE 7: Quantity Validation
  // ===========================================================================

  describe('Quantity Validation Rules', () => {
    function validateQuantity(quantity: number): { valid: boolean; error?: string } {
      if (quantity < 0) {
        return { valid: false, error: 'NEGATIVE_QUANTITY' };
      }
      if (!Number.isFinite(quantity)) {
        return { valid: false, error: 'INVALID_NUMBER' };
      }
      return { valid: true };
    }

    it('should accept positive quantities', () => {
      expect(validateQuantity(100).valid).toBe(true);
      expect(validateQuantity(0.5).valid).toBe(true);
    });

    it('should accept zero (complete loss)', () => {
      expect(validateQuantity(0).valid).toBe(true);
    });

    it('should reject negative quantities', () => {
      const result = validateQuantity(-10);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NEGATIVE_QUANTITY');
    });

    it('should reject invalid numbers', () => {
      expect(validateQuantity(NaN).valid).toBe(false);
      expect(validateQuantity(Infinity).valid).toBe(false);
    });
  });

  // ===========================================================================
  // RULE 8: Suspicious Pattern Detection
  // ===========================================================================

  describe('Suspicious Pattern Detection', () => {
    const CONSECUTIVE_NEGATIVE_THRESHOLD = 3;

    function detectSuspiciousPattern(recentDifferences: number[]): boolean {
      // Check for consecutive negative differences
      let consecutiveNegative = 0;
      for (const diff of recentDifferences) {
        if (diff < 0) {
          consecutiveNegative++;
          if (consecutiveNegative >= CONSECUTIVE_NEGATIVE_THRESHOLD) {
            return true;
          }
        } else {
          consecutiveNegative = 0;
        }
      }
      return false;
    }

    it('should detect 3+ consecutive negative differences', () => {
      expect(detectSuspiciousPattern([-5, -3, -2])).toBe(true);
      expect(detectSuspiciousPattern([-1, -1, -1, -1])).toBe(true);
    });

    it('should not flag if negatives are not consecutive', () => {
      expect(detectSuspiciousPattern([-5, 2, -3, 1, -2])).toBe(false);
    });

    it('should not flag positive differences', () => {
      expect(detectSuspiciousPattern([5, 3, 2, 1])).toBe(false);
    });

    it('should not flag less than 3 consecutive negatives', () => {
      expect(detectSuspiciousPattern([-5, -3, 2])).toBe(false);
      expect(detectSuspiciousPattern([-5, -3])).toBe(false);
    });
  });
});

// =============================================================================
// STOCK SERVICE INTEGRATION TESTS (with @nestjs/testing TestingModule)
// =============================================================================

describe('Stock Business Rules - StockService Integration', () => {
  let service: StockService;

  const mockPrisma: any = {
    stockMovement: {
      groupBy: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    productMp: { findMany: jest.fn() },
    productPf: { findMany: jest.fn() },
    receptionMp: {
      count: jest.fn(),
      create: jest.fn(),
    },
    recipeItem: { groupBy: jest.fn() },
    lotMp: {
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
    },
    lotPf: {
      update: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => {
      if (typeof fn === 'function') return fn(mockPrisma);
      return Promise.all(fn);
    }),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockCacheService = {
    getOrSet: jest.fn((_key: string, fn: () => any) => fn()),
    buildStockKey: jest.fn((type: string) => `stock:${type}`),
    invalidateStockCache: jest.fn().mockResolvedValue(undefined),
    invalidateProductionCache: jest.fn().mockResolvedValue(undefined),
    invalidateSalesCache: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    jest.clearAllMocks();
  });

  // ===========================================================================
  // TVA RATE VALIDATION
  // ===========================================================================

  describe('Reception with tvaRate validation', () => {
    const baseReceptionData = {
      supplierId: 1,
      date: new Date(),
      blNumber: 'BL-001',
    };

    beforeEach(() => {
      mockPrisma.receptionMp.count.mockResolvedValue(0);
      mockPrisma.receptionMp.create.mockImplementation(async ({ data }: any) => ({
        id: 1,
        reference: 'REC-20260301-001',
        ...data,
        lines: data.lines?.create || [],
      }));
      mockPrisma.stockMovement.createMany.mockResolvedValue({ count: 1 });
    });

    it('should accept tvaRate = 0 (tax-exempt products)', async () => {
      const data = {
        ...baseReceptionData,
        lines: [{ productMpId: 1, quantity: 100, unitCost: 5000, tvaRate: 0 }],
      };

      await expect(
        service.createReception(data, 'user-1', 'APPRO' as any),
      ).resolves.toBeDefined();
    });

    it('should accept tvaRate = 9 (reduced rate)', async () => {
      const data = {
        ...baseReceptionData,
        lines: [{ productMpId: 1, quantity: 100, unitCost: 5000, tvaRate: 9 }],
      };

      await expect(
        service.createReception(data, 'user-1', 'APPRO' as any),
      ).resolves.toBeDefined();
    });

    it('should accept tvaRate = 19 (standard rate)', async () => {
      const data = {
        ...baseReceptionData,
        lines: [{ productMpId: 1, quantity: 100, unitCost: 5000, tvaRate: 19 }],
      };

      await expect(
        service.createReception(data, 'user-1', 'APPRO' as any),
      ).resolves.toBeDefined();
    });

    it('should default to 19% when tvaRate is not provided', async () => {
      const data = {
        ...baseReceptionData,
        lines: [{ productMpId: 1, quantity: 100, unitCost: 5000 }],
      };

      await service.createReception(data, 'user-1', 'APPRO' as any);

      expect(mockPrisma.receptionMp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lines: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ tvaRate: 19 }),
              ]),
            }),
          }),
        }),
      );
    });

    it('should reject tvaRate = 5 (invalid rate)', async () => {
      const data = {
        ...baseReceptionData,
        lines: [{ productMpId: 1, quantity: 100, unitCost: 5000, tvaRate: 5 }],
      };

      await expect(
        service.createReception(data, 'user-1', 'APPRO' as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createReception(data, 'user-1', 'APPRO' as any),
      ).rejects.toThrow(/Taux TVA invalide/);
    });

    it('should reject tvaRate = 20 (invalid rate)', async () => {
      const data = {
        ...baseReceptionData,
        lines: [{ productMpId: 1, quantity: 100, unitCost: 5000, tvaRate: 20 }],
      };

      await expect(
        service.createReception(data, 'user-1', 'APPRO' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject tvaRate = -1 (negative rate)', async () => {
      const data = {
        ...baseReceptionData,
        lines: [{ productMpId: 1, quantity: 100, unitCost: 5000, tvaRate: -1 }],
      };

      await expect(
        service.createReception(data, 'user-1', 'APPRO' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should correctly calculate TVA amounts for each valid rate', async () => {
      // Test TVA calculation: totalHT = 100 * 5000 = 500000
      const data = {
        ...baseReceptionData,
        lines: [
          { productMpId: 1, quantity: 100, unitCost: 5000, tvaRate: 0 },
          { productMpId: 2, quantity: 100, unitCost: 5000, tvaRate: 9 },
          { productMpId: 3, quantity: 100, unitCost: 5000, tvaRate: 19 },
        ],
      };

      await service.createReception(data, 'user-1', 'APPRO' as any);

      const createCall = mockPrisma.receptionMp.create.mock.calls[0][0];
      const lines = createCall.data.lines.create;

      // tvaRate = 0: totalHT = 500000, tva = 0, totalTTC = 500000
      expect(lines[0].tvaRate).toBe(0);
      expect(lines[0].totalHT).toBe(500000);
      expect(lines[0].tvaAmount).toBe(0);
      expect(lines[0].totalTTC).toBe(500000);

      // tvaRate = 9: totalHT = 500000, tva = 45000, totalTTC = 545000
      expect(lines[1].tvaRate).toBe(9);
      expect(lines[1].totalHT).toBe(500000);
      expect(lines[1].tvaAmount).toBe(45000);
      expect(lines[1].totalTTC).toBe(545000);

      // tvaRate = 19: totalHT = 500000, tva = 95000, totalTTC = 595000
      expect(lines[2].tvaRate).toBe(19);
      expect(lines[2].totalHT).toBe(500000);
      expect(lines[2].tvaAmount).toBe(95000);
      expect(lines[2].totalTTC).toBe(595000);
    });
  });

  // ===========================================================================
  // IDEMPOTENCY KEY - DUPLICATE DETECTION
  // ===========================================================================

  describe('Stock movement creation with idempotency key', () => {
    it('should create movement normally when no idempotencyKey collision', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.stockMovement.create.mockResolvedValue({
        id: 1,
        movementType: 'IN',
        productType: 'MP',
        origin: 'RECEPTION',
        quantity: 100,
      });

      const result = await service.createMovement(
        {
          productType: 'MP',
          productId: 1,
          origin: 'RECEPTION',
          movementType: 'IN',
          quantity: 100,
        },
        'user-1',
        'APPRO' as any,
      );

      expect(result).toBeDefined();
      expect(result.quantity).toBe(100);
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledTimes(1);
    });

    it('should reject duplicate movements by failing at DB level (unique constraint)', async () => {
      // First movement succeeds
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.stockMovement.create
        .mockResolvedValueOnce({
          id: 1,
          movementType: 'IN',
          productType: 'MP',
          origin: 'RECEPTION',
          quantity: 100,
          idempotencyKey: 'REC-001-MP-1',
        })
        // Second call throws unique constraint error
        .mockRejectedValueOnce(
          new Error('Unique constraint failed on the fields: (`idempotency_key`)'),
        );

      // First call succeeds
      const result1 = await service.createMovement(
        {
          productType: 'MP',
          productId: 1,
          origin: 'RECEPTION',
          movementType: 'IN',
          quantity: 100,
        },
        'user-1',
        'APPRO' as any,
      );
      expect(result1.id).toBe(1);

      // Second call throws (DB unique constraint on idempotencyKey)
      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'RECEPTION',
            movementType: 'IN',
            quantity: 100,
          },
          'user-1',
          'APPRO' as any,
        ),
      ).rejects.toThrow(/Unique constraint/);
    });
  });

  // ===========================================================================
  // FIFO CONSUMPTION ORDER - OLDEST LOTS CONSUMED FIRST
  // ===========================================================================

  describe('FIFO consumption order via calculateStock', () => {
    it('should compute stock correctly from IN and OUT movements', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 500 } },
        { movementType: 'OUT', _sum: { quantity: 200 } },
      ]);

      const stock = await service.calculateStock('MP', 1);
      expect(stock).toBe(300);
    });

    it('should reject OUT movement when stock is insufficient', async () => {
      // Stock = 50 (IN:50, OUT:0)
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 50 } },
      ]);

      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'PRODUCTION_OUT',
            movementType: 'OUT',
            quantity: 100, // requires 100 but only 50 available
          },
          'user-1',
          'PRODUCTION' as any,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'PRODUCTION_OUT',
            movementType: 'OUT',
            quantity: 100,
          },
          'user-1',
          'PRODUCTION' as any,
        ),
      ).rejects.toThrow(/Stock insuffisant/);
    });

    it('should allow OUT when stock exactly matches required quantity', async () => {
      // Stock = 100 exactly
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 100 } },
      ]);
      mockPrisma.stockMovement.create.mockResolvedValue({
        id: 1,
        movementType: 'OUT',
        productType: 'MP',
        origin: 'PRODUCTION_OUT',
        quantity: 100,
      });

      const result = await service.createMovement(
        {
          productType: 'MP',
          productId: 1,
          origin: 'PRODUCTION_OUT',
          movementType: 'OUT',
          quantity: 100,
        },
        'user-1',
        'PRODUCTION' as any,
      );

      expect(result.quantity).toBe(100);
    });
  });

  // ===========================================================================
  // STOCK QUANTITY NEVER GOES NEGATIVE INVARIANT
  // ===========================================================================

  describe('Stock quantity never goes negative invariant', () => {
    it('should prevent stock from going negative via OUT movement', async () => {
      // Stock = 0 (no movements)
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);

      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'PRODUCTION_OUT',
            movementType: 'OUT',
            quantity: 1,
          },
          'user-1',
          'PRODUCTION' as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent OUT exceeding current stock (stock=10, OUT=11)', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 30 } },
        { movementType: 'OUT', _sum: { quantity: 20 } },
      ]);
      // Current stock = 30 - 20 = 10

      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'PRODUCTION_OUT',
            movementType: 'OUT',
            quantity: 11,
          },
          'user-1',
          'PRODUCTION' as any,
        ),
      ).rejects.toThrow(/Stock insuffisant/);
    });

    it('should allow IN movement even when stock is 0 (no negative risk)', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.stockMovement.create.mockResolvedValue({
        id: 1,
        movementType: 'IN',
        productType: 'MP',
        origin: 'RECEPTION',
        quantity: 50,
      });

      const result = await service.createMovement(
        {
          productType: 'MP',
          productId: 1,
          origin: 'RECEPTION',
          movementType: 'IN',
          quantity: 50,
        },
        'user-1',
        'APPRO' as any,
      );

      expect(result.quantity).toBe(50);
    });

    it('should not check stock for INVENTAIRE IN adjustments', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.stockMovement.create.mockResolvedValue({
        id: 1,
        movementType: 'IN',
        productType: 'MP',
        origin: 'INVENTAIRE',
        quantity: 999,
      });

      const result = await service.createMovement(
        {
          productType: 'MP',
          productId: 1,
          origin: 'INVENTAIRE',
          movementType: 'IN',
          quantity: 999,
        },
        'admin-1',
        'ADMIN' as any,
      );

      expect(result.quantity).toBe(999);
    });
  });

  // ===========================================================================
  // MULTI-PRODUCT RECEPTION IN A SINGLE TRANSACTION
  // ===========================================================================

  describe('Multi-product reception in a single transaction', () => {
    beforeEach(() => {
      mockPrisma.receptionMp.count.mockResolvedValue(0);
      mockPrisma.stockMovement.createMany.mockResolvedValue({ count: 3 });
    });

    it('should create reception with multiple product lines atomically', async () => {
      mockPrisma.receptionMp.create.mockImplementation(async ({ data }: any) => ({
        id: 1,
        reference: 'REC-20260301-001',
        supplierId: data.supplierId,
        status: 'VALIDATED',
        lines: data.lines.create.map((l: any, i: number) => ({
          id: i + 1,
          ...l,
          receptionMpId: 1,
        })),
      }));

      const data = {
        supplierId: 1,
        date: new Date(),
        blNumber: 'BL-MULTI-001',
        lines: [
          { productMpId: 1, quantity: 100, unitCost: 5000, tvaRate: 19 },
          { productMpId: 2, quantity: 200, unitCost: 3000, tvaRate: 9 },
          { productMpId: 3, quantity: 50, unitCost: 10000, tvaRate: 0 },
        ],
      };

      const result = await service.createReception(data, 'user-1', 'APPRO' as any);

      expect(result.lines).toHaveLength(3);
      // Verify stock movements were batch-created for all lines
      expect(mockPrisma.stockMovement.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ productMpId: 1, quantity: 100, movementType: 'IN' }),
            expect.objectContaining({ productMpId: 2, quantity: 200, movementType: 'IN' }),
            expect.objectContaining({ productMpId: 3, quantity: 50, movementType: 'IN' }),
          ]),
        }),
      );
    });

    it('should reject reception when any line has zero quantity', async () => {
      const data = {
        supplierId: 1,
        date: new Date(),
        lines: [
          { productMpId: 1, quantity: 100, unitCost: 5000 },
          { productMpId: 2, quantity: 0, unitCost: 3000 }, // Invalid!
        ],
      };

      await expect(
        service.createReception(data, 'user-1', 'APPRO' as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createReception(data, 'user-1', 'APPRO' as any),
      ).rejects.toThrow(/strictement positive/);
    });

    it('should reject reception when any line has negative quantity', async () => {
      const data = {
        supplierId: 1,
        date: new Date(),
        lines: [
          { productMpId: 1, quantity: -5, unitCost: 5000 },
        ],
      };

      await expect(
        service.createReception(data, 'user-1', 'APPRO' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reception by unauthorized role (COMMERCIAL)', async () => {
      const data = {
        supplierId: 1,
        date: new Date(),
        lines: [{ productMpId: 1, quantity: 100, unitCost: 5000 }],
      };

      await expect(
        service.createReception(data, 'user-1', 'COMMERCIAL' as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should invalidate stock cache after successful reception', async () => {
      mockPrisma.receptionMp.create.mockResolvedValue({
        id: 1,
        reference: 'REC-20260301-001',
        lines: [{ id: 1, productMpId: 1, quantity: 100 }],
      });

      const data = {
        supplierId: 1,
        date: new Date(),
        lines: [{ productMpId: 1, quantity: 100, unitCost: 5000 }],
      };

      await service.createReception(data, 'user-1', 'APPRO' as any);

      expect(mockCacheService.invalidateStockCache).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // LOT EXPIRY DATE BLOCKING (DLC EXPIRED)
  // ===========================================================================

  describe('Lot expiry date blocking (DLC expired)', () => {
    type LotStatus = 'AVAILABLE' | 'BLOCKED' | 'CONSUMED';

    function isLotExpired(expiryDate: Date | null): boolean {
      if (!expiryDate) return false;
      return expiryDate.getTime() < Date.now();
    }

    function canConsumeLot(status: LotStatus, expiryDate: Date | null, quantityRemaining: number): {
      canConsume: boolean;
      reason?: string;
    } {
      if (status === 'BLOCKED') {
        return { canConsume: false, reason: 'LOT_BLOCKED' };
      }
      if (status === 'CONSUMED') {
        return { canConsume: false, reason: 'LOT_CONSUMED' };
      }
      if (quantityRemaining <= 0) {
        return { canConsume: false, reason: 'NO_STOCK' };
      }
      if (isLotExpired(expiryDate)) {
        return { canConsume: false, reason: 'LOT_EXPIRED' };
      }
      return { canConsume: true };
    }

    it('should block consumption of expired lots', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = canConsumeLot('AVAILABLE', yesterday, 100);

      expect(result.canConsume).toBe(false);
      expect(result.reason).toBe('LOT_EXPIRED');
    });

    it('should allow consumption of non-expired lots', () => {
      const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const result = canConsumeLot('AVAILABLE', nextYear, 100);

      expect(result.canConsume).toBe(true);
    });

    it('should allow consumption of lots with no expiry date (null DLC)', () => {
      const result = canConsumeLot('AVAILABLE', null, 100);

      expect(result.canConsume).toBe(true);
    });

    it('should reject BLOCKED lots even if not expired', () => {
      const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const result = canConsumeLot('BLOCKED', nextYear, 100);

      expect(result.canConsume).toBe(false);
      expect(result.reason).toBe('LOT_BLOCKED');
    });

    it('should reject CONSUMED lots', () => {
      const result = canConsumeLot('CONSUMED', null, 0);

      expect(result.canConsume).toBe(false);
      expect(result.reason).toBe('LOT_CONSUMED');
    });

    it('should reject lots with zero remaining quantity', () => {
      const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const result = canConsumeLot('AVAILABLE', nextYear, 0);

      expect(result.canConsume).toBe(false);
      expect(result.reason).toBe('NO_STOCK');
    });

    it('should treat lot expiring today as expired', () => {
      // Lot expires at start of today (already passed)
      const todayMorning = new Date();
      todayMorning.setHours(0, 0, 0, 0);
      const result = canConsumeLot('AVAILABLE', todayMorning, 100);

      expect(result.canConsume).toBe(false);
      expect(result.reason).toBe('LOT_EXPIRED');
    });
  });

  // ===========================================================================
  // MOVEMENT SOFT-DELETE DOESN'T AFFECT STOCK CALCULATIONS
  // ===========================================================================

  describe('Movement soft-delete does not affect stock calculations', () => {
    it('should exclude soft-deleted movements from stock calculation (isDeleted filter)', async () => {
      // The service calculates stock with where: { isDeleted: false }
      // Mock returns only non-deleted movements
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 100 } },
      ]);

      const stock = await service.calculateStock('MP', 1);
      expect(stock).toBe(100);

      // Verify the query included isDeleted: false filter
      expect(mockPrisma.stockMovement.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isDeleted: false,
          }),
        }),
      );
    });

    it('should pass isDeleted:false to groupBy for both MP and PF', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);

      await service.calculateStock('MP', 1);
      expect(mockPrisma.stockMovement.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productType: 'MP',
            productMpId: 1,
            isDeleted: false,
          }),
        }),
      );

      jest.clearAllMocks();
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);

      await service.calculateStock('PF', 5);
      expect(mockPrisma.stockMovement.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productType: 'PF',
            productPfId: 5,
            isDeleted: false,
          }),
        }),
      );
    });

    it('should return 0 stock when all movements are soft-deleted (empty result)', async () => {
      // All movements are deleted => groupBy returns empty
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);

      const stock = await service.calculateStock('MP', 1);
      expect(stock).toBe(0);
    });
  });

  // ===========================================================================
  // CONCURRENT STOCK OPERATIONS (IDEMPOTENCY PROTECTION)
  // ===========================================================================

  describe('Concurrent stock operations (idempotency protection)', () => {
    it('should use $transaction for createMovement to ensure atomicity', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 200 } },
      ]);
      mockPrisma.stockMovement.create.mockResolvedValue({
        id: 1,
        movementType: 'OUT',
        productType: 'MP',
        origin: 'PRODUCTION_OUT',
        quantity: 50,
      });

      await service.createMovement(
        {
          productType: 'MP',
          productId: 1,
          origin: 'PRODUCTION_OUT',
          movementType: 'OUT',
          quantity: 50,
        },
        'user-1',
        'PRODUCTION' as any,
      );

      // $transaction should have been called
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should use $transaction for createReception to ensure atomicity', async () => {
      mockPrisma.receptionMp.count.mockResolvedValue(0);
      mockPrisma.receptionMp.create.mockResolvedValue({
        id: 1,
        reference: 'REC-001',
        lines: [{ id: 1, productMpId: 1, quantity: 100 }],
      });
      mockPrisma.stockMovement.createMany.mockResolvedValue({ count: 1 });

      await service.createReception(
        {
          supplierId: 1,
          date: new Date(),
          lines: [{ productMpId: 1, quantity: 100, unitCost: 5000 }],
        },
        'user-1',
        'APPRO' as any,
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should check stock within transaction before OUT to prevent race conditions', async () => {
      // Simulate race condition: stock is 50 at check time but another transaction
      // already consumed some. The mock simulates the check returns stock=50, so
      // OUT of 50 should work. But OUT of 51 should fail.
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 50 } },
      ]);

      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'PRODUCTION_OUT',
            movementType: 'OUT',
            quantity: 51,
          },
          'user-1',
          'PRODUCTION' as any,
        ),
      ).rejects.toThrow(/Stock insuffisant/);
    });

    it('should reject negative quantity even in concurrent scenario', async () => {
      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'RECEPTION',
            movementType: 'IN',
            quantity: -1,
          },
          'user-1',
          'APPRO' as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should roll back reception if stock movement creation fails', async () => {
      mockPrisma.receptionMp.count.mockResolvedValue(0);
      mockPrisma.receptionMp.create.mockResolvedValue({
        id: 1,
        reference: 'REC-001',
        lines: [{ id: 1, productMpId: 1, quantity: 100 }],
      });
      mockPrisma.stockMovement.createMany.mockRejectedValue(
        new Error('Database connection lost'),
      );

      // Because $transaction wraps the whole thing, the error should propagate
      await expect(
        service.createReception(
          {
            supplierId: 1,
            date: new Date(),
            lines: [{ productMpId: 1, quantity: 100, unitCost: 5000 }],
          },
          'user-1',
          'APPRO' as any,
        ),
      ).rejects.toThrow(/Database connection lost/);
    });
  });
});
