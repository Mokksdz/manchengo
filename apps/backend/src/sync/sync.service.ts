import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from '../auth/devices.service';
import { EventApplierService } from './event-applier.service';
import {
  PushEventsDto,
  PushEventsResponseDto,
  PullEventsQueryDto,
  PullEventsResponseDto,
  SyncEventDto,
} from './dto/sync.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private devicesService: DevicesService,
    private eventApplier: EventApplierService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PUSH SYNC (Mobile → Server)
  // ═══════════════════════════════════════════════════════════════════════════

  async pushEvents(dto: PushEventsDto): Promise<PushEventsResponseDto> {
    const { device_id, events } = dto;

    // Verify device exists and is active
    const device = await this.prisma.device.findUnique({
      where: { id: device_id },
    });

    if (!device || !device.isActive) {
      throw new BadRequestException('Appareil non autorisé');
    }

    const ackedEventIds: string[] = [];
    const failedEventIds: string[] = [];

    for (const event of events) {
      try {
        const applied = await this.processEvent(device_id, event);
        if (applied) {
          ackedEventIds.push(event.id);
        } else {
          // Event already exists (idempotent)
          ackedEventIds.push(event.id);
        }
      } catch (error) {
        this.logger.error(`Failed to process event ${event.id}: ${error}`);
        failedEventIds.push(event.id);
      }
    }

    // Update device last sync
    await this.devicesService.updateLastSync(device_id);

    this.logger.log(
      `Push sync: device=${device_id}, acked=${ackedEventIds.length}, failed=${failedEventIds.length}`,
    );

    return {
      acked_event_ids: ackedEventIds,
      failed_event_ids: failedEventIds.length > 0 ? failedEventIds : undefined,
    };
  }

  // Process single event (idempotent)
  private async processEvent(deviceId: string, event: SyncEventDto): Promise<boolean> {
    // Check if event already exists (idempotent) by clientEventId
    const existing = await this.prisma.syncEvent.findUnique({
      where: { clientEventId: event.id },
    });

    if (existing) {
      this.logger.debug(`Event ${event.id} already processed, skipping`);
      return false;
    }

    // Generate payload hash for integrity
    const crypto = await import('crypto');
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(event.payload))
      .digest('hex');

    // Store event and apply to tables in transaction
    await this.prisma.executeInTransaction(async (tx) => {
      // 1. Store the event
      await tx.syncEvent.create({
        data: {
          clientEventId: event.id,
          entityType: event.entity_type,
          entityId: event.entity_id,
          action: event.action,
          payload: event.payload,
          payloadHash: payloadHash,
          occurredAt: new Date(event.occurred_at),
          deviceId: deviceId,
          userId: String(event.user_id),
          appliedAt: new Date(),
        },
      });

      // 2. Apply event to relational tables
      await this.eventApplier.applyEvent(tx, event);
    });

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PULL SYNC (Server → Mobile)
  // ═══════════════════════════════════════════════════════════════════════════

  async pullEvents(query: PullEventsQueryDto): Promise<PullEventsResponseDto> {
    const { device_id, since } = query;

    // Verify device
    const device = await this.prisma.device.findUnique({
      where: { id: device_id },
    });

    if (!device || !device.isActive) {
      throw new BadRequestException('Appareil non autorisé');
    }

    // Fetch events since timestamp, excluding events from this device
    const whereClause: any = {
      deviceId: { not: device_id }, // Don't send back device's own events
    };

    if (since) {
      whereClause.occurredAt = { gt: new Date(since) };
    }

    const events = await this.prisma.syncEvent.findMany({
      where: whereClause,
      orderBy: { occurredAt: 'asc' },
      take: 100, // Batch size
    });

    // Update sync state for device
    await this.updateSyncState(device_id);

    const serverTime = new Date().toISOString();

    this.logger.log(`Pull sync: device=${device_id}, events=${events.length}`);

    return {
      events: events.map((e) => ({
        id: e.id,
        entity_type: e.entityType,
        entity_id: e.entityId,
        action: e.action,
        payload: e.payload as Record<string, any>,
        occurred_at: e.occurredAt.toISOString(),
        user_id: parseInt(e.userId, 10),
      })),
      server_time: serverTime,
    };
  }

  // Update device sync state
  private async updateSyncState(deviceId: string): Promise<void> {
    const now = new Date();
    await this.prisma.syncState.upsert({
      where: { deviceId },
      update: {
        lastPullAt: now,
        serverTime: now,
      },
      create: {
        deviceId,
        lastPullAt: now,
        serverTime: now,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  async getPendingEventsCount(): Promise<number> {
    return this.prisma.syncEvent.count({
      where: { appliedAt: null },
    });
  }

  async getRecentEvents(limit = 50) {
    return this.prisma.syncEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        device: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async getDeviceSyncStatus() {
    return this.prisma.device.findMany({
      select: {
        id: true,
        name: true,
        platform: true,
        lastSyncAt: true,
        isActive: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        syncStates: {
          select: {
            lastPullAt: true,
            pendingEvents: true,
          },
        },
      },
      orderBy: { lastSyncAt: 'desc' },
    });
  }
}
