import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncStatus } from '@prisma/client';
import { SyncIdempotencyService } from './sync.idempotency';
import { SyncEventApplier, ApplyResult } from './sync.applier';
import {
  PushSyncDto,
  PushSyncResponseDto,
  PullSyncDto,
  PullSyncResponseDto,
  SyncStatusResponseDto,
  BootstrapRequestDto,
  BootstrapResponseDto,
  AckEventsDto,
  AckEventsResponseDto,
  FailedEventDto,
  ServerEventDto,
  ConflictErrorCode,
  SyncEventDto,
} from './sync.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly MAX_BATCH_SIZE = 50;
  private readonly DEFAULT_PULL_LIMIT = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyService: SyncIdempotencyService,
    private readonly eventApplier: SyncEventApplier,
  ) {}

  /**
   * Process incoming sync events from mobile
   */
  async pushEvents(
    dto: PushSyncDto,
    userId: string,
  ): Promise<PushSyncResponseDto> {
    const startTime = Date.now();
    const { deviceId, batchId, events } = dto;

    this.logger.log(
      `Push started - Device: ${deviceId}, Batch: ${batchId}, Events: ${events.length}`,
    );

    // Check batch size
    if (events.length > this.MAX_BATCH_SIZE) {
      return {
        success: false,
        batchId,
        ackedEventIds: [],
        serverEventIds: {},
        failedEvents: [
          {
            eventId: 'BATCH',
            errorCode: ConflictErrorCode.VALIDATION_ERROR,
            errorMessage: `Taille de batch dépassée (max ${this.MAX_BATCH_SIZE})`,
            retry: true,
          },
        ],
        serverTime: new Date().toISOString(),
        warnings: [],
      };
    }

    // Check for duplicate batch
    const batchCheck = await this.idempotencyService.checkBatchId(batchId);
    if (batchCheck.isProcessed) {
      this.logger.warn(
        `Duplicate batch detected: ${batchId} (${batchCheck.eventCount} events)`,
      );
      // Return success for idempotency - events already processed
      const existingEvents = await this.prisma.syncEvent.findMany({
        where: { batchId },
        select: { clientEventId: true, id: true, status: true },
      });

      return {
        success: true,
        batchId,
        ackedEventIds: existingEvents
          .filter((e) => e.status === 'APPLIED' || e.status === 'ACKED')
          .map((e) => e.clientEventId),
        serverEventIds: Object.fromEntries(
          existingEvents.map((e) => [e.clientEventId, e.id]),
        ),
        failedEvents: [],
        serverTime: new Date().toISOString(),
        warnings: ['Batch déjà traité (idempotent)'],
      };
    }

    // Check for duplicate events
    const clientEventIds = events.map((e) => e.id);
    const idempotencyCheck =
      await this.idempotencyService.checkBatch(clientEventIds);

    const ackedEventIds: string[] = [];
    const serverEventIds: Record<string, string> = {};
    const failedEvents: FailedEventDto[] = [];
    const warnings: string[] = [];

    // Handle already processed events
    for (const [clientEventId, result] of idempotencyCheck.duplicateEvents) {
      if (result.existingEvent) {
        if (
          result.existingEvent.status === 'APPLIED' ||
          result.existingEvent.status === 'ACKED'
        ) {
          ackedEventIds.push(clientEventId);
          serverEventIds[clientEventId] = result.existingEvent.id;
        } else if (result.existingEvent.status === 'FAILED') {
          failedEvents.push({
            eventId: clientEventId,
            errorCode: result.existingEvent.errorCode as ConflictErrorCode,
            errorMessage: 'Event précédemment échoué',
            retry: false,
            resolution: result.existingEvent.resolution as any,
          });
        }
      }
    }

    // Process new events in transaction
    const newEventIds = idempotencyCheck.newEvents;
    const newEvents = events.filter((e) => newEventIds.includes(e.id));

    if (newEvents.length > 0) {
      await this.prisma.$transaction(
        async (tx) => {
          for (const event of newEvents) {
            // Verify payload hash
            const isValidHash = this.idempotencyService.verifyPayloadHash(
              event.payload,
              event.checksum,
            );

            if (!isValidHash) {
              // Create failed event record
              await tx.syncEvent.create({
                data: {
                  clientEventId: event.id,
                  deviceId,
                  userId,
                  entityType: event.entityType,
                  entityId: event.entityId,
                  action: event.action,
                  payload: event.payload as any,
                  payloadHash: event.checksum,
                  occurredAt: new Date(event.occurredAt),
                  status: SyncStatus.FAILED,
                  errorCode: ConflictErrorCode.CHECKSUM_MISMATCH,
                  errorMessage: 'Checksum invalide',
                  batchId,
                },
              });

              failedEvents.push({
                eventId: event.id,
                errorCode: ConflictErrorCode.CHECKSUM_MISMATCH,
                errorMessage: 'Checksum du payload invalide',
                retry: true,
              });
              continue;
            }

            // Create pending event record
            const syncEvent = await tx.syncEvent.create({
              data: {
                clientEventId: event.id,
                deviceId,
                userId,
                entityType: event.entityType,
                entityId: event.entityId,
                action: event.action,
                payload: event.payload as any,
                payloadHash: event.checksum,
                occurredAt: new Date(event.occurredAt),
                status: SyncStatus.PENDING,
                batchId,
              },
            });

            // Apply the event
            const applyResult = await this.eventApplier.applyEvent(
              event,
              userId,
              deviceId,
              tx,
            );

            if (applyResult.success) {
              // Update sync event status
              await tx.syncEvent.update({
                where: { id: syncEvent.id },
                data: {
                  status: SyncStatus.APPLIED,
                  appliedAt: new Date(),
                  serverEventId: applyResult.serverEventId,
                },
              });

              ackedEventIds.push(event.id);
              serverEventIds[event.id] = syncEvent.id;
            } else {
              // Update sync event with error
              await tx.syncEvent.update({
                where: { id: syncEvent.id },
                data: {
                  status: SyncStatus.FAILED,
                  errorCode: applyResult.errorCode,
                  errorMessage: applyResult.errorMessage,
                  resolution: applyResult.resolution as any,
                },
              });

              failedEvents.push({
                eventId: event.id,
                errorCode: applyResult.errorCode!,
                errorMessage: applyResult.errorMessage!,
                retry: this.shouldRetry(applyResult.errorCode),
                resolution: applyResult.resolution as any,
              });
            }
          }
        },
        {
          maxWait: 10000,
          timeout: 30000,
        },
      );
    }

    // Update device sync state
    await this.updateDeviceSyncState(deviceId, 'push');

    // Log security event
    await this.prisma.securityLog.create({
      data: {
        action: 'SYNC_PUSH',
        userId,
        deviceId,
        details: {
          batchId,
          totalEvents: events.length,
          newEvents: newEvents.length,
          ackedCount: ackedEventIds.length,
          failedCount: failedEvents.length,
          durationMs: Date.now() - startTime,
        },
        success: failedEvents.length === 0,
      },
    });

    this.logger.log(
      `Push completed - Batch: ${batchId}, Acked: ${ackedEventIds.length}, Failed: ${failedEvents.length}, Duration: ${Date.now() - startTime}ms`,
    );

    return {
      success: failedEvents.length === 0,
      batchId,
      ackedEventIds,
      serverEventIds,
      failedEvents,
      serverTime: new Date().toISOString(),
      warnings,
    };
  }

  /**
   * Pull events from server to mobile
   */
  async pullEvents(
    dto: PullSyncDto,
    userId: string,
  ): Promise<PullSyncResponseDto> {
    const startTime = Date.now();
    const { deviceId, since, entities, limit, cursor } = dto;

    this.logger.log(
      `Pull started - Device: ${deviceId}, Since: ${since}, Entities: ${entities}`,
    );

    const sinceDate = new Date(since);
    const pullLimit = Math.min(limit || this.DEFAULT_PULL_LIMIT, 500);

    // Build entity type filter
    const entityTypes = entities
      ? entities.split(',').map((e) => e.trim().toUpperCase())
      : undefined;

    // Query events
    const events = await this.prisma.syncEvent.findMany({
      where: {
        appliedAt: { gt: sinceDate },
        deviceId: { not: deviceId }, // Don't send device's own events back
        status: { in: ['APPLIED', 'ACKED'] },
        ...(entityTypes && { entityType: { in: entityTypes } }),
        ...(cursor && { id: { gt: cursor } }),
      },
      orderBy: { appliedAt: 'asc' },
      take: pullLimit + 1, // Get one extra to check hasMore
      select: {
        id: true,
        entityType: true,
        entityId: true,
        action: true,
        payload: true,
        occurredAt: true,
        userId: true,
        deviceId: true,
      },
    });

    const hasMore = events.length > pullLimit;
    const resultEvents = hasMore ? events.slice(0, pullLimit) : events;
    const nextCursor = hasMore ? resultEvents[resultEvents.length - 1].id : undefined;

    // Convert to response format
    const serverEvents: ServerEventDto[] = resultEvents.map((e) => ({
      id: e.id,
      entityType: e.entityType,
      entityId: e.entityId,
      action: e.action,
      payload: e.payload as Record<string, unknown>,
      occurredAt: e.occurredAt.toISOString(),
      userId: e.userId,
      sourceDeviceId: e.deviceId,
    }));

    // Check for cache invalidations
    const cacheInvalidations = await this.getCacheInvalidations(sinceDate);

    // Get device status
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { isActive: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });

    // Update device sync state
    await this.updateDeviceSyncState(deviceId, 'pull');

    // Log security event
    await this.prisma.securityLog.create({
      data: {
        action: 'SYNC_PULL',
        userId,
        deviceId,
        details: {
          since,
          eventCount: serverEvents.length,
          hasMore,
          durationMs: Date.now() - startTime,
        },
        success: true,
      },
    });

    this.logger.log(
      `Pull completed - Device: ${deviceId}, Events: ${serverEvents.length}, HasMore: ${hasMore}, Duration: ${Date.now() - startTime}ms`,
    );

    return {
      events: serverEvents,
      hasMore,
      nextCursor,
      serverTime: new Date().toISOString(),
      cacheInvalidations,
      deviceStatus: {
        isActive: device?.isActive ?? false,
        requiresReauth: !user?.isActive,
        message: !device?.isActive
          ? 'Device révoqué'
          : !user?.isActive
            ? 'Compte désactivé'
            : undefined,
      },
    };
  }

  /**
   * Get sync status for device
   */
  async getStatus(deviceId: string, userId: string): Promise<SyncStatusResponseDto> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        isActive: true,
        lastSyncAt: true,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        role: true,
      },
    });

    const syncState = await this.prisma.syncState.findUnique({
      where: { deviceId },
    });

    // Count pending events for this device
    const pendingEvents = await this.prisma.syncEvent.count({
      where: {
        deviceId,
        status: { in: ['PENDING', 'APPLIED'] },
      },
    });

    // Check if sync is required (events pending from other devices)
    const syncRequired = await this.checkSyncRequired(deviceId, syncState?.lastPullAt);

    return {
      serverHealthy: true,
      serverTime: new Date().toISOString(),
      device: {
        id: deviceId,
        isActive: device?.isActive ?? false,
        lastPushAt: syncState?.lastPushAt?.toISOString() ?? null,
        lastPullAt: syncState?.lastPullAt?.toISOString() ?? null,
        pendingEvents,
      },
      user: {
        id: userId,
        isActive: user?.isActive ?? false,
        role: user?.role ?? 'COMMERCIAL',
      },
      syncRequired,
      maintenanceMode: false,
    };
  }

  /**
   * Bootstrap initial data for mobile
   */
  async bootstrap(
    dto: BootstrapRequestDto,
    userId: string,
  ): Promise<BootstrapResponseDto> {
    const { deviceId, entities, forceFull } = dto;
    const result: BootstrapResponseDto = {
      serverTime: new Date().toISOString(),
      dataVersion: new Date().toISOString().split('T')[0],
    };

    for (const entity of entities) {
      switch (entity.toLowerCase()) {
        case 'products':
        case 'products_pf':
          result.productsPf = await this.prisma.productPf.findMany({
            where: { isActive: true },
            select: {
              id: true,
              code: true,
              name: true,
              shortName: true,
              unit: true,
              priceHt: true,
              minStock: true,
              weightGrams: true,
              brand: { select: { name: true } },
              family: { select: { name: true } },
            },
          });
          break;

        case 'clients':
          result.clients = await this.prisma.client.findMany({
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              phone: true,
              address: true,
              nif: true,
              rc: true,
            },
          });
          break;

        case 'deliveries':
        case 'deliveries_pending':
          result.deliveriesPending = await this.prisma.delivery.findMany({
            where: { status: 'PENDING' },
            select: {
              id: true,
              reference: true,
              invoiceId: true,
              clientId: true,
              qrCode: true,
              scheduledDate: true,
              deliveryAddress: true,
              client: {
                select: { name: true, address: true },
              },
              invoice: {
                select: { reference: true, totalTtc: true },
              },
            },
          });
          break;

        case 'stock':
        case 'stock_pf':
          // Aggregate stock by product
          const stockAgg = await this.prisma.lotPf.groupBy({
            by: ['productId'],
            _sum: { quantityRemaining: true },
            where: { isActive: true },
          });

          const products = await this.prisma.productPf.findMany({
            where: { isActive: true },
            select: {
              id: true,
              code: true,
              name: true,
              minStock: true,
              unit: true,
            },
          });

          result.stockPf = products.map((p) => {
            const stock = stockAgg.find((s) => s.productId === p.id);
            const currentStock = stock?._sum.quantityRemaining ?? 0;
            return {
              productId: p.id,
              productCode: p.code,
              productName: p.name,
              currentStock,
              minStock: p.minStock,
              unit: p.unit,
              status:
                currentStock === 0
                  ? 'OUT'
                  : currentStock < p.minStock
                    ? 'LOW'
                    : 'OK',
            };
          });
          break;
      }
    }

    // Suggest next bootstrap time (6 AM next day)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0);
    result.nextBootstrapRecommended = tomorrow.toISOString();

    this.logger.log(
      `Bootstrap completed - Device: ${deviceId}, Entities: ${entities.join(', ')}`,
    );

    return result;
  }

  /**
   * Acknowledge events have been processed by mobile
   */
  async acknowledgeEvents(
    dto: AckEventsDto,
    userId: string,
  ): Promise<AckEventsResponseDto> {
    const { deviceId, eventIds } = dto;

    const ackedCount = await this.idempotencyService.acknowledgeEvents(
      eventIds,
      deviceId,
    );

    return {
      success: true,
      ackedCount,
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Update device sync state
   */
  private async updateDeviceSyncState(
    deviceId: string,
    type: 'push' | 'pull',
  ): Promise<void> {
    const now = new Date();

    await this.prisma.syncState.upsert({
      where: { deviceId },
      create: {
        deviceId,
        lastPullAt: type === 'pull' ? now : new Date(0),
        lastPushAt: type === 'push' ? now : undefined,
        serverTime: now,
      },
      update: {
        ...(type === 'pull' && { lastPullAt: now }),
        ...(type === 'push' && { lastPushAt: now }),
        serverTime: now,
      },
    });

    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSyncAt: now },
    });
  }

  /**
   * Check if device needs to sync
   */
  private async checkSyncRequired(
    deviceId: string,
    lastPullAt?: Date | null,
  ): Promise<boolean> {
    if (!lastPullAt) return true;

    const newEvents = await this.prisma.syncEvent.count({
      where: {
        appliedAt: { gt: lastPullAt },
        deviceId: { not: deviceId },
        status: { in: ['APPLIED', 'ACKED'] },
      },
    });

    return newEvents > 0;
  }

  /**
   * Get cache invalidations since last sync
   */
  private async getCacheInvalidations(
    since: Date,
  ): Promise<{ entityType: string; entityIds: string[]; reason: string }[]> {
    const invalidations: { entityType: string; entityIds: string[]; reason: string }[] = [];

    // Check for price changes
    const priceChanges = await this.prisma.productPf.findMany({
      where: { updatedAt: { gt: since } },
      select: { id: true },
    });

    if (priceChanges.length > 0) {
      invalidations.push({
        entityType: 'PRODUCT_PF',
        entityIds: priceChanges.length > 10 ? ['*'] : priceChanges.map((p) => String(p.id)),
        reason: 'Mise à jour produits',
      });
    }

    // Check for client changes
    const clientChanges = await this.prisma.client.findMany({
      where: { updatedAt: { gt: since } },
      select: { id: true },
    });

    if (clientChanges.length > 0) {
      invalidations.push({
        entityType: 'CLIENT',
        entityIds: clientChanges.length > 10 ? ['*'] : clientChanges.map((c) => String(c.id)),
        reason: 'Mise à jour clients',
      });
    }

    return invalidations;
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(errorCode?: ConflictErrorCode): boolean {
    const nonRetryableCodes = [
      ConflictErrorCode.ALREADY_VALIDATED,
      ConflictErrorCode.ALREADY_CANCELLED,
      ConflictErrorCode.ENTITY_NOT_FOUND,
      ConflictErrorCode.DUPLICATE_EVENT,
      ConflictErrorCode.INVOICE_ALREADY_PAID,
    ];

    return !errorCode || !nonRetryableCodes.includes(errorCode);
  }
}
