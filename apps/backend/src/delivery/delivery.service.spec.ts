/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DELIVERY SERVICE TESTS - Validation QR & Securite Livraisons
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * INVARIANTS TESTES:
 * 1. Format QR invalide rejete
 * 2. Checksum QR invalide (anti-falsification)
 * 3. Utilisateur inactif ne peut pas valider
 * 4. Double validation impossible (anti-replay)
 * 5. Livraison annulee non validable
 * 6. Livraison introuvable
 * 7. Annulation d'une livraison deja validee impossible
 * 8. Appareil inactif rejete
 * 9. createDelivery() - succes, facture introuvable
 * 10. cancelDelivery() - succes, deja validee, deja annulee, introuvable
 * 11. listDeliveries() - filtres status, clientId, pagination
 * 12. getPendingDeliveries() - filtres clientId, date range, pagination
 * 13. validateDelivery() edge cases - appareil inconnu, inactif
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityLogService } from '../security/security-log.service';
import { DeliveryValidationError } from './dto/delivery.dto';
import { createHash } from 'crypto';

const TEST_QR_SECRET = 'test-secret-key-for-unit-tests-32chars';

describe('DeliveryService', () => {
  let service: DeliveryService;

  const mockDeliveryValidationLog = { create: jest.fn().mockResolvedValue({}) };

  const mockPrisma: any = {
    user: { findUnique: jest.fn() },
    device: { findUnique: jest.fn() },
    delivery: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
    },
    deliveryValidationLog: mockDeliveryValidationLog,
    $transaction: jest.fn((fn: (tx: any) => Promise<any>, _opts?: any) => fn(mockPrisma)),
  };

  const mockSecurityLog = {
    log: jest.fn(),
    logCritical: jest.fn(),
    logWarning: jest.fn(),
  };

  beforeAll(() => {
    process.env.QR_SECRET_KEY = TEST_QR_SECRET;
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SecurityLogService, useValue: mockSecurityLog },
      ],
    }).compile();

    service = module.get<DeliveryService>(DeliveryService);
  });

  // Helper: generer un QR code valide avec le bon checksum
  function genererQrValide(entityId: string, reference: string): string {
    const input = `${entityId}:${reference}:${TEST_QR_SECRET}`;
    const checksum = createHash('sha256').update(input).digest('hex').substring(0, 16);
    return `MCG:DLV:${entityId}:${reference}:${checksum}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION FORMAT QR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Validation du format QR', () => {
    it('devrait rejeter un QR avec un nombre de parties incorrect', async () => {
      const result = await service.validateDelivery(
        { qrCode: 'MCG:DLV:seulement-trois' },
        'user-1',
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.INVALID_QR_FORMAT);
    });

    it('devrait rejeter un QR avec un prefixe incorrect', async () => {
      const result = await service.validateDelivery(
        { qrCode: 'XXX:DLV:00000000-0000-0000-0000-000000000001:LIV-250101-001:abc123def456abcd' },
        'user-1',
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.INVALID_QR_FORMAT);
    });

    it('devrait rejeter un QR avec un UUID invalide', async () => {
      const result = await service.validateDelivery(
        { qrCode: 'MCG:DLV:pas-un-uuid:LIV-250101-001:abc123def456abcd' },
        'user-1',
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.INVALID_QR_FORMAT);
    });

    it('devrait rejeter un type d\'entite non-DLV', async () => {
      const qr = 'MCG:INV:00000000-0000-0000-0000-000000000001:REF-001:1234567890abcdef';
      const result = await service.validateDelivery({ qrCode: qr }, 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.INVALID_ENTITY_TYPE);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION CHECKSUM QR (anti-falsification)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Validation du checksum QR', () => {
    it('devrait generer un QR valide avec le bon checksum', async () => {
      const entityId = '00000000-0000-0000-0000-000000000001';
      const reference = 'LIV-250101-001';
      const validQr = genererQrValide(entityId, reference);

      // Le QR valide passe la validation de checksum et arrive a la verification user
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, role: 'ADMIN' });
      mockPrisma.delivery.findUnique.mockResolvedValue({
        id: entityId,
        reference,
        status: 'PENDING',
        client: { id: 1, name: 'Client Test' },
        invoice: { id: 1, reference: 'FAC-001' },
      });
      mockPrisma.delivery.update.mockResolvedValue({
        id: entityId,
        reference,
        status: 'VALIDATED',
        validatedAt: new Date(),
        client: { id: 1, name: 'Client Test' },
        invoice: { id: 1, reference: 'FAC-001' },
      });

      const result = await service.validateDelivery({ qrCode: validQr }, 'user-1');
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un QR avec un checksum falsifie', async () => {
      const entityId = '00000000-0000-0000-0000-000000000001';
      const reference = 'LIV-250101-001';
      const qrFalsifie = `MCG:DLV:${entityId}:${reference}:0000000000000000`;

      const result = await service.validateDelivery({ qrCode: qrFalsifie }, 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.INVALID_QR_CHECKSUM);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION UTILISATEUR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Validation de l\'utilisateur', () => {
    it('devrait rejeter un utilisateur inactif', async () => {
      const entityId = '00000000-0000-0000-0000-000000000001';
      const validQr = genererQrValide(entityId, 'LIV-250101-001');

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: false, role: 'COMMERCIAL' });

      const result = await service.validateDelivery({ qrCode: validQr }, 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.USER_NOT_ACTIVE);
    });

    it('devrait rejeter un utilisateur inconnu', async () => {
      const entityId = '00000000-0000-0000-0000-000000000001';
      const validQr = genererQrValide(entityId, 'LIV-250101-001');

      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateDelivery({ qrCode: validQr }, 'user-fantome');
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.USER_NOT_ACTIVE);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION APPAREIL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Validation de l\'appareil', () => {
    it('devrait rejeter un appareil inactif', async () => {
      const entityId = '00000000-0000-0000-0000-000000000001';
      const validQr = genererQrValide(entityId, 'LIV-250101-001');

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, role: 'COMMERCIAL' });
      mockPrisma.device.findUnique.mockResolvedValue({ id: 'dev-1', isActive: false });

      const result = await service.validateDelivery(
        { qrCode: validQr, deviceId: 'dev-1' },
        'user-1',
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.DEVICE_NOT_ACTIVE);
    });

    it('devrait rejeter un appareil inconnu', async () => {
      const entityId = '00000000-0000-0000-0000-000000000001';
      const validQr = genererQrValide(entityId, 'LIV-250101-001');

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, role: 'COMMERCIAL' });
      mockPrisma.device.findUnique.mockResolvedValue(null);

      const result = await service.validateDelivery(
        { qrCode: validQr, deviceId: 'dev-inconnu' },
        'user-1',
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.DEVICE_NOT_ACTIVE);
    });

    it('devrait accepter la validation sans appareil (web desktop)', async () => {
      const entityId = '00000000-0000-0000-0000-000000000002';
      const reference = 'LIV-250101-002';
      const validQr = genererQrValide(entityId, reference);

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, role: 'ADMIN' });
      mockPrisma.delivery.findUnique.mockResolvedValue({
        id: entityId,
        reference,
        status: 'PENDING',
        client: { id: 1, name: 'Client Test' },
        invoice: { id: 1, reference: 'FAC-001' },
      });
      mockPrisma.delivery.update.mockResolvedValue({
        id: entityId,
        reference,
        status: 'VALIDATED',
        validatedAt: new Date(),
        client: { id: 1, name: 'Client Test' },
        invoice: { id: 1, reference: 'FAC-001' },
      });

      // No deviceId passed
      const result = await service.validateDelivery({ qrCode: validQr }, 'user-1');
      expect(result.success).toBe(true);
      // device.findUnique should NOT have been called
      expect(mockPrisma.device.findUnique).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTI-DOUBLE VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Anti-double validation', () => {
    const entityId = '00000000-0000-0000-0000-000000000001';
    const reference = 'LIV-250101-001';

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, role: 'COMMERCIAL' });
    });

    it('devrait rejeter la validation d\'une livraison deja validee', async () => {
      const validQr = genererQrValide(entityId, reference);
      mockPrisma.delivery.findUnique.mockResolvedValue({
        id: entityId,
        reference,
        status: 'VALIDATED',
        validatedAt: new Date('2025-01-01T10:00:00Z'),
        validatedByUserId: 'user-2',
      });

      const result = await service.validateDelivery({ qrCode: validQr }, 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.DELIVERY_ALREADY_VALIDATED);
    });

    it('devrait rejeter la validation d\'une livraison annulee', async () => {
      const validQr = genererQrValide(entityId, reference);
      mockPrisma.delivery.findUnique.mockResolvedValue({
        id: entityId,
        reference,
        status: 'CANCELLED',
      });

      const result = await service.validateDelivery({ qrCode: validQr }, 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.DELIVERY_CANCELLED);
    });

    it('devrait retourner livraison non trouvee quand l\'ID n\'existe pas', async () => {
      const validQr = genererQrValide(entityId, reference);
      mockPrisma.delivery.findUnique.mockResolvedValue(null);

      const result = await service.validateDelivery({ qrCode: validQr }, 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe(DeliveryValidationError.DELIVERY_NOT_FOUND);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ANNULATION DE LIVRAISON
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Annulation de livraison', () => {
    it('devrait rejeter l\'annulation d\'une livraison deja validee', async () => {
      mockPrisma.delivery.findUnique.mockResolvedValue({
        id: 'del-1',
        reference: 'LIV-250101-001',
        status: 'VALIDATED',
      });

      await expect(
        service.cancelDelivery('del-1', { reason: 'Test annulation' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait rejeter l\'annulation d\'une livraison deja annulee', async () => {
      mockPrisma.delivery.findUnique.mockResolvedValue({
        id: 'del-1',
        reference: 'LIV-250101-001',
        status: 'CANCELLED',
      });

      await expect(
        service.cancelDelivery('del-1', { reason: 'Double annulation' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait rejeter l\'annulation d\'une livraison introuvable', async () => {
      mockPrisma.delivery.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelDelivery('del-inexistant', { reason: 'Test' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('devrait annuler avec succes une livraison en attente', async () => {
      mockPrisma.delivery.findUnique.mockResolvedValue({
        id: 'del-1',
        reference: 'LIV-250101-001',
        status: 'PENDING',
        qrCode: 'MCG:DLV:del-1:LIV-250101-001:abcd',
      });
      mockPrisma.delivery.update.mockResolvedValue({
        id: 'del-1',
        status: 'CANCELLED',
        client: { id: 1, name: 'Client Test' },
        invoice: { id: 1, reference: 'FAC-001' },
      });

      const result = await service.cancelDelivery('del-1', { reason: 'Client absent' }, 'user-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('devrait enregistrer la raison d\'annulation et le userId dans la mise a jour', async () => {
      mockPrisma.delivery.findUnique.mockResolvedValue({
        id: 'del-2',
        reference: 'LIV-250101-002',
        status: 'PENDING',
        qrCode: 'MCG:DLV:del-2:LIV-250101-002:abcd',
      });
      mockPrisma.delivery.update.mockResolvedValue({
        id: 'del-2',
        status: 'CANCELLED',
        cancelReason: 'Adresse incorrecte',
        client: { id: 1, name: 'Client Test' },
        invoice: { id: 1, reference: 'FAC-001' },
      });

      await service.cancelDelivery('del-2', { reason: 'Adresse incorrecte' }, 'user-42');

      expect(mockPrisma.delivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'del-2' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelledByUserId: 'user-42',
            cancelReason: 'Adresse incorrecte',
          }),
        }),
      );
    });

    it('devrait creer un log d\'audit apres annulation', async () => {
      mockPrisma.delivery.findUnique.mockResolvedValue({
        id: 'del-3',
        reference: 'LIV-250101-003',
        status: 'PENDING',
        qrCode: 'MCG:DLV:del-3:LIV-250101-003:abcd',
      });
      mockPrisma.delivery.update.mockResolvedValue({
        id: 'del-3',
        status: 'CANCELLED',
        client: { id: 1, name: 'Client Test' },
        invoice: { id: 1, reference: 'FAC-001' },
      });

      await service.cancelDelivery('del-3', { reason: 'Motif test log' }, 'user-1', '10.0.0.1', 'TestAgent');

      expect(mockDeliveryValidationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveryId: 'del-3',
            action: 'CANCELLED',
            userId: 'user-1',
            ipAddress: '10.0.0.1',
            userAgent: 'TestAgent',
            success: true,
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RECUPERATION LIVRAISON PAR ID
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Recuperation par ID', () => {
    it('devrait rejeter quand la livraison n\'existe pas', async () => {
      mockPrisma.delivery.findUnique.mockResolvedValue(null);

      await expect(service.getDeliveryById('del-inexistant')).rejects.toThrow(NotFoundException);
    });

    it('devrait retourner la livraison avec ses relations', async () => {
      const delivery = {
        id: 'del-1',
        reference: 'LIV-250101-001',
        status: 'PENDING',
        client: { id: 1, name: 'Client Test' },
        invoice: { id: 1, reference: 'FAC-001', lines: [] },
      };
      mockPrisma.delivery.findUnique.mockResolvedValue(delivery);

      const result = await service.getDeliveryById('del-1');
      expect(result.id).toBe('del-1');
      expect(result.client).toBeDefined();
      expect(result.invoice).toBeDefined();
    });

    it('devrait inclure les lignes de facture avec produits', async () => {
      const delivery = {
        id: 'del-1',
        reference: 'LIV-250101-001',
        status: 'VALIDATED',
        client: { id: 2, name: 'Client B' },
        invoice: {
          id: 5,
          reference: 'FAC-005',
          lines: [
            { id: 1, quantity: 10, productPf: { id: 1, name: 'Fromage A' } },
            { id: 2, quantity: 20, productPf: { id: 2, name: 'Fromage B' } },
          ],
        },
      };
      mockPrisma.delivery.findUnique.mockResolvedValue(delivery);

      const result = await service.getDeliveryById('del-1');
      expect(result.invoice.lines).toHaveLength(2);
      expect(result.invoice.lines[0].productPf.name).toBe('Fromage A');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATION DE LIVRAISON
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Creation de livraison (createDelivery)', () => {
    it('devrait creer une livraison avec succes a partir d\'une facture existante', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 10,
        reference: 'FAC-010',
        clientId: 3,
        client: { id: 3, name: 'Client C', address: '123 Rue Didouche' },
      });
      mockPrisma.delivery.count.mockResolvedValue(0);
      mockPrisma.delivery.create.mockResolvedValue({
        id: 'new-delivery-uuid',
        reference: 'LIV-260301-001',
        invoiceId: 10,
        clientId: 3,
        qrCode: 'MCG:DLV:new-delivery-uuid:LIV-260301-001:checksum',
        status: 'PENDING',
        client: { id: 3, name: 'Client C' },
        invoice: { id: 10, reference: 'FAC-010' },
      });

      const result = await service.createDelivery(
        { invoiceId: 10, deliveryNotes: 'Fragile' },
        'user-1',
      );

      expect(result.id).toBeDefined();
      expect(result.reference).toBeDefined();
      expect(result.qrCode).toBeDefined();
      expect(result.qrCode).toContain('MCG:DLV:');
      expect(result.client.name).toBe('Client C');
      expect(result.invoice.reference).toBe('FAC-010');
    });

    it('devrait rejeter la creation si la facture n\'existe pas', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.createDelivery({ invoiceId: 9999 }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('devrait utiliser l\'adresse client par defaut si aucune adresse de livraison specifiee', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 11,
        reference: 'FAC-011',
        clientId: 4,
        client: { id: 4, name: 'Client D', address: 'Adresse par defaut du client' },
      });
      mockPrisma.delivery.count.mockResolvedValue(0);
      mockPrisma.delivery.create.mockImplementation(async ({ data }: any) => {
        expect(data.deliveryAddress).toBe('Adresse par defaut du client');
        return {
          id: data.id,
          reference: data.reference,
          status: 'PENDING',
          client: { id: 4, name: 'Client D' },
          invoice: { id: 11, reference: 'FAC-011' },
          qrCode: data.qrCode,
        };
      });

      await service.createDelivery({ invoiceId: 11 }, 'user-1');
      expect(mockPrisma.delivery.create).toHaveBeenCalled();
    });

    it('devrait utiliser l\'adresse de livraison custom si specifiee', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 12,
        reference: 'FAC-012',
        clientId: 5,
        client: { id: 5, name: 'Client E', address: 'Adresse client' },
      });
      mockPrisma.delivery.count.mockResolvedValue(2);
      mockPrisma.delivery.create.mockImplementation(async ({ data }: any) => {
        expect(data.deliveryAddress).toBe('42 Rue custom livraison');
        return {
          id: data.id,
          reference: data.reference,
          status: 'PENDING',
          client: { id: 5, name: 'Client E' },
          invoice: { id: 12, reference: 'FAC-012' },
          qrCode: data.qrCode,
        };
      });

      await service.createDelivery(
        { invoiceId: 12, deliveryAddress: '42 Rue custom livraison' },
        'user-1',
      );
      expect(mockPrisma.delivery.create).toHaveBeenCalled();
    });

    it('devrait generer un QR code avec checksum SHA256 valide', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 13,
        reference: 'FAC-013',
        clientId: 6,
        client: { id: 6, name: 'Client F', address: 'Adresse F' },
      });
      mockPrisma.delivery.count.mockResolvedValue(0);
      mockPrisma.delivery.create.mockImplementation(async ({ data }: any) => {
        // Verify QR code structure: MCG:DLV:{UUID}:{REF}:{CHECKSUM}
        const parts = data.qrCode.split(':');
        expect(parts).toHaveLength(5);
        expect(parts[0]).toBe('MCG');
        expect(parts[1]).toBe('DLV');
        // Verify checksum matches
        expect(data.qrChecksum).toBe(parts[4]);
        expect(data.qrChecksum).toHaveLength(16);

        return {
          id: data.id,
          reference: data.reference,
          status: 'PENDING',
          client: { id: 6, name: 'Client F' },
          invoice: { id: 13, reference: 'FAC-013' },
          qrCode: data.qrCode,
        };
      });

      const result = await service.createDelivery({ invoiceId: 13 }, 'user-1');
      expect(result.qrCode).toMatch(/^MCG:DLV:[0-9a-f-]+:LIV-\d{6}-\d{3}:[0-9a-f]{16}$/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTE DES LIVRAISONS AVEC FILTRES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Liste des livraisons (listDeliveries)', () => {
    it('devrait retourner toutes les livraisons sans filtre avec pagination par defaut', async () => {
      const mockDeliveries = [
        { id: 'del-1', reference: 'LIV-001', status: 'PENDING', client: { id: 1, name: 'A' }, invoice: { id: 1, reference: 'FAC-001' } },
        { id: 'del-2', reference: 'LIV-002', status: 'VALIDATED', client: { id: 2, name: 'B' }, invoice: { id: 2, reference: 'FAC-002' } },
      ];
      mockPrisma.delivery.findMany.mockResolvedValue(mockDeliveries);
      mockPrisma.delivery.count.mockResolvedValue(2);

      const result = await service.listDeliveries({});

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('devrait filtrer par status PENDING', async () => {
      mockPrisma.delivery.findMany.mockResolvedValue([
        { id: 'del-1', reference: 'LIV-001', status: 'PENDING', client: { id: 1, name: 'A' }, invoice: { id: 1, reference: 'FAC-001' } },
      ]);
      mockPrisma.delivery.count.mockResolvedValue(1);

      const result = await service.listDeliveries({ status: 'PENDING' });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      // Verify the where clause was passed with correct status
      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('devrait filtrer par clientId', async () => {
      mockPrisma.delivery.findMany.mockResolvedValue([]);
      mockPrisma.delivery.count.mockResolvedValue(0);

      await service.listDeliveries({ clientId: 42 });

      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ clientId: 42 }),
        }),
      );
    });

    it('devrait respecter la pagination (page 2, limit 5)', async () => {
      mockPrisma.delivery.findMany.mockResolvedValue([]);
      mockPrisma.delivery.count.mockResolvedValue(15);

      const result = await service.listDeliveries({ page: 2, limit: 5 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(5);
      expect(result.meta.totalPages).toBe(3);
      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        }),
      );
    });

    it('devrait filtrer par date range (dateFrom et dateTo)', async () => {
      mockPrisma.delivery.findMany.mockResolvedValue([]);
      mockPrisma.delivery.count.mockResolvedValue(0);

      await service.listDeliveries({
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
      });

      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });

    it('devrait combiner status et clientId', async () => {
      mockPrisma.delivery.findMany.mockResolvedValue([]);
      mockPrisma.delivery.count.mockResolvedValue(0);

      await service.listDeliveries({ status: 'VALIDATED', clientId: 7 });

      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'VALIDATED',
            clientId: 7,
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVRAISONS EN ATTENTE (getPendingDeliveries)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Livraisons en attente (getPendingDeliveries)', () => {
    it('devrait retourner uniquement les livraisons PENDING', async () => {
      mockPrisma.delivery.findMany.mockResolvedValue([
        { id: 'p-1', status: 'PENDING', client: { id: 1, name: 'A', address: 'Addr' }, invoice: { id: 1, reference: 'F-1', netToPay: 10000 } },
      ]);
      mockPrisma.delivery.count.mockResolvedValue(1);

      const result = await service.getPendingDeliveries({});

      expect(result.data).toHaveLength(1);
      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('devrait filtrer par clientId dans getPendingDeliveries', async () => {
      mockPrisma.delivery.findMany.mockResolvedValue([]);
      mockPrisma.delivery.count.mockResolvedValue(0);

      await service.getPendingDeliveries({ clientId: 99 });

      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
            clientId: 99,
          }),
        }),
      );
    });

    it('devrait paginer les livraisons en attente', async () => {
      mockPrisma.delivery.findMany.mockResolvedValue([]);
      mockPrisma.delivery.count.mockResolvedValue(50);

      const result = await service.getPendingDeliveries({ page: 3, limit: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('devrait filtrer par plage de dates (scheduledDate)', async () => {
      mockPrisma.delivery.findMany.mockResolvedValue([]);
      mockPrisma.delivery.count.mockResolvedValue(0);

      await service.getPendingDeliveries({
        dateFrom: '2025-06-01',
        dateTo: '2025-06-30',
      });

      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
            scheduledDate: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT: TRACE DES TENTATIVES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Audit des tentatives de validation', () => {
    it('devrait enregistrer les tentatives de validation echouees', async () => {
      await service.validateDelivery({ qrCode: 'invalide' }, 'user-1');
      expect(mockDeliveryValidationLog.create).toHaveBeenCalled();
    });

    it('devrait enregistrer l\'adresse IP et le user-agent', async () => {
      await service.validateDelivery(
        { qrCode: 'invalide' },
        'user-1',
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(mockDeliveryValidationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          }),
        }),
      );
    });

    it('devrait enregistrer le deviceId dans le log d\'audit si fourni', async () => {
      const entityId = '00000000-0000-0000-0000-000000000099';
      const validQr = genererQrValide(entityId, 'LIV-250101-099');

      // User active but device inactive => will fail at device check
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, role: 'COMMERCIAL' });
      mockPrisma.device.findUnique.mockResolvedValue(null);

      await service.validateDelivery(
        { qrCode: validQr, deviceId: 'device-abc' },
        'user-1',
      );

      expect(mockDeliveryValidationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deviceId: 'device-abc',
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION COMPLETE AVEC METADATA
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Validation complete avec metadata', () => {
    it('devrait sauvegarder recipientName et recipientSignature lors de la validation', async () => {
      const entityId = '00000000-0000-0000-0000-000000000050';
      const reference = 'LIV-250201-001';
      const validQr = genererQrValide(entityId, reference);

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, role: 'COMMERCIAL' });
      mockPrisma.delivery.findUnique.mockResolvedValue({
        id: entityId,
        reference,
        status: 'PENDING',
        client: { id: 1, name: 'Client Test' },
        invoice: { id: 1, reference: 'FAC-001' },
      });
      mockPrisma.delivery.update.mockResolvedValue({
        id: entityId,
        reference,
        status: 'VALIDATED',
        validatedAt: new Date(),
        client: { id: 1, name: 'Client Test' },
        invoice: { id: 1, reference: 'FAC-001' },
      });

      await service.validateDelivery(
        {
          qrCode: validQr,
          recipientName: 'Mohamed B.',
          recipientSignature: 'base64signature',
          gpsCoordinates: '36.7538,3.0588',
        },
        'user-1',
      );

      expect(mockPrisma.delivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipientName: 'Mohamed B.',
            recipientSignature: 'base64signature',
          }),
        }),
      );
    });

    it('devrait retourner les infos client et facture apres validation reussie', async () => {
      const entityId = '00000000-0000-0000-0000-000000000060';
      const reference = 'LIV-250301-001';
      const validQr = genererQrValide(entityId, reference);

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, role: 'ADMIN' });
      mockPrisma.delivery.findUnique.mockResolvedValue({
        id: entityId,
        reference,
        status: 'PENDING',
        client: { id: 10, name: 'Epicerie Alger' },
        invoice: { id: 20, reference: 'FAC-020' },
      });
      mockPrisma.delivery.update.mockResolvedValue({
        id: entityId,
        reference,
        status: 'VALIDATED',
        validatedAt: new Date('2025-03-01T12:00:00Z'),
        client: { id: 10, name: 'Epicerie Alger' },
        invoice: { id: 20, reference: 'FAC-020' },
      });

      const result = await service.validateDelivery({ qrCode: validQr }, 'user-1');

      expect(result.success).toBe(true);
      expect(result.delivery).toBeDefined();
      expect(result.delivery!.client.name).toBe('Epicerie Alger');
      expect(result.delivery!.invoice.reference).toBe('FAC-020');
      expect(result.delivery!.status).toBe('VALIDATED');
      expect(result.delivery!.validatedAt).toBeDefined();
    });
  });
});
