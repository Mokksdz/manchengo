import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethodDto } from './dto/invoice.dto';

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS — InvoicesService
// ═══════════════════════════════════════════════════════════════════════════════
// Covers:
//   1. update() — DRAFT-only edit guard
//   2. update() — recalculates totals when lines change
//   3. update() — recalculates timbre when paymentMethod changes
//   4. updateStatus() — fiscal validation on DRAFT → VALIDATED
//   5. updateStatus() — CANCELLED bypasses fiscal validation
//   6. create() — TVA 19% calculation
//   7. create() — timbre fiscal percentage-based for ESPECES
//   8. create() — no timbre for non-ESPECES payment
//   9. create() — multiple lines total calculation
//  10. create() — reference auto-generation (F-YYYY-NNNNN)
//  11. create() — rejects empty lines
//  12. findAll() — filters by status and clientId
//  13. findOne() — returns invoice or throws NotFoundException
//  14. Edge cases — NIF format validation, large invoices, null fiscal fields
//  15. Line-level remise (discount) support
//  16. Status machine transitions (DRAFT→VALIDATED→PAID)
//  17. Cancellation tracking
//  18. Product existence validation
// ═══════════════════════════════════════════════════════════════════════════════

// Timbre fiscal: 119000 centimes = 1190 DA, <=30000 DA => 1% rate
// timbreFiscal = Math.round(119000 * 0.01) = 1190
const mockInvoice = (overrides: Partial<any> = {}) => ({
  id: 1,
  reference: `F-${new Date().getFullYear()}-00001`,
  status: 'DRAFT',
  clientId: 10,
  paymentMethod: 'ESPECES',
  date: new Date('2025-02-25'),
  fiscalYear: new Date().getFullYear(),
  totalHt: 100000,
  totalTva: 19000,
  totalTtc: 119000,
  timbreFiscal: 1190,
  timbreRate: 0.01,
  netToPay: 120190,
  client: { id: 10, code: 'CLI001', name: 'Test Client' },
  lines: [
    { productPfId: 1, quantity: 10, unitPriceHt: 10000, remise: 0, lineHt: 100000 },
  ],
  ...overrides,
});

