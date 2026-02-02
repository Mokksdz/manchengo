import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncStatus } from '@prisma/client';
import * as crypto from 'crypto';

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  existingEvent?: {
    id: string;
    clientEventId: string;
    status: SyncStatus;
    appliedAt: Date | null;
    errorCode: string | null;
    resolution: unknown;
  };
}

export interface IdempotencyBatchResult {
  newEvents: string[];
  duplicateEvents: Map<string, IdempotencyCheckResult>;
}

@Injectable()
export class SyncIdempotencyService {
  private readonly logger = new Logger(SyncIdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a single event has already been processed
   */
  async checkEvent(clientEventId: string): Promise<IdempotencyCheckResult> {
    const existing = await this.prisma.syncEvent.findUnique({
      where: { clientEventId },
      select: {
        id: true,
        clientEventId: true,
        status: true,
        appliedAt: true,
        errorCode: true,
        resolution: true,
      },
    });

    if (existing) {
      this.logger.debug(
        `Duplicate event detected: ${clientEventId} (status: ${existing.status})`,
      );
      return {
        isDuplicate: true,
        existingEvent: existing,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Check multiple events for duplicates in a single query
   */
  async checkBatch(clientEventIds: string[]): Promise<IdempotencyBatchResult> {
    const existingEvents = await this.prisma.syncEvent.findMany({
      where: {
        clientEventId: { in: clientEventIds },
      },
      select: {
        id: true,
        clientEventId: true,
        status: true,
        appliedAt: true,
        errorCode: true,
        resolution: true,
      },
    });

    const existingMap = new Map(
      existingEvents.map((e) => [e.clientEventId, e]),
    );

    const duplicateEvents = new Map<string, IdempotencyCheckResult>();
    const newEvents: string[] = [];

    for (const clientEventId of clientEventIds) {
      const existing = existingMap.get(clientEventId);
      if (existing) {
        duplicateEvents.set(clientEventId, {
          isDuplicate: true,
          existingEvent: existing,
        });
      } else {
        newEvents.push(clientEventId);
      }
    }

    if (duplicateEvents.size > 0) {
      this.logger.debug(
        `Batch idempotency check: ${newEvents.length} new, ${duplicateEvents.size} duplicates`,
      );
    }

    return { newEvents, duplicateEvents };
  }

  /**
   * Check if a batch has already been processed
   */
  async checkBatchId(batchId: string): Promise<{
    isProcessed: boolean;
    eventCount: number;
  }> {
    const count = await this.prisma.syncEvent.count({
      where: { batchId },
    });

    return {
      isProcessed: count > 0,
      eventCount: count,
    };
  }

  /**
   * Generate payload hash for integrity verification
   */
  generatePayloadHash(payload: Record<string, unknown>): string {
    const normalized = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Verify payload integrity
   */
  verifyPayloadHash(
    payload: Record<string, unknown>,
    providedHash: string,
  ): boolean {
    const computedHash = this.generatePayloadHash(payload);
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(providedHash),
    );

    if (!isValid) {
      this.logger.warn(
        `Payload hash mismatch - Provided: ${providedHash.substring(0, 16)}..., Computed: ${computedHash.substring(0, 16)}...`,
      );
    }

    return isValid;
  }

  /**
   * Handle crash recovery - find events that were received but not ACKed
   */
  async findUnackedEvents(
    deviceId: string,
    since: Date,
  ): Promise<
    {
      id: string;
      clientEventId: string;
      status: SyncStatus;
      appliedAt: Date | null;
    }[]
  > {
    return this.prisma.syncEvent.findMany({
      where: {
        deviceId,
        createdAt: { gte: since },
        status: { in: ['PENDING', 'APPLIED'] },
      },
      select: {
        id: true,
        clientEventId: true,
        status: true,
        appliedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Mark events as acknowledged
   */
  async acknowledgeEvents(
    clientEventIds: string[],
    deviceId: string,
  ): Promise<number> {
    const result = await this.prisma.syncEvent.updateMany({
      where: {
        clientEventId: { in: clientEventIds },
        deviceId,
        status: 'APPLIED',
      },
      data: {
        status: 'ACKED',
      },
    });

    this.logger.debug(
      `Acknowledged ${result.count} events for device ${deviceId}`,
    );

    return result.count;
  }

  /**
   * Get the server event ID for a client event ID
   */
  async getServerEventId(clientEventId: string): Promise<string | null> {
    const event = await this.prisma.syncEvent.findUnique({
      where: { clientEventId },
      select: { id: true },
    });

    return event?.id ?? null;
  }

  /**
   * Clean up old acknowledged events (retention policy)
   */
  async cleanupOldEvents(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.syncEvent.deleteMany({
      where: {
        status: 'ACKED',
        createdAt: { lt: cutoffDate },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} old acknowledged events`);
    }

    return result.count;
  }
}
