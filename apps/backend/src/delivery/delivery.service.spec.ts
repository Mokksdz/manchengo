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
    invoice: { findUnique: jest.fn() },
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
  });
});
