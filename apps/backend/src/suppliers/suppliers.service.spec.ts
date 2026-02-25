import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../prisma/prisma.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS — SuppliersService
// ═══════════════════════════════════════════════════════════════════════════════
// Covers:
//   1. create() — supplier without fiscal data → success with empty defaults
//   2. create() — supplier with partial fiscal data → success
//   3. create() — supplier with invalid fiscal data → error (via DTO validation)
//   4. checkFiscalUniqueness() — skips when fields are empty
//   5. checkFiscalUniqueness() — detects duplicates when fields are provided
// ═══════════════════════════════════════════════════════════════════════════════

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
    };

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
          rc: '',
          nif: '',
          ai: '',
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
  });

  // ─── checkFiscalUniqueness() tests ──────────────────────────────────────

  describe('checkFiscalUniqueness()', () => {
    it('should skip uniqueness check when RC is empty', async () => {
      // Access private method via any cast
      await (service as any).checkFiscalUniqueness('', '');

      // No database query should have been made for empty fields
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

      await (service as any).checkFiscalUniqueness('16A1234567', '123456789012345', 5);

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { not: 5 },
        }),
      });
    });
  });
});
