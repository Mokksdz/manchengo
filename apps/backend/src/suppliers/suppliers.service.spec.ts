/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TESTS — SuppliersService
 * ═══════════════════════════════════════════════════════════════════════════════
 * Covers:
 *   1. create() — supplier without fiscal data, partial fiscal, all fiscal
 *   2. checkFiscalUniqueness() — skips when empty, detects duplicates
 *   3. findAll() — with and without inactive
 *   4. findById() — found and not found
 *   5. update() — success and not found
 *   6. deactivate() — success, already inactive (still succeeds), not found
 *   7. getHistory() — with date range filters, supplier not found
 *   8. blockSupplier() — success with reason, short reason rejected, not found
 *   9. getSupplierImpacts() — returns impact chain data
 *  10. canDelete() — true when no receptions/lots, false when receptions exist,
 *      false when lots exist, not found
 *  11. calculateSupplierScore() — formula verification
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  NotImplementedException,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      supplier: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      receptionMp: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      receptionMpLine: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      productMp: {
        findMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      purchaseOrder: {
        count: jest.fn().mockResolvedValue(0),
      },
      stockMovement: {
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    // $transaction executes the callback with the prisma mock itself as tx
    prisma.$transaction = jest.fn().mockImplementation((cb) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  // ─── create() tests ─────────────────────────────────────────────────────

  describe('create()', () => {
    const baseDto = {
      name: 'SARL Test Supplier',
      phone: '0555123456',
      address: 'Zone Industrielle Rouiba',
    };

    beforeEach(() => {
      // Mock generateCode
      prisma.supplier.findFirst.mockResolvedValue(null); // no previous supplier
    });

    it('should create supplier without fiscal data (empty defaults)', async () => {
      prisma.supplier.create.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'SARL Test Supplier',
        rc: '',
        nif: '',
        ai: '',
        nis: null,
        phone: '0555123456',
        address: 'Zone Industrielle Rouiba',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(baseDto as any);

      expect(result.code).toBe('FOUR-001');
      expect(result.rc).toBe('');
      expect(result.nif).toBe('');
      expect(result.ai).toBe('');
      expect(prisma.supplier.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rc: undefined,
          nif: undefined,
          ai: undefined,
        }),
      });
    });

    it('should create supplier with partial fiscal data', async () => {
      const dto = { ...baseDto, nif: '123456789012345' };
      prisma.supplier.create.mockResolvedValue({
        id: 2,
        code: 'FOUR-001',
        name: 'SARL Test Supplier',
        rc: '',
        nif: '123456789012345',
        ai: '',
        nis: null,
        phone: '0555123456',
        address: 'Zone Industrielle Rouiba',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(dto as any);

      expect(result.nif).toBe('123456789012345');
      expect(result.rc).toBe('');
    });

    it('should create supplier with all fiscal data', async () => {
      const dto = {
        ...baseDto,
        rc: '16A1234567',
        nif: '123456789012345',
        ai: 'AI12345678',
      };
      prisma.supplier.create.mockResolvedValue({
        id: 3,
        code: 'FOUR-001',
        name: 'SARL Test Supplier',
        rc: '16A1234567',
        nif: '123456789012345',
        ai: 'AI12345678',
        nis: null,
        phone: '0555123456',
        address: 'Zone Industrielle Rouiba',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(dto as any);

      expect(result.rc).toBe('16A1234567');
      expect(result.nif).toBe('123456789012345');
      expect(result.ai).toBe('AI12345678');
    });

    it('should generate next code FOUR-002 when FOUR-001 exists', async () => {
      // First call for generateCode -> last supplier
      prisma.supplier.findFirst.mockResolvedValueOnce({ code: 'FOUR-001' });
      // Subsequent calls for checkFiscalUniqueness -> no duplicates
      prisma.supplier.findFirst.mockResolvedValue(null);

      prisma.supplier.create.mockResolvedValue({
        id: 4,
        code: 'FOUR-002',
        name: 'New Supplier',
        rc: '',
        nif: '',
        ai: '',
        nis: null,
        phone: '0555123456',
        address: 'Alger',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(baseDto as any);
      expect(result.code).toBe('FOUR-002');
      expect(prisma.supplier.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ code: 'FOUR-002' }),
      });
    });
  });

  // ─── checkFiscalUniqueness() tests ──────────────────────────────────────

  describe('checkFiscalUniqueness()', () => {
    it('should skip uniqueness check when RC is empty', async () => {
      await (service as any).checkFiscalUniqueness('', '');
      expect(prisma.supplier.findFirst).not.toHaveBeenCalled();
    });

    it('should skip uniqueness check when RC is "MIGRATED" (legacy)', async () => {
      await (service as any).checkFiscalUniqueness('MIGRATED', '000000000000000');
      expect(prisma.supplier.findFirst).not.toHaveBeenCalled();
    });

    it('should detect RC duplicate when provided', async () => {
      prisma.supplier.findFirst.mockResolvedValue({
        id: 99,
        code: 'FOUR-099',
        name: 'Existing Supplier',
        rc: '16A9999999',
      });

      await expect(
        (service as any).checkFiscalUniqueness('16A9999999', ''),
      ).rejects.toThrow(ConflictException);
    });

    it('should detect NIF duplicate when provided', async () => {
      // First call (RC check) — no duplicate
      prisma.supplier.findFirst.mockResolvedValueOnce(null);
      // Second call (NIF check) — duplicate found
      prisma.supplier.findFirst.mockResolvedValueOnce({
        id: 99,
        code: 'FOUR-099',
        name: 'Existing Supplier',
        nif: '999888777666555',
      });

      await expect(
        (service as any).checkFiscalUniqueness('16AUNIQUE', '999888777666555'),
      ).rejects.toThrow(ConflictException);
    });

    it('should pass when no duplicates exist', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        (service as any).checkFiscalUniqueness('16ANEW123', '111222333444555'),
      ).resolves.toBeUndefined();
    });

    it('should exclude current supplier ID in update scenario', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await (service as any).checkFiscalUniqueness('16A1234567', '123456789012345', undefined, 5);

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { not: 5 },
        }),
      });
    });
  });

  // ─── findAll() tests ────────────────────────────────────────────────────

  describe('findAll()', () => {
    const mockSuppliers = [
      {
        id: 1,
        code: 'FOUR-001',
        name: 'Fournisseur A',
        rc: '16A001',
        nif: '111111111111111',
        ai: 'AI001',
        nis: null,
        phone: '0555111111',
        address: 'Alger',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { receptions: 5 },
      },
      {
        id: 2,
        code: 'FOUR-002',
        name: 'Fournisseur B',
        rc: '16A002',
        nif: '222222222222222',
        ai: 'AI002',
        nis: '333333333333333',
        phone: '0555222222',
        address: 'Oran',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { receptions: 0 },
      },
    ];

    it('should return only active suppliers by default', async () => {
      prisma.supplier.findMany.mockResolvedValue([mockSuppliers[0]]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Fournisseur A');
      expect(result[0].receptionCount).toBe(5);
      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should return all suppliers including inactive when includeInactive is true', async () => {
      prisma.supplier.findMany.mockResolvedValue(mockSuppliers);

      const result = await service.findAll(true);

      expect(result).toHaveLength(2);
      expect(result[1].isActive).toBe(false);
      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('should map nis to undefined when null', async () => {
      prisma.supplier.findMany.mockResolvedValue([mockSuppliers[0]]);

      const result = await service.findAll();

      expect(result[0].nis).toBeUndefined();
    });

    it('should include nis when present', async () => {
      prisma.supplier.findMany.mockResolvedValue([mockSuppliers[1]]);

      const result = await service.findAll(true);

      expect(result[0].nis).toBe('333333333333333');
    });

    it('should order suppliers by name ascending', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  // ─── findById() tests ───────────────────────────────────────────────────

  describe('findById()', () => {
    it('should return a supplier when found', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'Fournisseur A',
        rc: '16A001',
        nif: '111111111111111',
        ai: 'AI001',
        nis: null,
        phone: '0555111111',
        address: 'Alger',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { receptions: 3 },
      });

      const result = await service.findById(1);

      expect(result.id).toBe(1);
      expect(result.code).toBe('FOUR-001');
      expect(result.name).toBe('Fournisseur A');
      expect(result.receptionCount).toBe(3);
    });

    it('should throw NotFoundException when supplier not found', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
      await expect(service.findById(999)).rejects.toThrow(/999/);
    });

    it('should include _count receptions in query', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      try { await service.findById(1); } catch { /* expected */ }

      expect(prisma.supplier.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { _count: { select: { receptions: true } } },
      });
    });
  });

  // ─── update() tests ────────────────────────────────────────────────────

  describe('update()', () => {
    it('should update supplier successfully', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'Old Name',
        rc: '16AOLD',
        nif: '111111111111111',
        ai: 'AI001',
        nis: null,
        phone: '0555111111',
        address: 'Old Address',
        isActive: true,
      });
      prisma.supplier.findFirst.mockResolvedValue(null); // no fiscal duplicates
      prisma.supplier.update.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'New Name',
        rc: '16AOLD',
        nif: '111111111111111',
        ai: 'AI001',
        nis: null,
        phone: '0555999999',
        address: 'New Address',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { receptions: 2 },
      });

      const result = await service.update(1, { name: 'New Name', phone: '0555999999', address: 'New Address' });

      expect(result.name).toBe('New Name');
      expect(result.phone).toBe('0555999999');
      expect(result.receptionCount).toBe(2);
    });

    it('should throw NotFoundException when updating non-existent supplier', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(
        service.update(999, { name: 'Whatever' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should check fiscal uniqueness when RC is updated', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'Supplier',
        rc: '16AOLD',
        nif: '111111111111111',
        isActive: true,
      });
      // RC duplicate detected
      prisma.supplier.findFirst.mockResolvedValue({
        id: 2,
        code: 'FOUR-002',
        name: 'Other Supplier',
        rc: '16ANEW',
      });

      await expect(
        service.update(1, { rc: '16ANEW' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should skip fiscal uniqueness check when only name is updated', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'Old',
        rc: '16A001',
        nif: '111111111111111',
        isActive: true,
      });
      prisma.supplier.update.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'New',
        rc: '16A001',
        nif: '111111111111111',
        ai: '',
        nis: null,
        phone: '0555111111',
        address: 'Alger',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { receptions: 0 },
      });

      await service.update(1, { name: 'New' });

      // checkFiscalUniqueness should NOT have been called (no rc/nif in dto)
      // findFirst is called once for generateCode in create, but for update it should not be called
      // Actually in update, if dto.rc and dto.nif are both undefined, checkFiscalUniqueness is skipped
      expect(prisma.supplier.findFirst).not.toHaveBeenCalled();
    });

    it('should update isActive field', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'Supplier',
        rc: '',
        nif: '',
        isActive: true,
      });
      prisma.supplier.update.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'Supplier',
        rc: '',
        nif: '',
        ai: '',
        nis: null,
        phone: '0555111111',
        address: 'Alger',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { receptions: 0 },
      });

      const result = await service.update(1, { isActive: false });

      expect(result.isActive).toBe(false);
    });
  });

  // ─── deactivate() tests ─────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('should deactivate supplier successfully', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'Active Supplier',
        isActive: true,
        _count: { receptions: 3 },
      });
      prisma.supplier.update.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'Active Supplier',
        rc: '',
        nif: '',
        ai: '',
        nis: null,
        phone: '0555111111',
        address: 'Alger',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { receptions: 3 },
      });

      const result = await service.deactivate(1);

      expect(result.isActive).toBe(false);
      expect(result.receptionCount).toBe(3);
      expect(prisma.supplier.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
        include: { _count: { select: { receptions: true } } },
      });
    });

    it('should still deactivate an already inactive supplier (idempotent)', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 2,
        code: 'FOUR-002',
        name: 'Inactive Supplier',
        isActive: false,
        _count: { receptions: 0 },
      });
      prisma.supplier.update.mockResolvedValue({
        id: 2,
        code: 'FOUR-002',
        name: 'Inactive Supplier',
        rc: '',
        nif: '',
        ai: '',
        nis: null,
        phone: '0555222222',
        address: 'Oran',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { receptions: 0 },
      });

      const result = await service.deactivate(2);

      expect(result.isActive).toBe(false);
      expect(prisma.supplier.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when supplier not found', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(NotFoundException);
      await expect(service.deactivate(999)).rejects.toThrow(/999/);
    });
  });

  // ─── canDelete() tests ──────────────────────────────────────────────────

  describe('canDelete()', () => {
    it('should return canDelete=true when no receptions and no lots', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'New Supplier',
        _count: { receptions: 0, lots: 0 },
      });

      const result = await service.canDelete(1);

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return canDelete=false when receptions exist', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 2,
        code: 'FOUR-002',
        name: 'Supplier With Receptions',
        _count: { receptions: 5, lots: 0 },
      });

      const result = await service.canDelete(2);

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('5');
      expect(result.reason).toContain('réception');
    });

    it('should return canDelete=false when lots exist', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 3,
        code: 'FOUR-003',
        name: 'Supplier With Lots',
        _count: { receptions: 0, lots: 3 },
      });

      const result = await service.canDelete(3);

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('3');
      expect(result.reason).toContain('lot');
    });

    it('should prioritize receptions check over lots', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 4,
        code: 'FOUR-004',
        name: 'Supplier With Both',
        _count: { receptions: 2, lots: 4 },
      });

      const result = await service.canDelete(4);

      expect(result.canDelete).toBe(false);
      // Should mention receptions first (checked first in code)
      expect(result.reason).toContain('réception');
    });

    it('should throw NotFoundException when supplier not found', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.canDelete(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getHistory() tests ─────────────────────────────────────────────────

  describe('getHistory()', () => {
    const mockSupplierMinimal = { id: 1, code: 'FOUR-001', name: 'Fournisseur A' };

    it('should return history with pagination', async () => {
      prisma.supplier.findUnique.mockResolvedValue(mockSupplierMinimal);
      prisma.receptionMp.count.mockResolvedValue(25);
      prisma.receptionMp.findMany.mockResolvedValue([
        {
          id: 1,
          reference: 'REC-001',
          date: new Date('2025-06-15'),
          blNumber: 'BL-001',
          status: 'VALIDATED',
          lines: [
            { id: 1, quantity: 100, unitCost: 500, productMp: { code: 'MP-001', name: 'Lait', unit: 'L' } },
          ],
        },
      ]);
      prisma.receptionMpLine.aggregate.mockResolvedValue({
        _sum: { quantity: 1000, unitCost: 5000 },
        _count: 10,
      });
      prisma.receptionMpLine.findMany.mockResolvedValue([
        { quantity: 100, unitCost: 500 },
        { quantity: 200, unitCost: 300 },
      ]);

      const result = await service.getHistory(1, { page: 1, limit: 10 });

      expect(result.supplier).toEqual(mockSupplierMinimal);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.receptions).toHaveLength(1);
      expect(result.receptions[0].reference).toBe('REC-001');
      expect(result.totals.receptions).toBe(25);
      expect(result.totals.totalAmount).toBe(110000); // 100*500 + 200*300
    });

    it('should filter by year', async () => {
      prisma.supplier.findUnique.mockResolvedValue(mockSupplierMinimal);
      prisma.receptionMp.count.mockResolvedValue(0);
      prisma.receptionMp.findMany.mockResolvedValue([]);
      prisma.receptionMpLine.aggregate.mockResolvedValue({
        _sum: { quantity: null, unitCost: null },
        _count: 0,
      });
      prisma.receptionMpLine.findMany.mockResolvedValue([]);

      await service.getHistory(1, { year: 2025, page: 1, limit: 10 });

      expect(prisma.receptionMp.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          supplierId: 1,
          date: {
            gte: new Date(2025, 0, 1),
            lte: new Date(2025, 11, 31, 23, 59, 59),
          },
        }),
      });
    });

    it('should filter by year and month', async () => {
      prisma.supplier.findUnique.mockResolvedValue(mockSupplierMinimal);
      prisma.receptionMp.count.mockResolvedValue(0);
      prisma.receptionMp.findMany.mockResolvedValue([]);
      prisma.receptionMpLine.aggregate.mockResolvedValue({
        _sum: { quantity: null, unitCost: null },
        _count: 0,
      });
      prisma.receptionMpLine.findMany.mockResolvedValue([]);

      await service.getHistory(1, { year: 2025, month: 6, page: 1, limit: 10 });

      expect(prisma.receptionMp.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          supplierId: 1,
          date: {
            gte: new Date(2025, 5, 1),      // June 1
            lte: new Date(2025, 6, 0, 23, 59, 59),  // June 30
          },
        }),
      });
    });

    it('should filter by from/to date range', async () => {
      prisma.supplier.findUnique.mockResolvedValue(mockSupplierMinimal);
      prisma.receptionMp.count.mockResolvedValue(0);
      prisma.receptionMp.findMany.mockResolvedValue([]);
      prisma.receptionMpLine.aggregate.mockResolvedValue({
        _sum: { quantity: null, unitCost: null },
        _count: 0,
      });
      prisma.receptionMpLine.findMany.mockResolvedValue([]);

      const from = new Date('2025-01-15');
      const to = new Date('2025-03-15');

      await service.getHistory(1, { from, to, page: 1, limit: 10 });

      expect(prisma.receptionMp.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          supplierId: 1,
          date: {
            gte: from,
            lte: expect.any(Date),
          },
        }),
      });
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(
        service.getHistory(999, { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return zero totals when no receptions', async () => {
      prisma.supplier.findUnique.mockResolvedValue(mockSupplierMinimal);
      prisma.receptionMp.count.mockResolvedValue(0);
      prisma.receptionMp.findMany.mockResolvedValue([]);
      prisma.receptionMpLine.aggregate.mockResolvedValue({
        _sum: { quantity: null, unitCost: null },
        _count: 0,
      });
      prisma.receptionMpLine.findMany.mockResolvedValue([]);

      const result = await service.getHistory(1, { page: 1, limit: 10 });

      expect(result.totals.receptions).toBe(0);
      expect(result.totals.lines).toBe(0);
      expect(result.totals.totalQuantity).toBe(0);
      expect(result.totals.totalAmount).toBe(0);
    });

    it('should calculate line totals correctly in receptions map', async () => {
      prisma.supplier.findUnique.mockResolvedValue(mockSupplierMinimal);
      prisma.receptionMp.count.mockResolvedValue(1);
      prisma.receptionMp.findMany.mockResolvedValue([
        {
          id: 1,
          reference: 'REC-010',
          date: new Date('2025-03-01'),
          blNumber: 'BL-010',
          status: 'VALIDATED',
          lines: [
            { id: 1, quantity: 50, unitCost: 200, productMp: { code: 'MP-A', name: 'Produit A', unit: 'KG' } },
            { id: 2, quantity: 30, unitCost: 100, productMp: { code: 'MP-B', name: 'Produit B', unit: 'L' } },
          ],
        },
      ]);
      prisma.receptionMpLine.aggregate.mockResolvedValue({
        _sum: { quantity: 80, unitCost: 300 },
        _count: 2,
      });
      prisma.receptionMpLine.findMany.mockResolvedValue([
        { quantity: 50, unitCost: 200 },
        { quantity: 30, unitCost: 100 },
      ]);

      const result = await service.getHistory(1, { page: 1, limit: 10 });

      // Reception-level total: (50 * 200) + (30 * 100) = 10000 + 3000 = 13000
      expect(result.receptions[0].total).toBe(13000);
      // Line-level totals
      expect(result.receptions[0].lines[0].lineTotal).toBe(10000);
      expect(result.receptions[0].lines[1].lineTotal).toBe(3000);
    });
  });

  // ─── blockSupplier() tests ──────────────────────────────────────────────

  describe('blockSupplier()', () => {
    it('should throw NotImplementedException for valid block (feature pending migration)', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'Fournisseur A',
        rc: '16A001',
        nif: '111111111111111',
        ai: 'AI001',
        nis: null,
        phone: '0555111111',
        address: 'Alger',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { receptions: 2 },
      });

      await expect(
        service.blockSupplier(
          1,
          { reason: 'Retards repetes sur les livraisons MP' },
          1,
        ),
      ).rejects.toThrow(NotImplementedException);
    });

    it('should throw BadRequestException when reason is too short', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'Fournisseur A',
        isActive: true,
        _count: { receptions: 0 },
      });

      await expect(
        service.blockSupplier(1, { reason: 'Short' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when reason is empty', async () => {
      prisma.supplier.findUnique.mockResolvedValue({
        id: 1,
        code: 'FOUR-001',
        name: 'Fournisseur A',
        isActive: true,
        _count: { receptions: 0 },
      });

      await expect(
        service.blockSupplier(1, { reason: '' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when supplier not found', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(
        service.blockSupplier(999, { reason: 'Retards frequents sur approvisionnement' }, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getSupplierImpacts() tests ─────────────────────────────────────────

  describe('getSupplierImpacts()', () => {
    it('should return empty array when no active suppliers exist', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      const result = await service.getSupplierImpacts();

      expect(result).toEqual([]);
    });

    it('should return impact data for active suppliers', async () => {
      prisma.supplier.findMany.mockResolvedValue([
        {
          id: 1,
          code: 'FOUR-001',
          name: 'Fournisseur Test',
          tauxRetard: 0.1,
          isActive: true,
          productsMpPrincipaux: [
            {
              id: 10,
              minStock: 100,
              consommationMoyJour: 10,
              recipeItems: [
                { recipe: { id: 1, name: 'Recette A', isActive: true } },
              ],
            },
          ],
          purchaseOrders: [
            {
              id: 'bc-1',
              reference: 'BC-001',
              status: 'CONFIRMED',
              expectedDelivery: new Date(Date.now() + 86400000 * 5), // 5 days from now
              items: [{ productMpId: 10 }],
            },
          ],
          receptions: [],
        },
      ]);

      // Mock stock movement for the MP
      prisma.stockMovement.aggregate.mockResolvedValue({ _sum: { quantity: 50 } });
      prisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 200 } },
        { movementType: 'OUT', _sum: { quantity: 150 } },
      ]);

      // Mock mono-source count
      prisma.productMp.findMany.mockResolvedValue([{ id: 10 }]);

      const result = await service.getSupplierImpacts();

      expect(result).toHaveLength(1);
      expect(result[0].supplierId).toBe(1);
      expect(result[0].supplierCode).toBe('FOUR-001');
      expect(result[0].bcBlockingCount).toBe(1);
      expect(result[0].reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(result[0].reliabilityScore).toBeLessThanOrEqual(100);
      expect(['CRITICAL', 'WARNING', 'STABLE']).toContain(result[0].riskLevel);
    });

    it('should sort results by risk level (CRITICAL first)', async () => {
      prisma.supplier.findMany.mockResolvedValue([
        {
          id: 1,
          code: 'FOUR-001',
          name: 'Stable Supplier',
          tauxRetard: 0,
          isActive: true,
          productsMpPrincipaux: [],
          purchaseOrders: [],
          receptions: [],
        },
        {
          id: 2,
          code: 'FOUR-002',
          name: 'Critical Supplier',
          tauxRetard: 0.9,
          isActive: true,
          productsMpPrincipaux: [
            {
              id: 20,
              minStock: 500,
              consommationMoyJour: 50,
              recipeItems: [
                { recipe: { id: 5, name: 'Recette X', isActive: true } },
              ],
            },
          ],
          purchaseOrders: [],
          receptions: [],
        },
      ]);

      // Stock movement for critical supplier's MP: zero stock
      prisma.stockMovement.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
      prisma.stockMovement.groupBy.mockResolvedValue([]);
      prisma.productMp.findMany.mockResolvedValue([{ id: 20 }]);

      const result = await service.getSupplierImpacts();

      expect(result).toHaveLength(2);
      // Critical should come first
      expect(result[0].supplierCode).toBe('FOUR-002');
      expect(result[0].riskLevel).toBe('CRITICAL');
    });
  });

  // ─── calculateSupplierScore() tests ─────────────────────────────────────

  describe('calculateSupplierScore()', () => {
    it('should return 100 for perfect supplier (no delays, no incidents, no blocked MP)', () => {
      const score = service.calculateSupplierScore(0, 0, 0);

      expect(score.score).toBe(100);
      expect(score.delayPenalty).toBe(0);
      expect(score.incidentPenalty).toBe(0);
      expect(score.blockedMpPenalty).toBe(0);
    });

    it('should apply delay penalty correctly (delayRate * 40)', () => {
      const score = service.calculateSupplierScore(0.5, 0, 0);

      expect(score.delayPenalty).toBe(20); // 0.5 * 40 = 20
      expect(score.score).toBe(80);
    });

    it('should apply incident penalty (capped at 30)', () => {
      const score = service.calculateSupplierScore(0, 3, 0);

      expect(score.incidentPenalty).toBe(30); // 3 * 15 = 45, capped at 30
      expect(score.score).toBe(70);
    });

    it('should apply blocked MP penalty (capped at 20)', () => {
      const score = service.calculateSupplierScore(0, 0, 5);

      expect(score.blockedMpPenalty).toBe(20); // 5 * 10 = 50, capped at 20
      expect(score.score).toBe(80);
    });

    it('should never go below 0', () => {
      const score = service.calculateSupplierScore(1, 5, 5);

      expect(score.score).toBeGreaterThanOrEqual(0);
      // 100 - (1 * 40) - min(5*15, 30) - min(5*10, 20) = 100 - 40 - 30 - 20 = 10
      expect(score.score).toBe(10);
    });

    it('should combine all penalties', () => {
      // 100 - (0.25 * 40) - (1 * 15) - (1 * 10) = 100 - 10 - 15 - 10 = 65
      const score = service.calculateSupplierScore(0.25, 1, 1);

      expect(score.score).toBe(65);
      expect(score.delayPenalty).toBe(10);
      expect(score.incidentPenalty).toBe(15);
      expect(score.blockedMpPenalty).toBe(10);
      expect(score.formula).toContain('0.25');
    });
  });
});