const mockClient = (overrides: Partial<any> = {}) => ({
  id: 10,
  code: 'CLI001',
  name: 'Test Client',
  nif: '123456789012345',
  rc: '16A1234567',
  ai: 'AI12345678',
  nis: '',
  ...overrides,
});

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      invoice: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      invoiceLine: {
        deleteMany: jest.fn(),
      },
      client: {
        findUnique: jest.fn(),
      },
      productPf: {
        findMany: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]),
      },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  // ─── update() tests ─────────────────────────────────────────────────────

  describe('update()', () => {
    it('should update a DRAFT invoice successfully', async () => {
      const invoice = mockInvoice();
      prisma.invoice.findUnique.mockResolvedValue(invoice);
      prisma.invoice.update.mockResolvedValue({ ...invoice, date: new Date('2025-03-01') });

      const result = await service.update(1, { date: '2025-03-01' }, 'user1');
      expect(result).toBeDefined();
      expect(prisma.invoice.update).toHaveBeenCalled();
    });

    it('should reject modification of PAID invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: 'PAID' }));

      await expect(
        service.update(1, { date: '2025-03-01' }, 'user1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(1, { date: '2025-03-01' }, 'user1'),
      ).rejects.toThrow('brouillon');
    });

    it('should reject modification of CANCELLED invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: 'CANCELLED' }));

      await expect(
        service.update(1, { date: '2025-03-01' }, 'user1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should recalculate totals when lines are provided', async () => {
      const invoice = mockInvoice();
      prisma.invoice.findUnique.mockResolvedValue(invoice);
      prisma.invoiceLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.invoice.update.mockResolvedValue({
        ...invoice,
        totalHt: 200000,
        totalTva: 38000,
        totalTtc: 238000,
        timbreFiscal: 5000,
        netToPay: 243000,
      });

      await service.update(
        1,
        {
          lines: [
            { productPfId: 1, quantity: 20, unitPriceHt: 10000 },
          ],
        },
        'user1',
      );

      // Verify transaction was used
      expect(prisma.$transaction).toHaveBeenCalled();
      // Verify old lines were deleted
      expect(prisma.invoiceLine.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId: 1 },
      });
    });

    it('should recalculate timbre when paymentMethod changes to VIREMENT', async () => {
      const invoice = mockInvoice({ paymentMethod: 'ESPECES', timbreFiscal: 1190 });
      prisma.invoice.findUnique.mockResolvedValue(invoice);
      prisma.invoice.update.mockResolvedValue({
        ...invoice,
        paymentMethod: 'VIREMENT',
        timbreFiscal: 0,
        timbreRate: 0,
        netToPay: 119000,
      });

      await service.update(1, { paymentMethod: PaymentMethodDto.VIREMENT }, 'user1');

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timbreFiscal: 0,
            timbreRate: 0,
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.update(999, { date: '2025-03-01' }, 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent client', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.update(1, { clientId: 999 }, 'user1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateStatus() fiscal validation tests ─────────────────────────────

  describe('updateStatus() — fiscal validation', () => {
    it('should allow DRAFT → VALIDATED when client has complete fiscal data', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient());
      prisma.invoice.update.mockResolvedValue(mockInvoice({ status: 'VALIDATED' }));

      const result = await service.updateStatus(1, { status: 'VALIDATED' as any });
      expect(result.status).toBe('VALIDATED');
    });

    it('should reject DRAFT → VALIDATED when client NIF is missing', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ nif: '' }));

      await expect(
        service.updateStatus(1, { status: 'VALIDATED' as any }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus(1, { status: 'VALIDATED' as any }),
      ).rejects.toThrow('NIF');
    });

    it('should reject DRAFT → VALIDATED when client RC is missing', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ rc: '' }));

      await expect(
        service.updateStatus(1, { status: 'VALIDATED' as any }),
      ).rejects.toThrow('RC');
    });

    it('should reject DRAFT → VALIDATED when client AI is missing', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ ai: '' }));

      await expect(
        service.updateStatus(1, { status: 'VALIDATED' as any }),
      ).rejects.toThrow("AI");
    });

    it('should reject DRAFT → VALIDATED with message listing all missing fields', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ nif: '', rc: '', ai: '' }));

      try {
        await service.updateStatus(1, { status: 'VALIDATED' as any });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toContain('NIF');
        expect(err.message).toContain('RC');
        expect(err.message).toContain('AI');
        expect(err.message).toContain('Test Client');
      }
    });

    it('should reject DRAFT → PAID (must go through VALIDATED first)', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());

      await expect(
        service.updateStatus(1, { status: 'PAID' as any }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus(1, { status: 'PAID' as any }),
      ).rejects.toThrow('Transition invalide');
    });

    it('should allow VALIDATED → PAID without fiscal validation', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: 'VALIDATED' }));
      prisma.invoice.update.mockResolvedValue(mockInvoice({ status: 'PAID' }));

      const result = await service.updateStatus(1, { status: 'PAID' as any });
      expect(result.status).toBe('PAID');
      // Client should NOT be fetched for PAID (fiscal check is on VALIDATED)
      expect(prisma.client.findUnique).not.toHaveBeenCalled();
    });

    it('should allow VALIDATED → PARTIALLY_PAID', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: 'VALIDATED' }));
      prisma.invoice.update.mockResolvedValue(mockInvoice({ status: 'PARTIALLY_PAID' }));

      const result = await service.updateStatus(1, { status: 'PARTIALLY_PAID' as any });
      expect(result.status).toBe('PARTIALLY_PAID');
    });

    it('should allow PARTIALLY_PAID → PAID', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: 'PARTIALLY_PAID' }));
      prisma.invoice.update.mockResolvedValue(mockInvoice({ status: 'PAID' }));

      const result = await service.updateStatus(1, { status: 'PAID' as any });
      expect(result.status).toBe('PAID');
    });

    it('should allow DRAFT → CANCELLED without fiscal validation', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      // Client has NO fiscal data — but CANCELLED should still work
      prisma.invoice.update.mockResolvedValue(mockInvoice({ status: 'CANCELLED' }));

      const result = await service.updateStatus(1, { status: 'CANCELLED' as any });
      expect(result.status).toBe('CANCELLED');
      // Client should NOT be fetched for CANCELLED
      expect(prisma.client.findUnique).not.toHaveBeenCalled();
    });

    it('should reject modification of already CANCELLED invoice (terminal state)', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: 'CANCELLED' }));

      await expect(
        service.updateStatus(1, { status: 'PAID' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject PAID → DRAFT rollback (PAID is terminal)', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: 'PAID' }));

      await expect(
        service.updateStatus(1, { status: 'DRAFT' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject PAID → CANCELLED (PAID is terminal)', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: 'PAID' }));

      await expect(
        service.updateStatus(1, { status: 'CANCELLED' as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW TESTS — create() : TVA, timbre, calculs fiscaux
  // ═══════════════════════════════════════════════════════════════════════════

  describe('create()', () => {
    const baseCreateDto = {
      clientId: 10,
      date: '2025-02-25',
      paymentMethod: PaymentMethodDto.ESPECES,
      lines: [
        { productPfId: 1, quantity: 10, unitPriceHt: 10000 },
      ],
    };

    const currentYear = new Date().getFullYear();

    beforeEach(() => {
      // Default mocks for create
      prisma.invoice.findFirst.mockResolvedValue(null); // No previous invoice
      prisma.client.findUnique.mockResolvedValue(mockClient());
      prisma.productPf.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
      prisma.invoice.create.mockImplementation(async ({ data }: any) => ({
        id: 1,
        reference: `F-${currentYear}-00001`,
        ...data,
        client: { code: 'CLI001', name: 'Test Client' },
        lines: data.lines?.create || [],
      }));
    });

    it('should calculate TVA at 19% correctly', async () => {
      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        // Verify the TVA calculation: 100000 * 0.19 = 19000
        expect(data.totalHt).toBe(100000);
        expect(data.totalTva).toBe(19000);
        expect(data.totalTtc).toBe(119000);
        return {
          id: 1,
          reference: 'F-250225-001',
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(baseCreateDto, 'user-1');
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should apply percentage-based timbre fiscal for ESPECES payment', async () => {
      // totalHt=100000, totalTva=19000, totalTtc=119000
      // 119000 centimes = 1190 DA <= 30000 DA => rate 1%
      // timbreFiscal = Math.round(119000 * 0.01) = 1190
      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        expect(data.timbreFiscal).toBe(1190);
        expect(data.timbreRate).toBe(0.01);
        expect(data.netToPay).toBe(data.totalTtc + 1190);
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(baseCreateDto, 'user-1');
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should NOT apply timbre fiscal for VIREMENT payment (timbre = 0)', async () => {
      const virementDto = {
        ...baseCreateDto,
        paymentMethod: PaymentMethodDto.VIREMENT,
      };

      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        expect(data.timbreFiscal).toBe(0);
        expect(data.timbreRate).toBe(0);
        expect(data.netToPay).toBe(data.totalTtc);
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(virementDto, 'user-1');
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should NOT apply timbre fiscal for CHEQUE payment (timbre = 0)', async () => {
      const chequeDto = {
        ...baseCreateDto,
        paymentMethod: PaymentMethodDto.CHEQUE,
      };

      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        expect(data.timbreFiscal).toBe(0);
        expect(data.timbreRate).toBe(0);
        expect(data.netToPay).toBe(data.totalTtc);
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(chequeDto, 'user-1');
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should calculate totals correctly with multiple lines', async () => {
      const multiLineDto = {
        ...baseCreateDto,
        lines: [
          { productPfId: 1, quantity: 5, unitPriceHt: 20000 },   // 100000
          { productPfId: 2, quantity: 10, unitPriceHt: 15000 },  // 150000
          { productPfId: 3, quantity: 3, unitPriceHt: 50000 },   // 150000
        ],
      };

      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        // totalHt = 100000 + 150000 + 150000 = 400000
        expect(data.totalHt).toBe(400000);
        // totalTva = 400000 * 0.19 = 76000
        expect(data.totalTva).toBe(76000);
        // totalTtc = 400000 + 76000 = 476000
        expect(data.totalTtc).toBe(476000);
        // 476000 centimes = 4760 DA <= 30000 DA => 1% rate
        // timbreFiscal = Math.round(476000 * 0.01) = 4760
        expect(data.timbreFiscal).toBe(4760);
        // netToPay = 476000 + 4760 = 480760
        expect(data.netToPay).toBe(480760);
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(multiLineDto, 'user-1');
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should reject creating an invoice with no lines', async () => {
      const emptyLinesDto = {
        ...baseCreateDto,
        lines: [],
      };

      await expect(
        service.create(emptyLinesDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(emptyLinesDto, 'user-1'),
      ).rejects.toThrow('au moins une ligne');
    });

    it('should generate reference with auto-incrementing number (annual format)', async () => {
      // The service derives the year from dto.date ('2025-02-25' → 2025)
      const invoiceYear = new Date(baseCreateDto.date).getFullYear();
      // Simulate there is already an invoice with number 00003
      prisma.invoice.findFirst.mockResolvedValue({
        reference: `F-${invoiceYear}-00003`,
      });

      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        expect(data.reference).toBe(`F-${invoiceYear}-00004`);
        expect(data.fiscalYear).toBe(invoiceYear);
        return {
          id: 1,
          reference: data.reference,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(baseCreateDto, 'user-1');
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should start reference numbering at 00001 when no previous invoice exists', async () => {
      // The service derives the year from dto.date ('2025-02-25' → 2025)
      const invoiceYear = new Date(baseCreateDto.date).getFullYear();
      prisma.invoice.findFirst.mockResolvedValue(null);

      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        expect(data.reference).toBe(`F-${invoiceYear}-00001`);
        expect(data.fiscalYear).toBe(invoiceYear);
        return {
          id: 1,
          reference: data.reference,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(baseCreateDto, 'user-1');
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should set status to DRAFT for newly created invoices', async () => {
      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        expect(data.status).toBe('DRAFT');
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(baseCreateDto, 'user-1');
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.create(baseCreateDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create invoice lines with correct lineHt (quantity * unitPriceHt - remise)', async () => {
      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        const lines = data.lines.create;
        expect(lines).toHaveLength(1);
        expect(lines[0].lineHt).toBe(10 * 10000); // 100000 (no remise)
        expect(lines[0].quantity).toBe(10);
        expect(lines[0].unitPriceHt).toBe(10000);
        expect(lines[0].remise).toBe(0);
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(baseCreateDto, 'user-1');
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should apply line-level remise (discount) correctly', async () => {
      const dtoWithRemise = {
        ...baseCreateDto,
        lines: [
          { productPfId: 1, quantity: 10, unitPriceHt: 10000, remise: 5000 },
        ],
      };

      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        const lines = data.lines.create;
        expect(lines).toHaveLength(1);
        // lineHt = (10 * 10000) - 5000 = 95000
        expect(lines[0].lineHt).toBe(95000);
        expect(lines[0].remise).toBe(5000);
        // totalHt = 95000
        expect(data.totalHt).toBe(95000);
        // totalTva = Math.round(95000 * 0.19) = 18050
        expect(data.totalTva).toBe(18050);
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(dtoWithRemise, 'user-1');
      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should reject create when products do not exist', async () => {
      prisma.productPf.findMany.mockResolvedValue([{ id: 1 }]); // Only product 1 exists

      const dtoWithMissing = {
        ...baseCreateDto,
        lines: [
          { productPfId: 1, quantity: 5, unitPriceHt: 10000 },
          { productPfId: 99, quantity: 3, unitPriceHt: 20000 },
        ],
      };

      await expect(
        service.create(dtoWithMissing, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(dtoWithMissing, 'user-1'),
      ).rejects.toThrow('Produits introuvables');
    });

    it('should use $transaction for creating invoice with lines', async () => {
      await service.create(baseCreateDto, 'user-1');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW TESTS — update() : recalculations detaillees
  // ═══════════════════════════════════════════════════════════════════════════

  describe('update() — recalculation details', () => {
    it('should recalculate TVA at 19% when lines change', async () => {
      const invoice = mockInvoice();
      prisma.invoice.findUnique.mockResolvedValue(invoice);
      prisma.invoiceLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.invoice.update.mockImplementation(async ({ data }: any) => {
        // New lines: qty 5 * price 30000 = 150000 HT
        expect(data.totalHt).toBe(150000);
        expect(data.totalTva).toBe(28500); // 150000 * 0.19 = 28500
        expect(data.totalTtc).toBe(178500); // 150000 + 28500
        return { ...invoice, ...data };
      });

      await service.update(
        1,
        {
          lines: [{ productPfId: 2, quantity: 5, unitPriceHt: 30000 }],
        },
        'user1',
      );

      expect(prisma.invoice.update).toHaveBeenCalled();
    });

    it('should recalculate timbre when lines change AND paymentMethod is ESPECES', async () => {
      const invoice = mockInvoice({ paymentMethod: 'ESPECES' });
      prisma.invoice.findUnique.mockResolvedValue(invoice);
      prisma.invoiceLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.invoice.update.mockImplementation(async ({ data }: any) => {
        // New lines: qty 20 * 10000 = 200000 HT
        // TVA: 200000 * 0.19 = 38000
        // TTC: 238000 centimes = 2380 DA <= 30000 DA => 1% rate
        // timbreFiscal = Math.round(238000 * 0.01) = 2380
        expect(data.timbreFiscal).toBe(2380);
        expect(data.timbreRate).toBe(0.01);
        expect(data.netToPay).toBe(data.totalTtc + 2380);
        return { ...invoice, ...data };
      });

      await service.update(
        1,
        {
          lines: [{ productPfId: 1, quantity: 20, unitPriceHt: 10000 }],
        },
        'user1',
      );

      expect(prisma.invoice.update).toHaveBeenCalled();
    });

    it('should set timbre=0 when lines change AND paymentMethod is VIREMENT', async () => {
      const invoice = mockInvoice({ paymentMethod: 'VIREMENT', timbreFiscal: 0 });
      prisma.invoice.findUnique.mockResolvedValue(invoice);
      prisma.invoiceLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.invoice.update.mockImplementation(async ({ data }: any) => {
        expect(data.timbreFiscal).toBe(0);
        expect(data.netToPay).toBe(data.totalTtc);
        return { ...invoice, ...data };
      });

      await service.update(
        1,
        {
          lines: [{ productPfId: 1, quantity: 5, unitPriceHt: 20000 }],
        },
        'user1',
      );

      expect(prisma.invoice.update).toHaveBeenCalled();
    });

    it('should recalculate netToPay when paymentMethod changes from VIREMENT to ESPECES', async () => {
      // totalTtc = 119000 centimes = 1190 DA <= 30000 DA => 1% rate
      // timbreFiscal = Math.round(119000 * 0.01) = 1190
      const invoice = mockInvoice({
        paymentMethod: 'VIREMENT',
        timbreFiscal: 0,
        timbreRate: 0,
        totalTtc: 119000,
        netToPay: 119000,
      });
      prisma.invoice.findUnique.mockResolvedValue(invoice);
      prisma.invoice.update.mockResolvedValue({
        ...invoice,
        paymentMethod: 'ESPECES',
        timbreFiscal: 1190,
        timbreRate: 0.01,
        netToPay: 120190,
      });

      await service.update(1, { paymentMethod: PaymentMethodDto.ESPECES }, 'user1');

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timbreFiscal: 1190,
            timbreRate: 0.01,
            netToPay: 120190,
          }),
        }),
      );
    });

    it('should handle update with both new lines and new paymentMethod simultaneously', async () => {
      const invoice = mockInvoice({ paymentMethod: 'ESPECES' });
      prisma.invoice.findUnique.mockResolvedValue(invoice);
      prisma.invoiceLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.invoice.update.mockImplementation(async ({ data }: any) => {
        // Lines: qty 10 * 5000 = 50000 HT
        expect(data.totalHt).toBe(50000);
        expect(data.totalTva).toBe(9500); // 50000 * 0.19
        expect(data.totalTtc).toBe(59500);
        // VIREMENT => no timbre
        expect(data.timbreFiscal).toBe(0);
        expect(data.netToPay).toBe(59500);
        return { ...invoice, ...data };
      });

      await service.update(
        1,
        {
          paymentMethod: PaymentMethodDto.VIREMENT,
          lines: [{ productPfId: 1, quantity: 10, unitPriceHt: 5000 }],
        },
        'user1',
      );

      expect(prisma.invoice.update).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW TESTS — updateStatus() : extended transitions
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateStatus() — extended', () => {
    it('should reject DRAFT → VALIDATED when client NIF is null', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ nif: null }));

      await expect(
        service.updateStatus(1, { status: 'VALIDATED' as any }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus(1, { status: 'VALIDATED' as any }),
      ).rejects.toThrow('NIF');
    });

    it('should reject DRAFT → VALIDATED when client NIF is whitespace-only', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ nif: '   ' }));

      await expect(
        service.updateStatus(1, { status: 'VALIDATED' as any }),
      ).rejects.toThrow('NIF');
    });

    it('should reject CANCELLED → CANCELLED', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: 'CANCELLED' }));

      await expect(
        service.updateStatus(1, { status: 'CANCELLED' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should store cancellation tracking data when transitioning to CANCELLED', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.invoice.update.mockResolvedValue(mockInvoice({ status: 'CANCELLED' }));

      await service.updateStatus(
        1,
        { status: 'CANCELLED' as any, cancellationReason: 'Erreur de saisie' },
        'user-admin',
      );

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancellationReason: 'Erreur de saisie',
            cancelledBy: 'user-admin',
            cancelledAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent invoice when updating status', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(999, { status: 'PAID' as any }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include the client name in the error message when fiscal fields are missing', async () => {
      const clientName = 'Societe SARL El Baraka';
      prisma.invoice.findUnique.mockResolvedValue(
        mockInvoice({ client: { id: 10, code: 'CLI002', name: clientName } }),
      );
      prisma.client.findUnique.mockResolvedValue(
        mockClient({ name: clientName, nif: '' }),
      );

      try {
        await service.updateStatus(1, { status: 'VALIDATED' as any });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain(clientName);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW TESTS — findAll() and findOne()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('findAll()', () => {
    it('should return all invoices when no filters are provided', async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice(), mockInvoice({ id: 2 })]);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { date: 'desc' },
        }),
      );
    });

    it('should filter invoices by status', async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice({ status: 'PAID' })]);

      await service.findAll('PAID');
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PAID' },
        }),
      );
    });

    it('should filter invoices by clientId', async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice()]);

      await service.findAll(undefined, 10);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: 10 },
        }),
      );
    });

    it('should filter invoices by both status and clientId', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.findAll('DRAFT', 10);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'DRAFT', clientId: 10 },
        }),
      );
    });
  });

  describe('findOne()', () => {
    it('should return an invoice by id with all related data', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());

      const result = await service.findOne(1);
      expect(result.id).toBe(1);
      expect(result.reference).toBe(`F-${new Date().getFullYear()}-00001`);
      expect(prisma.invoice.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          include: expect.objectContaining({
            client: true,
            lines: expect.any(Object),
          }),
        }),
      );
    });

    it('should throw NotFoundException when invoice does not exist', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow('introuvable');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES — TVA rounding, large invoices, null fiscal fields
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge cases', () => {
    const currentYear = new Date().getFullYear();

    it('should round TVA to nearest centime (Math.round)', async () => {
      // Create a scenario where TVA produces a decimal
      // e.g., totalHt = 100001, TVA = 100001 * 0.19 = 19000.19 → rounded to 19000
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.client.findUnique.mockResolvedValue(mockClient());
      prisma.productPf.findMany.mockResolvedValue([{ id: 1 }]);
      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        // qty=1, unitPriceHt=100001 => totalHt=100001
        // TVA = Math.round(100001 * 0.19) = Math.round(19000.19) = 19000
        expect(data.totalTva).toBe(Math.round(100001 * 0.19));
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(
        {
          clientId: 10,
          date: '2025-02-25',
          paymentMethod: PaymentMethodDto.ESPECES,
          lines: [{ productPfId: 1, quantity: 1, unitPriceHt: 100001 }],
        },
        'user-1',
      );

      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should handle large invoice amounts correctly with 2% timbre rate (>100k DA)', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.client.findUnique.mockResolvedValue(mockClient());
      prisma.productPf.findMany.mockResolvedValue([{ id: 1 }]);
      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        // qty=100, unitPriceHt=200000 (2000 DA) => totalHt=20000000 (200,000 DA)
        expect(data.totalHt).toBe(20000000);
        expect(data.totalTva).toBe(3800000); // 20000000 * 0.19
        expect(data.totalTtc).toBe(23800000);
        // 23800000 centimes = 238000 DA > 100000 DA => 2% rate
        // timbreFiscal = Math.round(23800000 * 0.02) = 476000
        expect(data.timbreFiscal).toBe(476000);
        expect(data.timbreRate).toBe(0.02);
        expect(data.netToPay).toBe(24276000);
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(
        {
          clientId: 10,
          date: '2025-02-25',
          paymentMethod: PaymentMethodDto.ESPECES,
          lines: [{ productPfId: 1, quantity: 100, unitPriceHt: 200000 }],
        },
        'user-1',
      );

      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should apply 1.5% timbre rate for medium invoices (30k-100k DA)', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.client.findUnique.mockResolvedValue(mockClient());
      prisma.productPf.findMany.mockResolvedValue([{ id: 1 }]);
      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        // qty=50, unitPriceHt=100000 (1000 DA) => totalHt=5000000 (50,000 DA)
        // TVA: 5000000 * 0.19 = 950000
        // TTC: 5950000 centimes = 59500 DA => 30000 < 59500 <= 100000 => 1.5%
        expect(data.timbreFiscal).toBe(Math.round(5950000 * 0.015));
        expect(data.timbreRate).toBe(0.015);
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(
        {
          clientId: 10,
          date: '2025-02-25',
          paymentMethod: PaymentMethodDto.ESPECES,
          lines: [{ productPfId: 1, quantity: 50, unitPriceHt: 100000 }],
        },
        'user-1',
      );

      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should handle invoice with single item of unit price = 0 (free items — no timbre)', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.client.findUnique.mockResolvedValue(mockClient());
      prisma.productPf.findMany.mockResolvedValue([{ id: 1 }]);
      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        expect(data.totalHt).toBe(0);
        expect(data.totalTva).toBe(0);
        expect(data.totalTtc).toBe(0);
        // totalTtc <= 0 => no timbre fiscal even for ESPECES
        expect(data.timbreFiscal).toBe(0);
        expect(data.netToPay).toBe(0);
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(
        {
          clientId: 10,
          date: '2025-02-25',
          paymentMethod: PaymentMethodDto.ESPECES,
          lines: [{ productPfId: 1, quantity: 1, unitPriceHt: 0 }],
        },
        'user-1',
      );

      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should not apply timbre when payment is VIREMENT even with large amount', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.client.findUnique.mockResolvedValue(mockClient());
      prisma.productPf.findMany.mockResolvedValue([{ id: 1 }]);
      prisma.invoice.create.mockImplementation(async ({ data }: any) => {
        expect(data.timbreFiscal).toBe(0);
        expect(data.timbreRate).toBe(0);
        expect(data.netToPay).toBe(data.totalTtc);
        return {
          id: 1,
          reference: `F-${currentYear}-00001`,
          ...data,
          client: { code: 'CLI001', name: 'Test Client' },
          lines: [],
        };
      });

      await service.create(
        {
          clientId: 10,
          date: '2025-02-25',
          paymentMethod: PaymentMethodDto.VIREMENT,
          lines: [{ productPfId: 1, quantity: 500, unitPriceHt: 100000 }],
        },
        'user-1',
      );

      expect(prisma.invoice.create).toHaveBeenCalled();
    });

    it('should reject DRAFT → VALIDATED when client RC is null (not just empty string)', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ rc: null }));

      await expect(
        service.updateStatus(1, { status: 'VALIDATED' as any }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus(1, { status: 'VALIDATED' as any }),
      ).rejects.toThrow('RC');
    });

    it('should reject DRAFT → VALIDATED when client AI is null (not just empty string)', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ ai: null }));

      await expect(
        service.updateStatus(1, { status: 'VALIDATED' as any }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus(1, { status: 'VALIDATED' as any }),
      ).rejects.toThrow('AI');
    });

    it('should allow DRAFT → VALIDATED when fiscal fields have valid non-empty values', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({
        nif: '000099901234567',
        rc: '16B9999999',
        ai: 'AI99999999',
      }));
      prisma.invoice.update.mockResolvedValue(mockInvoice({ status: 'VALIDATED' }));

      const result = await service.updateStatus(1, { status: 'VALIDATED' as any });
      expect(result.status).toBe('VALIDATED');
    });
  });
});
