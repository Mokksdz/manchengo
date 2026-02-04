/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EVENT STORE SERVICE — Persistence des événements
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Service central de stockage et récupération des événements.
 *
 * PRINCIPES:
 * - Append-only: Les événements ne sont jamais modifiés ou supprimés
 * - Ordonnés: Chaque événement a un numéro de séquence global
 * - Immutables: Les événements sont figés une fois créés
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../logger';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Catégories d'événements
 */
export enum EventCategory {
  STOCK = 'STOCK',
  PRODUCTION = 'PRODUCTION',
  APPRO = 'APPRO',
  SUPPLIER = 'SUPPLIER',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}

/**
 * Types d'événements par catégorie
 */
export enum EventType {
  // Stock Events
  STOCK_RECEIVED = 'STOCK_RECEIVED',
  STOCK_CONSUMED = 'STOCK_CONSUMED',
  STOCK_ADJUSTED = 'STOCK_ADJUSTED',
  STOCK_TRANSFERRED = 'STOCK_TRANSFERRED',
  LOT_CREATED = 'LOT_CREATED',
  LOT_CONSUMED = 'LOT_CONSUMED',
  LOT_EXPIRED = 'LOT_EXPIRED',

  // Production Events
  PRODUCTION_ORDER_CREATED = 'PRODUCTION_ORDER_CREATED',
  PRODUCTION_ORDER_STARTED = 'PRODUCTION_ORDER_STARTED',
  PRODUCTION_ORDER_COMPLETED = 'PRODUCTION_ORDER_COMPLETED',
  PRODUCTION_ORDER_CANCELLED = 'PRODUCTION_ORDER_CANCELLED',
  RECIPE_CREATED = 'RECIPE_CREATED',
  RECIPE_UPDATED = 'RECIPE_UPDATED',

  // APPRO Events
  ALERT_CREATED = 'ALERT_CREATED',
  ALERT_ACKNOWLEDGED = 'ALERT_ACKNOWLEDGED',
  ALERT_RESOLVED = 'ALERT_RESOLVED',
  PURCHASE_ORDER_CREATED = 'PURCHASE_ORDER_CREATED',
  PURCHASE_ORDER_VALIDATED = 'PURCHASE_ORDER_VALIDATED',
  PURCHASE_ORDER_RECEIVED = 'PURCHASE_ORDER_RECEIVED',

  // Supplier Events
  SUPPLIER_CREATED = 'SUPPLIER_CREATED',
  SUPPLIER_UPDATED = 'SUPPLIER_UPDATED',
  SUPPLIER_GRADE_CHANGED = 'SUPPLIER_GRADE_CHANGED',
  SUPPLIER_DEACTIVATED = 'SUPPLIER_DEACTIVATED',

  // User Events
  USER_LOGGED_IN = 'USER_LOGGED_IN',
  USER_LOGGED_OUT = 'USER_LOGGED_OUT',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_PERMISSIONS_CHANGED = 'USER_PERMISSIONS_CHANGED',

  // System Events
  SYSTEM_STARTUP = 'SYSTEM_STARTUP',
  SYSTEM_SHUTDOWN = 'SYSTEM_SHUTDOWN',
  CONFIG_CHANGED = 'CONFIG_CHANGED',
  SYNC_COMPLETED = 'SYNC_COMPLETED',
}

/**
 * Structure d'un événement domain
 */
export interface DomainEvent<T = unknown> {
  id: string;
  version: number;
  type: EventType;
  category: EventCategory;
  aggregateType: string;
  aggregateId: string;
  payload: T;
  metadata: EventMetadata;
  createdAt: Date;
}

/**
 * Métadonnées d'un événement
 */
export interface EventMetadata {
  userId?: string;
  userRole?: string;
  requestId?: string;
  correlationId?: string;
  causationId?: string;
  ipAddress?: string;
  userAgent?: string;
  source?: string;
}

/**
 * Critères de recherche d'événements
 */
export interface EventSearchCriteria {
  aggregateType?: string;
  aggregateId?: string;
  eventTypes?: EventType[];
  categories?: EventCategory[];
  userId?: string;
  correlationId?: string;
  fromDate?: Date;
  toDate?: Date;
  fromVersion?: number;
  toVersion?: number;
  limit?: number;
  offset?: number;
}

