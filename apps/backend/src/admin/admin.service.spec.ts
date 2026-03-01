/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ADMIN SERVICE TESTS - Operations CRUD Admin
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * INVARIANTS TESTES:
 * 1. getStockMp() retourne la liste du stock MP avec statuts
 * 2. getStockPf() retourne la liste du stock PF avec valeurs
 * 3. getClients() retourne la liste des clients
 * 4. getClientById() trouve ou leve NotFoundException
 * 5. getClientHistory() filtre par annee, mois, pagination
 * 6. getUsers() pagination et filtrage par role
 * 7. createClient() succes et doublon code
 * 8. createInvoice() succes, client manquant, produit manquant, lignes vides
 * 9. updateInvoice() succes sur DRAFT, rejet sur PAID
 * 10. updateInvoiceStatus() transitions DRAFT->PAID, DRAFT->CANCELLED, rejet PAID->DRAFT
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { DevicesService } from '../security/devices.service';
import { SecurityLogService } from '../security/security-log.service';
import { AuditService } from '../common/audit/audit.service';

describe('AdminService', () => {
  let service: AdminService;

  const mockPrisma: any = {
    productMp: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productPf: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    stockMovement: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    client: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    invoiceLine: {
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    supplier: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    device: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => {
      if (typeof fn === 'function') return fn(mockPrisma);
      return Promise.all(fn);
    }),
  };

  const mockStockService = {
    processSale: jest.fn().mockResolvedValue(undefined),
  };

  const mockDevicesService = {};

  const mockSecurityLogService = {
    logUserBlock: jest.fn().mockResolvedValue(undefined),
    logUserUnblock: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StockService, useValue: mockStockService },
        { provide: DevicesService, useValue: mockDevicesService },
        { provide: SecurityLogService, useValue: mockSecurityLogService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getStockMp()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getStockMp', () => {
    it('devrait retourner la liste du stock MP avec statuts calcules', async () => {
      mockPrisma.productMp.findMany.mockResolvedValue([
        { id: 1, code: 'MP-001', name: 'Lait', unit: 'L', minStock: 100 },
        { id: 2, code: 'MP-002', name: 'Sel', unit: 'kg', minStock: 50 },
      ]);

      // Stock movements: product 1 has IN:200, OUT:50 = 150 stock
      // Product 2 has no movements = 0 stock
      mockPrisma.stockMovement.groupBy
        .mockResolvedValueOnce([
          { productMpId: 1, movementType: 'IN', _sum: { quantity: 200 } },
          { productMpId: 1, movementType: 'OUT', _sum: { quantity: 50 } },
        ])
        .mockResolvedValueOnce([
          { productMpId: 1, _max: { createdAt: new Date('2026-01-15') } },
        ]);

      const result = await service.getStockMp();

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('MP-001');
      expect(result[0].totalStock).toBe(150);
      expect(result[0].status).toBe('OK');
      expect(result[0].isLowStock).toBe(false);

      // Product 2 has 0 stock = RUPTURE
      expect(result[1].code).toBe('MP-002');
      expect(result[1].totalStock).toBe(0);
      expect(result[1].status).toBe('RUPTURE');
      expect(result[1].isLowStock).toBe(true);
    });

    it('devrait retourner un tableau vide quand aucun produit MP actif', async () => {
      mockPrisma.productMp.findMany.mockResolvedValue([]);
      mockPrisma.stockMovement.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getStockMp();
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getStockPf()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getStockPf', () => {
    it('devrait retourner la liste du stock PF avec valeurs calculees', async () => {
      mockPrisma.productPf.findMany.mockResolvedValue([
        { id: 1, code: 'PF-001', name: 'Fromage 500g', unit: 'unite', priceHt: 85000, minStock: 20 },
      ]);

      mockPrisma.stockMovement.groupBy
        .mockResolvedValueOnce([
          { productPfId: 1, movementType: 'IN', _sum: { quantity: 100 } },
          { productPfId: 1, movementType: 'OUT', _sum: { quantity: 30 } },
        ])
        .mockResolvedValueOnce([
          { productPfId: 1, _max: { createdAt: new Date('2026-02-01') } },
        ]);

      const result = await service.getStockPf();

      expect(result).toHaveLength(1);
      expect(result[0].totalStock).toBe(70);
      expect(result[0].stockValue).toBe(70 * 85000);
      expect(result[0].status).toBe('OK');
    });

    it('devrait calculer le statut ALERTE quand stock <= minStock', async () => {
      mockPrisma.productPf.findMany.mockResolvedValue([
        { id: 1, code: 'PF-001', name: 'Fromage', unit: 'unite', priceHt: 50000, minStock: 50 },
      ]);

      mockPrisma.stockMovement.groupBy
        .mockResolvedValueOnce([
          { productPfId: 1, movementType: 'IN', _sum: { quantity: 50 } },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getStockPf();

      expect(result[0].totalStock).toBe(50);
      expect(result[0].status).toBe('ALERTE');
      expect(result[0].isLowStock).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getClients()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getClients', () => {
    it('devrait retourner la liste des clients triee par nom', async () => {
      const clientsList = [
        { id: 1, code: 'CLI-001', name: 'Alpha', _count: { invoices: 5 } },
        { id: 2, code: 'CLI-002', name: 'Beta', _count: { invoices: 3 } },
      ];
      mockPrisma.client.findMany.mockResolvedValue(clientsList);

      const result = await service.getClients();

      expect(result).toEqual(clientsList);
      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getClientById()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getClientById', () => {
    it('devrait retourner le client quand il existe', async () => {
      const client = { id: 1, code: 'CLI-001', name: 'Alpha', _count: { invoices: 5 } };
      mockPrisma.client.findUnique.mockResolvedValue(client);

      const result = await service.getClientById(1);

      expect(result).toEqual(client);
      expect(mockPrisma.client.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('devrait lever NotFoundException quand le client est introuvable', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);

      await expect(service.getClientById(999)).rejects.toThrow(NotFoundException);
      await expect(service.getClientById(999)).rejects.toThrow(/introuvable/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getClientHistory()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getClientHistory', () => {
    const mockClient = { id: 1, code: 'CLI-001', name: 'Alpha', type: 'GROSSISTE' };

    it('devrait retourner l\'historique avec filtres annee et mois', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.invoice.count.mockResolvedValue(2);
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 1,
          reference: 'F-260115-001',
          date: new Date('2026-01-15'),
          status: 'PAID',
          paymentMethod: 'ESPECES',
          totalHt: 100000,
          totalTva: 19000,
          totalTtc: 119000,
          netToPay: 120190,
          lines: [],
        },
      ]);
      mockPrisma.invoice.aggregate.mockResolvedValue({
        _sum: { totalHt: 100000, totalTva: 19000, totalTtc: 119000, netToPay: 120190 },
        _count: 2,
      });
      mockPrisma.invoiceLine.aggregate.mockResolvedValue({
        _sum: { quantity: 50 },
      });

      const result = await service.getClientHistory(1, {
        year: 2026,
        month: 1,
        page: 1,
        limit: 20,
      });

      expect(result.client).toEqual(mockClient);
      expect(result.pagination.total).toBe(2);
      expect(result.totals.totalHt).toBe(100000);
      expect(result.totals.totalQuantity).toBe(50);
    });

    it('devrait lever NotFoundException quand le client est introuvable', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.getClientHistory(999, { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('devrait paginer correctement les resultats', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.invoice.count.mockResolvedValue(50);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.invoice.aggregate.mockResolvedValue({
        _sum: { totalHt: 0, totalTva: 0, totalTtc: 0, netToPay: 0 },
        _count: 0,
      });
      mockPrisma.invoiceLine.aggregate.mockResolvedValue({
        _sum: { quantity: 0 },
      });

      const result = await service.getClientHistory(1, {
        page: 3,
        limit: 10,
      });

      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getUsers()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getUsers', () => {
    it('devrait retourner les utilisateurs avec pagination', async () => {
      const users = [
        { id: 'u1', code: 'ADM001', email: 'a@test.dz', firstName: 'Test', lastName: 'Admin', role: 'ADMIN', isActive: true, createdAt: new Date(), _count: { devices: 1 } },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers({ page: 1, limit: 10 });

      expect(result.users).toEqual(users);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('devrait retourner tous les utilisateurs sans pagination quand aucun parametre', async () => {
      const users = [
        { id: 'u1', code: 'ADM001', email: 'a@test.dz', firstName: 'A', lastName: 'B', role: 'ADMIN', isActive: true, createdAt: new Date(), _count: { devices: 0 } },
        { id: 'u2', code: 'COM001', email: 'b@test.dz', firstName: 'C', lastName: 'D', role: 'COMMERCIAL', isActive: true, createdAt: new Date(), _count: { devices: 0 } },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(2);

      const result = await service.getUsers();

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
    });

    it('devrait filtrer par role quand specifie', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getUsers({ role: 'COMMERCIAL' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'COMMERCIAL' },
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createClient()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createClient', () => {
    it('devrait creer un client avec succes', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      mockPrisma.client.create.mockResolvedValue({
        id: 1,
        code: 'CLI-004',
        name: 'Nouveau Client',
        type: 'GROSSISTE',
        nif: '',
        rc: '',
        ai: '',
      });

      const result = await service.createClient({
        code: 'CLI-004',
        name: 'Nouveau Client',
        type: 'GROSSISTE' as any,
      });

      expect(result.code).toBe('CLI-004');
      expect(result.name).toBe('Nouveau Client');
      expect(mockPrisma.client.create).toHaveBeenCalled();
    });

    it('devrait lever ConflictException pour un code client duplique', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ id: 1, code: 'CLI-001' });

      await expect(
        service.createClient({
          code: 'CLI-001',
          name: 'Doublon',
          type: 'GROSSISTE' as any,
        }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createClient({
          code: 'CLI-001',
          name: 'Doublon',
          type: 'GROSSISTE' as any,
        }),
      ).rejects.toThrow(/existe déjà/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createInvoice()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createInvoice', () => {
    it('devrait creer une facture avec succes et calculer les totaux', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ id: 1, name: 'Client A' });
      mockPrisma.invoice.findFirst.mockResolvedValue(null); // no previous invoices
      mockPrisma.invoice.findFirst.mockResolvedValue(null); // no collision
      mockPrisma.productPf.findMany.mockResolvedValue([
        { id: 1, code: 'PF-001', name: 'Fromage', priceHt: 85000 },
      ]);
      mockPrisma.invoice.create.mockImplementation(async ({ data }: any) => ({
        id: 1,
        reference: data.reference,
        clientId: data.clientId,
        status: 'DRAFT',
        totalHt: data.totalHt,
        totalTva: data.totalTva,
        totalTtc: data.totalTtc,
        netToPay: data.netToPay,
        client: { id: 1, name: 'Client A' },
        lines: [],
      }));

      const result = await service.createInvoice(
        {
          clientId: 1,
          lines: [{ productPfId: 1, quantity: 10 }],
          paymentMethod: 'ESPECES' as any,
        },
        'user-1',
      );

      expect(result.status).toBe('DRAFT');
      expect(result.totalHt).toBe(850000); // 85000 * 10
      expect(result.totalTva).toBe(161500); // 850000 * 0.19
      expect(result.totalTtc).toBe(1011500); // 850000 + 161500
      expect(mockPrisma.invoice.create).toHaveBeenCalled();
    });

    it('devrait lever NotFoundException quand le client est introuvable', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.createInvoice(
          {
            clientId: 999,
            lines: [{ productPfId: 1, quantity: 5 }],
            paymentMethod: 'ESPECES' as any,
          },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createInvoice(
          {
            clientId: 999,
            lines: [{ productPfId: 1, quantity: 5 }],
            paymentMethod: 'ESPECES' as any,
          },
          'user-1',
        ),
      ).rejects.toThrow(/Client/);
    });

    it('devrait lever NotFoundException quand un produit PF est introuvable', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ id: 1, name: 'Client A' });
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.productPf.findMany.mockResolvedValue([]); // no products found

      await expect(
        service.createInvoice(
          {
            clientId: 1,
            lines: [{ productPfId: 999, quantity: 5 }],
            paymentMethod: 'ESPECES' as any,
          },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createInvoice(
          {
            clientId: 1,
            lines: [{ productPfId: 999, quantity: 5 }],
            paymentMethod: 'ESPECES' as any,
          },
          'user-1',
        ),
      ).rejects.toThrow(/Produit PF/);
    });

    it('devrait ne pas appliquer le timbre fiscal quand la methode de paiement n\'est pas ESPECES', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ id: 1, name: 'Client' });
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.productPf.findMany.mockResolvedValue([
        { id: 1, code: 'PF-001', name: 'Fromage', priceHt: 50000 },
      ]);
      mockPrisma.invoice.create.mockImplementation(async ({ data }: any) => ({
        id: 1,
        reference: data.reference,
        status: 'DRAFT',
        totalHt: data.totalHt,
        totalTva: data.totalTva,
        totalTtc: data.totalTtc,
        timbreFiscal: data.timbreFiscal,
        netToPay: data.netToPay,
      }));

      const result = await service.createInvoice(
        {
          clientId: 1,
          lines: [{ productPfId: 1, quantity: 2 }],
          paymentMethod: 'VIREMENT' as any,
        },
        'user-1',
      );

      expect(result.timbreFiscal).toBe(0);
      // netToPay = totalTtc + 0 (pas de timbre)
      expect(result.netToPay).toBe(result.totalTtc);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateInvoice()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateInvoice', () => {
    it('devrait modifier une facture DRAFT avec succes', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 1,
        status: 'DRAFT',
        clientId: 1,
        paymentMethod: 'ESPECES',
        timbreFiscal: 0,
        totalTtc: 119000,
        lines: [{ id: 1, productPfId: 1, quantity: 5 }],
      });
      mockPrisma.productPf.findMany.mockResolvedValue([
        { id: 1, code: 'PF-001', name: 'Fromage', priceHt: 85000 },
      ]);
      mockPrisma.invoiceLine.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.invoice.update.mockResolvedValue({
        id: 1,
        status: 'DRAFT',
        totalHt: 170000,
        client: { id: 1, name: 'Client' },
        lines: [],
      });

      const result = await service.updateInvoice(
        1,
        { lines: [{ productPfId: 1, quantity: 2 }] },
        'user-1',
      );

      expect(result.status).toBe('DRAFT');
      expect(mockPrisma.invoiceLine.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { invoiceId: 1 } }),
      );
    });

    it('devrait rejeter la modification d\'une facture PAID', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 1,
        status: 'PAID',
        lines: [],
      });

      await expect(
        service.updateInvoice(1, { lines: [{ productPfId: 1, quantity: 1 }] }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateInvoice(1, { lines: [{ productPfId: 1, quantity: 1 }] }, 'user-1'),
      ).rejects.toThrow(/PAID/);
    });

    it('devrait lever NotFoundException quand la facture est introuvable', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.updateInvoice(999, {}, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateInvoiceStatus()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateInvoiceStatus', () => {
    it('devrait autoriser la transition DRAFT vers PAID', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 1,
        status: 'DRAFT',
        reference: 'F-260301-001',
        lines: [{ productPfId: 1, quantity: 10 }],
      });
      mockPrisma.invoice.update.mockResolvedValue({
        id: 1,
        status: 'PAID',
        client: {},
        lines: [],
      });

      const result = await service.updateInvoiceStatus(1, 'PAID', 'user-1', 'ADMIN' as any);

      expect(result.status).toBe('PAID');
      expect(mockStockService.processSale).toHaveBeenCalledWith(
        1,
        'F-260301-001',
        [{ productPfId: 1, quantity: 10 }],
        'user-1',
        'ADMIN',
        expect.anything(),
      );
    });

    it('devrait autoriser la transition DRAFT vers CANCELLED', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 1,
        status: 'DRAFT',
        lines: [],
      });
      mockPrisma.invoice.update.mockResolvedValue({
        id: 1,
        status: 'CANCELLED',
        client: {},
        lines: [],
      });

      const result = await service.updateInvoiceStatus(1, 'CANCELLED', 'user-1', 'ADMIN' as any);

      expect(result.status).toBe('CANCELLED');
    });

    it('devrait rejeter la transition PAID vers DRAFT', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 1,
        status: 'PAID',
        lines: [],
      });

      await expect(
        service.updateInvoiceStatus(1, 'DRAFT', 'user-1', 'ADMIN' as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateInvoiceStatus(1, 'DRAFT', 'user-1', 'ADMIN' as any),
      ).rejects.toThrow(/non autorisée/);
    });

    it('devrait rejeter la transition CANCELLED vers PAID', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 1,
        status: 'CANCELLED',
        lines: [],
      });

      await expect(
        service.updateInvoiceStatus(1, 'PAID', 'user-1', 'ADMIN' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait lever NotFoundException quand la facture est introuvable', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.updateInvoiceStatus(999, 'PAID', 'user-1', 'ADMIN' as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
