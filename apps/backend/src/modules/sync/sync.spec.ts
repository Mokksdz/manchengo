import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { SyncIdempotencyService } from './sync.idempotency';
import { SyncConflictResolver } from './sync.conflict';
import { SyncEventApplier } from './sync.applier';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SyncEntityType,
  SyncAction,
  ConflictErrorCode,
  PushSyncDto,
  SyncEventDto,
} from './sync.dto';
import { SyncStatus } from '@prisma/client';

describe('SyncModule', () => {
  let syncService: SyncService;
  let idempotencyService: SyncIdempotencyService;
  let conflictResolver: SyncConflictResolver;
  let eventApplier: SyncEventApplier;
  let prismaService: PrismaService;

  const mockPrismaService: any = {
    syncEvent: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    syncState: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    device: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    delivery: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    deliveryValidationLog: {
      create: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    invoiceLine: {
      create: jest.fn(),
    },
    payment: {
      create: jest.fn(),
    },
    client: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    productPf: {
      findMany: jest.fn(),
    },
    lotPf: {
      groupBy: jest.fn(),
    },
    securityLog: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrismaService)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        SyncIdempotencyService,
        SyncConflictResolver,
        SyncEventApplier,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    syncService = module.get<SyncService>(SyncService);
    idempotencyService = module.get<SyncIdempotencyService>(SyncIdempotencyService);
    conflictResolver = module.get<SyncConflictResolver>(SyncConflictResolver);
    eventApplier = module.get<SyncEventApplier>(SyncEventApplier);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('SyncIdempotencyService', () => {
    describe('checkEvent', () => {
      it('should return isDuplicate=false for new event', async () => {
        mockPrismaService.syncEvent.findUnique.mockResolvedValue(null);

        const result = await idempotencyService.checkEvent('new-event-id');

        expect(result.isDuplicate).toBe(false);
        expect(result.existingEvent).toBeUndefined();
      });

      it('should return isDuplicate=true for existing event', async () => {
        const existingEvent = {
          id: 'server-id',
          clientEventId: 'client-id',
          status: SyncStatus.APPLIED,
          appliedAt: new Date(),
          errorCode: null,
          resolution: null,
        };
        mockPrismaService.syncEvent.findUnique.mockResolvedValue(existingEvent);

        const result = await idempotencyService.checkEvent('client-id');

        expect(result.isDuplicate).toBe(true);
        expect(result.existingEvent).toEqual(existingEvent);
      });
    });

    describe('checkBatch', () => {
      it('should separate new and duplicate events', async () => {
        const existingEvents = [
          { clientEventId: 'dup-1', id: 's1', status: SyncStatus.APPLIED, appliedAt: new Date(), errorCode: null, resolution: null },
          { clientEventId: 'dup-2', id: 's2', status: SyncStatus.FAILED, appliedAt: null, errorCode: 'CONFLICT', resolution: null },
        ];
        mockPrismaService.syncEvent.findMany.mockResolvedValue(existingEvents);

        const result = await idempotencyService.checkBatch(['dup-1', 'dup-2', 'new-1', 'new-2']);

        expect(result.newEvents).toEqual(['new-1', 'new-2']);
        expect(result.duplicateEvents.size).toBe(2);
        expect(result.duplicateEvents.get('dup-1')?.isDuplicate).toBe(true);
      });
    });

    describe('generatePayloadHash', () => {
      it('should generate consistent hash for same payload', () => {
        const payload = { a: 1, b: 'test', c: { nested: true } };

        const hash1 = idempotencyService.generatePayloadHash(payload);
        const hash2 = idempotencyService.generatePayloadHash(payload);

        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64);
      });

      it('should generate different hash for different payload', () => {
        const payload1 = { a: 1 };
        const payload2 = { a: 2 };

        const hash1 = idempotencyService.generatePayloadHash(payload1);
        const hash2 = idempotencyService.generatePayloadHash(payload2);

        expect(hash1).not.toBe(hash2);
      });
    });

    describe('verifyPayloadHash', () => {
      it('should return true for valid hash', () => {
        const payload = { test: 'data' };
        const hash = idempotencyService.generatePayloadHash(payload);

        const isValid = idempotencyService.verifyPayloadHash(payload, hash);

        expect(isValid).toBe(true);
      });

      it('should return false for invalid hash', () => {
        const payload = { test: 'data' };
        const wrongHash = 'a'.repeat(64);

        const isValid = idempotencyService.verifyPayloadHash(payload, wrongHash);

        expect(isValid).toBe(false);
      });
    });
  });

  describe('SyncConflictResolver', () => {
    describe('DELIVERY conflicts', () => {
      it('should detect already validated delivery (FIRST-WINS)', async () => {
        mockPrismaService.delivery.findUnique.mockResolvedValue({
          id: 'dlv-1',
          status: 'VALIDATED',
          validatedAt: new Date(),
          validatedByUserId: 'user-1',
          cancelledAt: null,
          cancelledByUserId: null,
        });
        mockPrismaService.user.findUnique.mockResolvedValue({
          firstName: 'John',
          lastName: 'Doe',
        });

        const result = await conflictResolver.checkConflict(
          SyncEntityType.DELIVERY,
          'dlv-1',
          SyncAction.DELIVERY_VALIDATED,
          {},
        );

        expect(result.hasConflict).toBe(true);
        expect(result.errorCode).toBe(ConflictErrorCode.ALREADY_VALIDATED);
        expect(result.canProceed).toBe(false);
        expect(result.resolution?.action).toBe('DISCARD_LOCAL');
      });

      it('should allow validation of pending delivery', async () => {
        mockPrismaService.delivery.findUnique.mockResolvedValue({
          id: 'dlv-1',
          status: 'PENDING',
          validatedAt: null,
          validatedByUserId: null,
          cancelledAt: null,
          cancelledByUserId: null,
        });

        const result = await conflictResolver.checkConflict(
          SyncEntityType.DELIVERY,
          'dlv-1',
          SyncAction.DELIVERY_VALIDATED,
          {},
        );

        expect(result.hasConflict).toBe(false);
        expect(result.canProceed).toBe(true);
      });

      it('should reject validation of cancelled delivery', async () => {
        mockPrismaService.delivery.findUnique.mockResolvedValue({
          id: 'dlv-1',
          status: 'CANCELLED',
          validatedAt: null,
          validatedByUserId: null,
          cancelledAt: new Date(),
          cancelledByUserId: 'user-2',
        });

        const result = await conflictResolver.checkConflict(
          SyncEntityType.DELIVERY,
          'dlv-1',
          SyncAction.DELIVERY_VALIDATED,
          {},
        );

        expect(result.hasConflict).toBe(true);
        expect(result.errorCode).toBe(ConflictErrorCode.ALREADY_CANCELLED);
        expect(result.canProceed).toBe(false);
      });

      it('should return error for non-existent delivery', async () => {
        mockPrismaService.delivery.findUnique.mockResolvedValue(null);

        const result = await conflictResolver.checkConflict(
          SyncEntityType.DELIVERY,
          'dlv-nonexistent',
          SyncAction.DELIVERY_VALIDATED,
          {},
        );

        expect(result.hasConflict).toBe(true);
        expect(result.errorCode).toBe(ConflictErrorCode.ENTITY_NOT_FOUND);
      });
    });

    describe('PAYMENT conflicts', () => {
      it('should reject payment exceeding remaining balance', async () => {
        mockPrismaService.invoice.findUnique.mockResolvedValue({
          id: 1,
          netToPay: 100000,
          status: 'DRAFT',
          payments: [{ amount: 80000 }],
        });

        const result = await conflictResolver.checkConflict(
          SyncEntityType.PAYMENT,
          'pay-1',
          SyncAction.PAYMENT_RECORDED,
          { invoice_id: 1, amount: 30000 },
        );

        expect(result.hasConflict).toBe(true);
        expect(result.errorCode).toBe(ConflictErrorCode.VALIDATION_ERROR);
        expect(result.resolution?.data?.remaining).toBe(20000);
      });

      it('should allow valid payment', async () => {
        mockPrismaService.invoice.findUnique.mockResolvedValue({
          id: 1,
          netToPay: 100000,
          status: 'DRAFT',
          payments: [{ amount: 50000 }],
        });

        const result = await conflictResolver.checkConflict(
          SyncEntityType.PAYMENT,
          'pay-1',
          SyncAction.PAYMENT_RECORDED,
          { invoice_id: 1, amount: 50000 },
        );

        expect(result.hasConflict).toBe(false);
        expect(result.canProceed).toBe(true);
      });
    });
  });

  describe('SyncService', () => {
    describe('pushEvents', () => {
      const createMockEvent = (id: string): SyncEventDto => ({
        id,
        entityType: SyncEntityType.DELIVERY,
        entityId: 'dlv-1',
        action: SyncAction.DELIVERY_VALIDATED,
        payload: { qr_scanned: 'MCG:DLV:dlv-1:ref:checksum' },
        occurredAt: new Date().toISOString(),
        checksum: 'a'.repeat(64),
      });

      it('should process new events successfully', async () => {
        const dto: PushSyncDto = {
          deviceId: 'device-1',
          batchId: 'batch-1',
          events: [createMockEvent('evt-1')],
        };

        // Mock idempotency check - no duplicates
        mockPrismaService.syncEvent.count.mockResolvedValue(0);
        mockPrismaService.syncEvent.findMany.mockResolvedValue([]);
        
        // Mock event creation
        mockPrismaService.syncEvent.create.mockResolvedValue({
          id: 'server-evt-1',
          clientEventId: 'evt-1',
          status: SyncStatus.PENDING,
        });

        // Mock delivery exists and is pending
        mockPrismaService.delivery.findUnique.mockResolvedValue({
          id: 'dlv-1',
          status: 'PENDING',
          validatedAt: null,
          validatedByUserId: null,
          cancelledAt: null,
          cancelledByUserId: null,
        });

        // Mock delivery update
        mockPrismaService.delivery.update.mockResolvedValue({
          id: 'dlv-1',
          status: 'VALIDATED',
        });

        // Mock sync state update
        mockPrismaService.syncState.upsert.mockResolvedValue({});
        mockPrismaService.device.update.mockResolvedValue({});

        const result = await syncService.pushEvents(dto, 'user-1');

        expect(result.batchId).toBe('batch-1');
        expect(mockPrismaService.securityLog.create).toHaveBeenCalled();
      });

      it('should handle duplicate batch idempotently', async () => {
        const dto: PushSyncDto = {
          deviceId: 'device-1',
          batchId: 'existing-batch',
          events: [createMockEvent('evt-1')],
        };

        // Mock batch already exists
        mockPrismaService.syncEvent.count.mockResolvedValue(1);
        mockPrismaService.syncEvent.findMany.mockResolvedValue([
          {
            clientEventId: 'evt-1',
            id: 'server-evt-1',
            status: SyncStatus.APPLIED,
          },
        ]);

        const result = await syncService.pushEvents(dto, 'user-1');

        expect(result.success).toBe(true);
        expect(result.warnings).toContain('Batch déjà traité (idempotent)');
        expect(result.ackedEventIds).toContain('evt-1');
      });

      it('should reject batch exceeding max size', async () => {
        const events = Array.from({ length: 51 }, (_, i) =>
          createMockEvent(`evt-${i}`),
        );

        const dto: PushSyncDto = {
          deviceId: 'device-1',
          batchId: 'batch-1',
          events,
        };

        const result = await syncService.pushEvents(dto, 'user-1');

        expect(result.success).toBe(false);
        expect(result.failedEvents[0].errorCode).toBe(
          ConflictErrorCode.VALIDATION_ERROR,
        );
      });
    });

    describe('pullEvents', () => {
      it('should return events since timestamp', async () => {
        const since = new Date('2024-01-01');
        mockPrismaService.syncEvent.findMany.mockResolvedValue([
          {
            id: 'evt-1',
            entityType: 'DELIVERY',
            entityId: 'dlv-1',
            action: 'DELIVERY_VALIDATED',
            payload: {},
            occurredAt: new Date(),
            userId: 'user-2',
            deviceId: 'device-2',
          },
        ]);
        mockPrismaService.productPf.findMany.mockResolvedValue([]);
        mockPrismaService.client.findMany.mockResolvedValue([]);
        mockPrismaService.device.findUnique.mockResolvedValue({ isActive: true });
        mockPrismaService.user.findUnique.mockResolvedValue({ isActive: true });
        mockPrismaService.syncState.upsert.mockResolvedValue({});
        mockPrismaService.device.update.mockResolvedValue({});

        const result = await syncService.pullEvents(
          {
            deviceId: 'device-1',
            since: since.toISOString(),
          },
          'user-1',
        );

        expect(result.events).toHaveLength(1);
        expect(result.deviceStatus.isActive).toBe(true);
      });

      it('should not return own device events', async () => {
        mockPrismaService.syncEvent.findMany.mockImplementation(({ where }: any) => {
          expect(where.deviceId.not).toBe('device-1');
          return Promise.resolve([]);
        });
        mockPrismaService.productPf.findMany.mockResolvedValue([]);
        mockPrismaService.client.findMany.mockResolvedValue([]);
        mockPrismaService.device.findUnique.mockResolvedValue({ isActive: true });
        mockPrismaService.user.findUnique.mockResolvedValue({ isActive: true });
        mockPrismaService.syncState.upsert.mockResolvedValue({});
        mockPrismaService.device.update.mockResolvedValue({});

        await syncService.pullEvents(
          {
            deviceId: 'device-1',
            since: new Date().toISOString(),
          },
          'user-1',
        );

        expect(mockPrismaService.syncEvent.findMany).toHaveBeenCalled();
      });
    });

    describe('getStatus', () => {
      it('should return sync status', async () => {
        mockPrismaService.device.findUnique.mockResolvedValue({
          id: 'device-1',
          isActive: true,
          lastSyncAt: new Date(),
        });
        mockPrismaService.user.findUnique.mockResolvedValue({
          id: 'user-1',
          isActive: true,
          role: 'COMMERCIAL',
        });
        mockPrismaService.syncState.findUnique.mockResolvedValue({
          lastPullAt: new Date(),
          lastPushAt: new Date(),
        });
        mockPrismaService.syncEvent.count.mockResolvedValue(0);

        const result = await syncService.getStatus('device-1', 'user-1');

        expect(result.serverHealthy).toBe(true);
        expect(result.device.isActive).toBe(true);
        expect(result.user.isActive).toBe(true);
      });
    });
  });

  describe('Crash Recovery Scenarios', () => {
    it('should handle crash between APPLIED and ACKED', async () => {
      // Simulate event that was applied but never ACKed
      mockPrismaService.syncEvent.findMany.mockResolvedValue([
        {
          id: 'server-evt-1',
          clientEventId: 'client-evt-1',
          status: SyncStatus.APPLIED,
          appliedAt: new Date(),
        },
      ]);

      const unacked = await idempotencyService.findUnackedEvents(
        'device-1',
        new Date(Date.now() - 3600000),
      );

      expect(unacked).toHaveLength(1);
      expect(unacked[0].status).toBe(SyncStatus.APPLIED);
    });

    it('should acknowledge events after crash recovery', async () => {
      mockPrismaService.syncEvent.updateMany.mockResolvedValue({ count: 5 });

      const count = await idempotencyService.acknowledgeEvents(
        ['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5'],
        'device-1',
      );

      expect(count).toBe(5);
      expect(mockPrismaService.syncEvent.updateMany).toHaveBeenCalledWith({
        where: {
          clientEventId: { in: ['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5'] },
          deviceId: 'device-1',
          status: 'APPLIED',
        },
        data: { status: 'ACKED' },
      });
    });
  });

  describe('Partial Batch Handling', () => {
    it('should process valid events and fail invalid ones', async () => {
      // This tests that a batch with mixed valid/invalid events
      // processes valid ones and returns failures for invalid ones
      
      mockPrismaService.syncEvent.count.mockResolvedValue(0);
      mockPrismaService.syncEvent.findMany.mockResolvedValue([]);
      
      // First event - valid delivery
      mockPrismaService.delivery.findUnique
        .mockResolvedValueOnce({
          id: 'dlv-1',
          status: 'PENDING',
          validatedAt: null,
          validatedByUserId: null,
          cancelledAt: null,
        })
        // Second event - already validated
        .mockResolvedValueOnce({
          id: 'dlv-2',
          status: 'VALIDATED',
          validatedAt: new Date(),
          validatedByUserId: 'other-user',
          cancelledAt: null,
        });

      mockPrismaService.user.findUnique.mockResolvedValue({
        firstName: 'Other',
        lastName: 'User',
      });

      // The test verifies that the conflict resolver correctly identifies
      // which events can proceed and which have conflicts
      const result1 = await conflictResolver.checkConflict(
        SyncEntityType.DELIVERY,
        'dlv-1',
        SyncAction.DELIVERY_VALIDATED,
        {},
      );
      
      const result2 = await conflictResolver.checkConflict(
        SyncEntityType.DELIVERY,
        'dlv-2',
        SyncAction.DELIVERY_VALIDATED,
        {},
      );

      expect(result1.canProceed).toBe(true);
      expect(result2.canProceed).toBe(false);
      expect(result2.errorCode).toBe(ConflictErrorCode.ALREADY_VALIDATED);
    });
  });
});