/**
 * Résultat de recherche paginé
 */
export interface EventSearchResult {
  events: DomainEvent[];
  total: number;
  hasMore: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class EventStoreService implements OnModuleInit {
  private currentVersion = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('EventStoreService');
  }

  async onModuleInit() {
    // Récupérer la dernière version
    await this.initializeVersion();
    this.logger.info(`Event store initialized, current version: ${this.currentVersion}`, 'EventStoreService');
  }

  /**
   * Initialise la version courante depuis la DB
   */
  private async initializeVersion(): Promise<void> {
    const lastEvent = await this.prisma.domainEvent.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    this.currentVersion = lastEvent?.version ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // APPEND EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Ajoute un événement à l'event store
   */
  async append<T>(
    type: EventType,
    category: EventCategory,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    metadata: EventMetadata = {},
  ): Promise<DomainEvent<T>> {
    const event: DomainEvent<T> = {
      id: uuidv4(),
      version: ++this.currentVersion,
      type,
      category,
      aggregateType,
      aggregateId,
      payload,
      metadata: {
        ...metadata,
        correlationId: metadata.correlationId || uuidv4(),
      },
      createdAt: new Date(),
    };

    try {
      await this.prisma.domainEvent.create({
        data: {
          id: event.id,
          version: event.version,
          type: event.type,
          category: event.category,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payload: event.payload as any,
          metadata: event.metadata as any,
          createdAt: event.createdAt,
        },
      });

      this.logger.debug(`Event appended: ${type}`, 'EventStoreService', {
        eventId: event.id,
        version: event.version,
        aggregateType,
        aggregateId,
      });

      return event;
    } catch (error) {
      // Rollback version on failure
      this.currentVersion--;

      this.logger.error(
        `Failed to append event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
        'EventStoreService',
      );

      throw error;
    }
  }

  /**
   * Ajoute plusieurs événements en transaction
   */
  async appendBatch<T>(
    events: Array<{
      type: EventType;
      category: EventCategory;
      aggregateType: string;
      aggregateId: string;
      payload: T;
      metadata?: EventMetadata;
    }>,
    correlationId?: string,
  ): Promise<DomainEvent<T>[]> {
    const correlation = correlationId || uuidv4();
    const domainEvents: DomainEvent<T>[] = [];

    const eventData = events.map((e) => {
      const event: DomainEvent<T> = {
        id: uuidv4(),
        version: ++this.currentVersion,
        type: e.type,
        category: e.category,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        payload: e.payload,
        metadata: {
          ...e.metadata,
          correlationId: correlation,
        },
        createdAt: new Date(),
      };
      domainEvents.push(event);
      return event;
    });

    try {
      await this.prisma.domainEvent.createMany({
        data: eventData.map((e) => ({
          id: e.id,
          version: e.version,
          type: e.type,
          category: e.category,
          aggregateType: e.aggregateType,
          aggregateId: e.aggregateId,
          payload: e.payload as any,
          metadata: e.metadata as any,
          createdAt: e.createdAt,
        })),
      });

      this.logger.info(`Batch of ${events.length} events appended`, 'EventStoreService', {
        correlationId: correlation,
      });

      return domainEvents;
    } catch (error) {
      // Rollback versions
      this.currentVersion -= events.length;

      this.logger.error(
        `Failed to append batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
        'EventStoreService',
      );

      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // READ EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Récupère un événement par ID
   */
  async getById(eventId: string): Promise<DomainEvent | null> {
    const event = await this.prisma.domainEvent.findUnique({
      where: { id: eventId },
    });

    return event ? this.mapToDomainEvent(event) : null;
  }

  /**
   * Récupère les événements d'un aggregate
   */
  async getByAggregate(
    aggregateType: string,
    aggregateId: string,
    fromVersion?: number,
  ): Promise<DomainEvent[]> {
    const events = await this.prisma.domainEvent.findMany({
      where: {
        aggregateType,
        aggregateId,
        ...(fromVersion && { version: { gt: fromVersion } }),
      },
      orderBy: { version: 'asc' },
    });

    return events.map((e) => this.mapToDomainEvent(e));
  }

  /**
   * Recherche des événements avec critères
   */
  async search(criteria: EventSearchCriteria): Promise<EventSearchResult> {
    const limit = Math.min(criteria.limit || 50, 1000);
    const offset = criteria.offset || 0;

    const where: any = {};

    if (criteria.aggregateType) where.aggregateType = criteria.aggregateType;
    if (criteria.aggregateId) where.aggregateId = criteria.aggregateId;
    if (criteria.eventTypes?.length) where.type = { in: criteria.eventTypes };
    if (criteria.categories?.length) where.category = { in: criteria.categories };
    if (criteria.userId) where.metadata = { path: ['userId'], equals: criteria.userId };
    if (criteria.correlationId) where.metadata = { path: ['correlationId'], equals: criteria.correlationId };

    if (criteria.fromDate || criteria.toDate) {
      where.createdAt = {
        ...(criteria.fromDate && { gte: criteria.fromDate }),
        ...(criteria.toDate && { lte: criteria.toDate }),
      };
    }

    if (criteria.fromVersion || criteria.toVersion) {
      where.version = {
        ...(criteria.fromVersion && { gte: criteria.fromVersion }),
        ...(criteria.toVersion && { lte: criteria.toVersion }),
      };
    }

    const [events, total] = await Promise.all([
      this.prisma.domainEvent.findMany({
        where,
        orderBy: { version: 'asc' },
        skip: offset,
        take: limit + 1, // +1 pour détecter hasMore
      }),
      this.prisma.domainEvent.count({ where }),
    ]);

    const hasMore = events.length > limit;
    if (hasMore) events.pop(); // Retirer l'élément en trop

    return {
      events: events.map((e) => this.mapToDomainEvent(e)),
      total,
      hasMore,
    };
  }

  /**
   * Stream d'événements à partir d'une version
   */
  async *streamFromVersion(fromVersion: number, batchSize = 100): AsyncGenerator<DomainEvent[]> {
    let currentFrom = fromVersion;
    let hasMore = true;

    while (hasMore) {
      const events = await this.prisma.domainEvent.findMany({
        where: { version: { gt: currentFrom } },
        orderBy: { version: 'asc' },
        take: batchSize,
      });

      if (events.length === 0) {
        hasMore = false;
      } else {
        yield events.map((e) => this.mapToDomainEvent(e));
        currentFrom = events[events.length - 1].version;
        hasMore = events.length === batchSize;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Statistiques de l'event store
   */
  async getStats(): Promise<{
    totalEvents: number;
    currentVersion: number;
    byCategory: Record<string, number>;
    byType: Record<string, number>;
    eventsLast24h: number;
    eventsLast7d: number;
  }> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalEvents,
      byCategory,
      byType,
      eventsLast24h,
      eventsLast7d,
    ] = await Promise.all([
      this.prisma.domainEvent.count(),
      this.prisma.domainEvent.groupBy({
        by: ['category'],
        _count: true,
      }),
      this.prisma.domainEvent.groupBy({
        by: ['type'],
        _count: true,
      }),
      this.prisma.domainEvent.count({
        where: { createdAt: { gte: yesterday } },
      }),
      this.prisma.domainEvent.count({
        where: { createdAt: { gte: lastWeek } },
      }),
    ]);

    return {
      totalEvents,
      currentVersion: this.currentVersion,
      byCategory: Object.fromEntries(byCategory.map((c) => [c.category, c._count])),
      byType: Object.fromEntries(byType.map((t) => [t.type, t._count])),
      eventsLast24h,
      eventsLast7d,
    };
  }

  /**
   * Récupère la version courante
   */
  getCurrentVersion(): number {
    return this.currentVersion;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Mappe un enregistrement DB vers DomainEvent
   */
  private mapToDomainEvent(record: any): DomainEvent {
    return {
      id: record.id,
      version: record.version,
      type: record.type as EventType,
      category: record.category as EventCategory,
      aggregateType: record.aggregateType,
      aggregateId: record.aggregateId,
      payload: record.payload,
      metadata: record.metadata as EventMetadata,
      createdAt: record.createdAt,
    };
  }
}
