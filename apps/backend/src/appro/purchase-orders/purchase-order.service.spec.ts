/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PURCHASE ORDER SERVICE — Unit Tests
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Tests OBLIGATOIRES selon les règles métier:
 * - Génération BC depuis Demande VALIDÉE uniquement
 * - Split automatique par fournisseur
 * - Interdiction de générer BC sur Demande non validée
 * - Mise à jour du stock à la réception
 * - Transitions d'état correctes
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrderService } from './purchase-order.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DemandeApproStatus, PurchaseOrderStatus } from '@prisma/client';
import { SendVia } from './dto/send-bc.dto';

describe('PurchaseOrderService', () => {
  let service: PurchaseOrderService;
  let prisma: PrismaService;

  // Mock data
  const mockUserId = 'user-uuid-123';
  
  const mockSupplier1 = {
    id: 1,
    code: 'FOUR-001',
    name: 'Fournisseur Lait',
  };

  const mockSupplier2 = {
    id: 2,
    code: 'FOUR-002',
    name: 'Fournisseur Emballage',
  };

  const mockProductMp1 = {
    id: 1,
    code: 'MP-001',
    name: 'Lait cru',
    unit: 'L',
    defaultTvaRate: 19,
    fournisseurPrincipalId: 1,
    fournisseurPrincipal: mockSupplier1,
  };

  const mockProductMp2 = {
    id: 2,
    code: 'MP-002',
    name: 'Seaux IML',
    unit: 'unité',
    defaultTvaRate: 19,
    fournisseurPrincipalId: 2,
    fournisseurPrincipal: mockSupplier2,
  };

  const mockValidatedDemand = {
    id: 1,
    reference: 'REQ-MP-2025-001',
    status: DemandeApproStatus.VALIDEE,
    priority: 'NORMALE',
    createdById: mockUserId,
    lignes: [
      {
        id: 1,
        productMpId: 1,
        productMp: mockProductMp1,
        quantiteDemandee: 1000,
        quantiteValidee: 1000,
      },
      {
        id: 2,
        productMpId: 2,
        productMp: mockProductMp2,
        quantiteDemandee: 500,
        quantiteValidee: 500,
      },
    ],
    purchaseOrders: [],
  };

  const mockNonValidatedDemand = {
    ...mockValidatedDemand,
    id: 2,
    reference: 'REQ-MP-2025-002',
    status: DemandeApproStatus.ENVOYEE,
  };

  const mockDemandWithExistingBC = {
    ...mockValidatedDemand,
    id: 3,
    reference: 'REQ-MP-2025-003',
    purchaseOrders: [{ id: 'bc-uuid-1', reference: 'BC-2025-00001' }],
  };

  const mockPurchaseOrderDraft = {
    id: 'po-uuid-1',
    reference: 'BC-2025-00001',
    supplierId: 1,
    supplier: mockSupplier1,
    linkedDemandId: 1,
    status: PurchaseOrderStatus.DRAFT,
    totalHT: 5000,
    items: [
      {
        id: 'item-uuid-1',
        productMpId: 1,
        productMp: mockProductMp1,
        quantity: 1000,
        quantityReceived: 0,
        unitPrice: 5,
        totalHT: 5000,
        tvaRate: 19,
      },
    ],
  };

  const mockPurchaseOrderSent = {
    ...mockPurchaseOrderDraft,
    status: PurchaseOrderStatus.SENT,
    sentAt: new Date(),
    sentById: mockUserId,
  };

  // Mock Prisma
  const mockPrismaService: any = {
    demandeApprovisionnementMp: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    purchaseOrder: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    purchaseOrderItem: {
      update: jest.fn(),
    },
    supplier: {
      findUnique: jest.fn(),
    },
    receptionMpLine: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    receptionMp: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    lotMp: {
      create: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PurchaseOrderService>(PurchaseOrderService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('generateFromDemand', () => {
    it('should generate BC from validated demand', async () => {
      // Arrange
      mockPrismaService.demandeApprovisionnementMp.findUnique.mockResolvedValue(
        mockValidatedDemand,
      );
      mockPrismaService.supplier.findUnique
        .mockResolvedValueOnce(mockSupplier1)
        .mockResolvedValueOnce(mockSupplier2);
      mockPrismaService.purchaseOrder.findFirst.mockResolvedValue(null);
      mockPrismaService.purchaseOrder.create.mockResolvedValue({
        id: 'new-po-uuid',
        reference: 'BC-2025-00001',
      });
      mockPrismaService.receptionMpLine.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.generateFromDemand(1, {}, mockUserId);

      // Assert
      expect(result.count).toBe(2); // Split par fournisseur (2 fournisseurs)
      expect(result.purchaseOrders).toHaveLength(2);
      expect(result.message).toContain('BC générés');
    });

    it('should split BC by supplier automatically', async () => {
      // Arrange
      mockPrismaService.demandeApprovisionnementMp.findUnique.mockResolvedValue(
        mockValidatedDemand,
      );
      mockPrismaService.supplier.findUnique
        .mockResolvedValueOnce(mockSupplier1)
        .mockResolvedValueOnce(mockSupplier2);
      mockPrismaService.purchaseOrder.findFirst.mockResolvedValue(null);
      mockPrismaService.purchaseOrder.create
        .mockResolvedValueOnce({ id: 'po-1', reference: 'BC-2025-00001' })
        .mockResolvedValueOnce({ id: 'po-2', reference: 'BC-2025-00002' });
      mockPrismaService.receptionMpLine.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.generateFromDemand(1, {}, mockUserId);

      // Assert
      expect(result.count).toBe(2);
      expect(mockPrismaService.purchaseOrder.create).toHaveBeenCalledTimes(2);
    });

    it('should forbid BC generation on non-validated demand', async () => {
      // Arrange
      mockPrismaService.demandeApprovisionnementMp.findUnique.mockResolvedValue(
        mockNonValidatedDemand,
      );

      // Act & Assert
      await expect(
        service.generateFromDemand(2, {}, mockUserId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateFromDemand(2, {}, mockUserId),
      ).rejects.toThrow('la demande doit être VALIDÉE');
    });

    it('should forbid BC generation if BC already exists', async () => {
      // Arrange
      mockPrismaService.demandeApprovisionnementMp.findUnique.mockResolvedValue(
        mockDemandWithExistingBC,
      );

      // Act & Assert
      await expect(
        service.generateFromDemand(3, {}, mockUserId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateFromDemand(3, {}, mockUserId),
      ).rejects.toThrow('déjà été générés');
    });

    it('should throw NotFoundException for unknown demand', async () => {
      // Arrange
      mockPrismaService.demandeApprovisionnementMp.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.generateFromDemand(999, {}, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use price overrides when provided', async () => {
      // Arrange
      const singleSupplierDemand = {
        ...mockValidatedDemand,
        lignes: [mockValidatedDemand.lignes[0]], // Only one line with supplier 1
      };
      mockPrismaService.demandeApprovisionnementMp.findUnique.mockResolvedValue(
        singleSupplierDemand,
      );
      mockPrismaService.supplier.findUnique.mockResolvedValue(mockSupplier1);
      mockPrismaService.purchaseOrder.findFirst.mockResolvedValue(null);
      mockPrismaService.purchaseOrder.create.mockResolvedValue({
        id: 'new-po',
        reference: 'BC-2025-00001',
      });

      // Act
      await service.generateFromDemand(
        1,
        { priceOverrides: [{ productMpId: 1, unitPrice: 10 }] },
        mockUserId,
      );

      // Assert
      expect(mockPrismaService.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ unitPrice: 10 }),
              ]),
            }),
          }),
        }),
      );
    });
  });

  describe('sendPurchaseOrder', () => {
    it('should transition DRAFT to SENT', async () => {
      // Arrange
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(
        mockPurchaseOrderDraft,
      );
      mockPrismaService.purchaseOrder.update.mockResolvedValue({
        ...mockPurchaseOrderDraft,
        status: PurchaseOrderStatus.SENT,
        sentAt: new Date(),
        sentById: mockUserId,
      });

      // Act
      const result = await service.sendPurchaseOrder(
        'po-uuid-1',
        { sendVia: SendVia.MANUAL, proofNote: 'Envoyé par fax au 021 XX XX XX' },
        mockUserId,
      );

      // Assert
      expect(result.status).toBe(PurchaseOrderStatus.SENT);
    });

    it('should reject send on non-DRAFT status', async () => {
      // Arrange
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(
        mockPurchaseOrderSent,
      );

      // Act & Assert
      await expect(
        service.sendPurchaseOrder('po-uuid-1', { sendVia: SendVia.EMAIL, supplierEmail: 'test@test.com' }, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmPurchaseOrder', () => {
    it('should transition SENT to CONFIRMED', async () => {
      // Arrange
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(
        mockPurchaseOrderSent,
      );
      mockPrismaService.purchaseOrder.update.mockResolvedValue({
        ...mockPurchaseOrderSent,
        status: PurchaseOrderStatus.CONFIRMED,
        confirmedAt: new Date(),
        confirmedById: mockUserId,
      });

      // Act
      const result = await service.confirmPurchaseOrder('po-uuid-1', mockUserId);

      // Assert
      expect(result.status).toBe(PurchaseOrderStatus.CONFIRMED);
    });

    it('should reject confirm on non-SENT status', async () => {
      // Arrange
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(
        mockPurchaseOrderDraft,
      );

      // Act & Assert
      await expect(
        service.confirmPurchaseOrder('po-uuid-1', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('receivePurchaseOrder', () => {
    const mockPurchaseOrderConfirmed = {
      ...mockPurchaseOrderSent,
      status: PurchaseOrderStatus.CONFIRMED,
      linkedDemand: {
        id: 1,
        purchaseOrders: [{ id: 'po-uuid-1', status: PurchaseOrderStatus.CONFIRMED }],
      },
    };

    it('should update stock on receive', async () => {
      // Arrange
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(
        mockPurchaseOrderConfirmed,
      );
      mockPrismaService.receptionMp.findFirst.mockResolvedValue(null);
      mockPrismaService.receptionMp.create.mockResolvedValue({
        id: 1,
        reference: 'REC-20250108-001',
      });
      mockPrismaService.lotMp.create.mockResolvedValue({ id: 1 });
      mockPrismaService.stockMovement.create.mockResolvedValue({ id: 1 });
      mockPrismaService.purchaseOrder.update.mockResolvedValue({
        ...mockPurchaseOrderConfirmed,
        status: PurchaseOrderStatus.RECEIVED,
      });
      mockPrismaService.demandeApprovisionnementMp.update.mockResolvedValue({});

      // Act
      const result = await service.receivePurchaseOrder(
        'po-uuid-1',
        {
          lines: [
            { itemId: 'item-uuid-1', quantityReceived: 1000 },
          ],
        },
        mockUserId,
      );

      // Assert
      expect(result.stockMovementsCreated).toBe(1);
      expect(mockPrismaService.stockMovement.create).toHaveBeenCalled();
      expect(mockPrismaService.lotMp.create).toHaveBeenCalled();
    });

    it('should set PARTIAL status for partial reception', async () => {
      // Arrange
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(
        mockPurchaseOrderConfirmed,
      );
      mockPrismaService.receptionMp.findFirst.mockResolvedValue(null);
      mockPrismaService.receptionMp.create.mockResolvedValue({
        id: 1,
        reference: 'REC-20250108-001',
      });
      mockPrismaService.lotMp.create.mockResolvedValue({ id: 1 });
      mockPrismaService.stockMovement.create.mockResolvedValue({ id: 1 });
      mockPrismaService.purchaseOrder.update.mockResolvedValue({
        ...mockPurchaseOrderConfirmed,
        status: PurchaseOrderStatus.PARTIAL,
      });

      // Act
      const result = await service.receivePurchaseOrder(
        'po-uuid-1',
        {
          lines: [
            { itemId: 'item-uuid-1', quantityReceived: 500 }, // Partial
          ],
        },
        mockUserId,
      );

      // Assert
      expect(result.status).toBe(PurchaseOrderStatus.PARTIAL);
    });

    it('should close linked demand when all BC received', async () => {
      // Arrange
      const singleBcDemand = {
        ...mockPurchaseOrderConfirmed,
        linkedDemand: {
          id: 1,
          purchaseOrders: [mockPurchaseOrderConfirmed],
        },
      };
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(singleBcDemand);
      mockPrismaService.receptionMp.findFirst.mockResolvedValue(null);
      mockPrismaService.receptionMp.create.mockResolvedValue({
        id: 1,
        reference: 'REC-20250108-001',
      });
      mockPrismaService.lotMp.create.mockResolvedValue({ id: 1 });
      mockPrismaService.stockMovement.create.mockResolvedValue({ id: 1 });
      mockPrismaService.purchaseOrder.update.mockResolvedValue({
        ...singleBcDemand,
        status: PurchaseOrderStatus.RECEIVED,
      });
      mockPrismaService.demandeApprovisionnementMp.update.mockResolvedValue({});

      // Act
      const result = await service.receivePurchaseOrder(
        'po-uuid-1',
        {
          lines: [
            { itemId: 'item-uuid-1', quantityReceived: 1000 },
          ],
        },
        mockUserId,
      );

      // Assert
      expect(result.demandClosed).toBe(true);
      expect(mockPrismaService.demandeApprovisionnementMp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DemandeApproStatus.TRANSFORMEE,
          }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('should return BC with all relations', async () => {
      // Arrange
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(
        mockPurchaseOrderDraft,
      );

      // Act
      const result = await service.getById('po-uuid-1');

      // Assert
      expect(result).toEqual(mockPurchaseOrderDraft);
      expect(mockPrismaService.purchaseOrder.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-uuid-1' },
          include: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException for unknown BC', async () => {
      // Arrange
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getById('unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
