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
//   4. updateStatus() — fiscal validation on DRAFT → PAID
//   5. updateStatus() — CANCELLED bypasses fiscal validation
// ═══════════════════════════════════════════════════════════════════════════════

const mockInvoice = (overrides: Partial<any> = {}) => ({
  id: 1,
  reference: 'F-250225-001',
  status: 'DRAFT',
  clientId: 10,
  paymentMethod: 'ESPECES',
  date: new Date('2025-02-25'),
  totalHt: 100000,
  totalTva: 19000,
  totalTtc: 119000,
  timbreFiscal: 5000,
  netToPay: 124000,
  client: { id: 10, code: 'CLI001', name: 'Test Client' },
  lines: [
    { productPfId: 1, quantity: 10, unitPriceHt: 10000, lineHt: 100000 },
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
        update: jest.fn(),
      },
      invoiceLine: {
        deleteMany: jest.fn(),
      },
      client: {
        findUnique: jest.fn(),
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

      const result = await service.update(
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
      const invoice = mockInvoice({ paymentMethod: 'ESPECES', timbreFiscal: 5000 });
      prisma.invoice.findUnique.mockResolvedValue(invoice);
      prisma.invoice.update.mockResolvedValue({
        ...invoice,
        paymentMethod: 'VIREMENT',
        timbreFiscal: 0,
        netToPay: 119000,
      });

      await service.update(1, { paymentMethod: PaymentMethodDto.VIREMENT }, 'user1');

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timbreFiscal: 0,
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
    it('should allow DRAFT → PAID when client has complete fiscal data', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient());
      prisma.invoice.update.mockResolvedValue(mockInvoice({ status: 'PAID' }));

      const result = await service.updateStatus(1, { status: 'PAID' as any });
      expect(result.status).toBe('PAID');
    });

    it('should reject DRAFT → PAID when client NIF is missing', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ nif: '' }));

      await expect(
        service.updateStatus(1, { status: 'PAID' as any }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus(1, { status: 'PAID' as any }),
      ).rejects.toThrow('NIF');
    });

    it('should reject DRAFT → PAID when client RC is missing', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ rc: '' }));

      await expect(
        service.updateStatus(1, { status: 'PAID' as any }),
      ).rejects.toThrow('RC');
    });

    it('should reject DRAFT → PAID when client AI is missing', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ ai: '' }));

      await expect(
        service.updateStatus(1, { status: 'PAID' as any }),
      ).rejects.toThrow("AI");
    });

    it('should reject DRAFT → PAID with message listing all missing fields', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.client.findUnique.mockResolvedValue(mockClient({ nif: '', rc: '', ai: '' }));

      try {
        await service.updateStatus(1, { status: 'PAID' as any });
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toContain('NIF');
        expect(err.message).toContain('RC');
        expect(err.message).toContain('AI');
        expect(err.message).toContain('Test Client');
      }
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

    it('should reject modification of already CANCELLED invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: 'CANCELLED' }));

      await expect(
        service.updateStatus(1, { status: 'PAID' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject PAID → DRAFT rollback', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: 'PAID' }));

      await expect(
        service.updateStatus(1, { status: 'DRAFT' as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
