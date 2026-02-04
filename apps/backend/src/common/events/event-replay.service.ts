/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EVENT REPLAY SERVICE — Reconstruction d'état et replay
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Service de replay d'événements pour:
 * - Reconstruire l'état d'un aggregate
 * - Projeter des événements vers des vues matérialisées
 * - Corriger des incohérences de données
 * - Debug et investigation
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger';
import { EventStoreService, DomainEvent, EventType, EventCategory } from './event-store.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type StateReducer<TState, TEvent = unknown> = (
  state: TState,
  event: DomainEvent<TEvent>,
) => TState;

export interface ReplayOptions {
  fromVersion?: number;
  toVersion?: number;
  fromDate?: Date;
  toDate?: Date;
  eventTypes?: EventType[];
  batchSize?: number;
  onProgress?: (processed: number, total: number) => void;
}

export interface ReplayResult<TState> {
  finalState: TState;
  eventsProcessed: number;
  lastVersion: number;
  duration: number;
}

export interface AggregateSnapshot<TState> {
  aggregateType: string;
  aggregateId: string;
  state: TState;
  version: number;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class EventReplayService {
  constructor(
    private readonly eventStore: EventStoreService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('EventReplayService');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // AGGREGATE RECONSTRUCTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Reconstruit l'état d'un aggregate à partir de ses événements
   */
  async reconstructAggregate<TState>(
    aggregateType: string,
    aggregateId: string,
    initialState: TState,
    reducer: StateReducer<TState>,
    options: ReplayOptions = {},
  ): Promise<ReplayResult<TState>> {
    const startTime = Date.now();

    this.logger.info(`Reconstructing aggregate ${aggregateType}:${aggregateId}`, 'EventReplayService');

    const events = await this.eventStore.getByAggregate(
      aggregateType,
      aggregateId,
      options.fromVersion,
    );

    let state = initialState;
    let eventsProcessed = 0;
    let lastVersion = options.fromVersion || 0;

    for (const event of events) {
      // Filtrer par version max
      if (options.toVersion && event.version > options.toVersion) {
        break;
      }

      // Filtrer par date
      if (options.toDate && event.createdAt > options.toDate) {
        break;
      }

      // Filtrer par types d'événements
      if (options.eventTypes && !options.eventTypes.includes(event.type)) {
        continue;
      }

      state = reducer(state, event);
      eventsProcessed++;
      lastVersion = event.version;

      if (options.onProgress) {
        options.onProgress(eventsProcessed, events.length);
      }
    }

    const duration = Date.now() - startTime;

    this.logger.info(
      `Aggregate reconstructed: ${eventsProcessed} events in ${duration}ms`,
      'EventReplayService',
      { aggregateType, aggregateId, lastVersion },
    );

    return {
      finalState: state,
      eventsProcessed,
      lastVersion,
      duration,
    };
  }

  /**
   * Reconstruit l'état à un point spécifique dans le temps
   */
  async reconstructAtPointInTime<TState>(
    aggregateType: string,
    aggregateId: string,
    initialState: TState,
    reducer: StateReducer<TState>,
    pointInTime: Date,
  ): Promise<ReplayResult<TState>> {
    return this.reconstructAggregate(
      aggregateType,
      aggregateId,
      initialState,
      reducer,
      { toDate: pointInTime },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PROJECTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Projette tous les événements vers un état
   */
  async project<TState>(
    initialState: TState,
    reducer: StateReducer<TState>,
    options: ReplayOptions = {},
  ): Promise<ReplayResult<TState>> {
    const startTime = Date.now();
    const batchSize = options.batchSize || 1000;

    this.logger.info('Starting full projection', 'EventReplayService', {
      fromVersion: options.fromVersion,
      toVersion: options.toVersion,
      eventTypes: options.eventTypes,
    });

    let state = initialState;
    let eventsProcessed = 0;
    let lastVersion = options.fromVersion || 0;

    for await (const eventBatch of this.eventStore.streamFromVersion(lastVersion, batchSize)) {
      for (const event of eventBatch) {
        // Filtrer par version max
        if (options.toVersion && event.version > options.toVersion) {
          const duration = Date.now() - startTime;
          return {
            finalState: state,
            eventsProcessed,
            lastVersion,
            duration,
          };
        }

        // Filtrer par date
        if (options.toDate && event.createdAt > options.toDate) {
          continue;
        }

        // Filtrer par types d'événements
        if (options.eventTypes && !options.eventTypes.includes(event.type)) {
          continue;
        }

        state = reducer(state, event);
        eventsProcessed++;
        lastVersion = event.version;
      }

      if (options.onProgress) {
        options.onProgress(eventsProcessed, -1); // -1 car total inconnu
      }

      this.logger.debug(`Projected ${eventsProcessed} events so far`, 'EventReplayService');
    }

    const duration = Date.now() - startTime;

    this.logger.info(
      `Projection completed: ${eventsProcessed} events in ${duration}ms`,
      'EventReplayService',
      { lastVersion },
    );

    return {
      finalState: state,
      eventsProcessed,
      lastVersion,
      duration,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STOCK REPLAY - Use case spécifique ERP
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Reconstruit l'historique de stock d'une MP
   */
  async reconstructMpStockHistory(
    mpId: number,
    options: { fromDate?: Date; toDate?: Date } = {},
  ): Promise<{
    history: Array<{
      date: Date;
      eventType: EventType;
      quantity: number;
      balance: number;
      metadata: unknown;
    }>;
    finalBalance: number;
    totalIn: number;
    totalOut: number;
  }> {
    const history: Array<{
      date: Date;
      eventType: EventType;
      quantity: number;
      balance: number;
      metadata: unknown;
    }> = [];

    let balance = 0;
    let totalIn = 0;
    let totalOut = 0;

    const result = await this.eventStore.search({
      aggregateType: 'ProductMp',
      aggregateId: String(mpId),
      categories: [EventCategory.STOCK],
      fromDate: options.fromDate,
      toDate: options.toDate,
      limit: 10000,
    });

    for (const event of result.events) {
      const payload = event.payload as { quantity?: number; movementType?: string };
      const quantity = payload.quantity || 0;
      const isIn = payload.movementType === 'IN' || event.type === EventType.STOCK_RECEIVED;

      if (isIn) {
        balance += quantity;
        totalIn += quantity;
      } else {
        balance -= quantity;
        totalOut += quantity;
      }

      history.push({
        date: event.createdAt,
        eventType: event.type,
        quantity: isIn ? quantity : -quantity,
        balance,
        metadata: event.metadata,
      });
    }

    return {
      history,
      finalBalance: balance,
      totalIn,
      totalOut,
    };
  }

  /**
   * Reconstruit l'historique de production
   */
  async reconstructProductionHistory(
    options: { fromDate?: Date; toDate?: Date; recipeId?: number } = {},
  ): Promise<{
    orders: Array<{
      orderId: string;
      recipeName: string;
      status: string;
      plannedQty: number;
      actualQty: number;
      createdAt: Date;
      completedAt?: Date;
      events: DomainEvent[];
    }>;
    stats: {
      totalOrders: number;
      completed: number;
      cancelled: number;
      averageCompletionTime: number;
    };
  }> {
    const result = await this.eventStore.search({
      categories: [EventCategory.PRODUCTION],
      fromDate: options.fromDate,
      toDate: options.toDate,
      limit: 10000,
    });

    const orderMap = new Map<string, {
      orderId: string;
      recipeName: string;
      status: string;
      plannedQty: number;
      actualQty: number;
      createdAt: Date;
      completedAt?: Date;
      events: DomainEvent[];
    }>();

    for (const event of result.events) {
      const payload = event.payload as any;
      const orderId = payload.orderId || event.aggregateId;

      if (!orderMap.has(orderId)) {
        orderMap.set(orderId, {
          orderId,
          recipeName: payload.recipeName || 'Unknown',
          status: 'CREATED',
          plannedQty: payload.plannedQuantity || 0,
          actualQty: 0,
          createdAt: event.createdAt,
          events: [],
        });
      }

      const order = orderMap.get(orderId)!;
      order.events.push(event);

      switch (event.type) {
        case EventType.PRODUCTION_ORDER_STARTED:
          order.status = 'IN_PROGRESS';
          break;
        case EventType.PRODUCTION_ORDER_COMPLETED:
          order.status = 'COMPLETED';
          order.completedAt = event.createdAt;
          order.actualQty = payload.actualQuantity || order.plannedQty;
          break;
        case EventType.PRODUCTION_ORDER_CANCELLED:
          order.status = 'CANCELLED';
          break;
      }
    }

    const orders = Array.from(orderMap.values());
    const completed = orders.filter((o) => o.status === 'COMPLETED');
    const cancelled = orders.filter((o) => o.status === 'CANCELLED');

    // Calculer le temps moyen de complétion
    let totalCompletionTime = 0;
    let completedWithTime = 0;
    for (const order of completed) {
      if (order.completedAt) {
        totalCompletionTime += order.completedAt.getTime() - order.createdAt.getTime();
        completedWithTime++;
      }
    }

    return {
      orders,
      stats: {
        totalOrders: orders.length,
        completed: completed.length,
        cancelled: cancelled.length,
        averageCompletionTime: completedWithTime > 0
          ? totalCompletionTime / completedWithTime / (1000 * 60) // en minutes
          : 0,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VERIFICATION & DEBUGGING
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Vérifie la cohérence entre l'état actuel et les événements
   */
  async verifyConsistency<TState>(
    aggregateType: string,
    aggregateId: string,
    currentState: TState,
    initialState: TState,
    reducer: StateReducer<TState>,
    comparator: (a: TState, b: TState) => boolean,
  ): Promise<{
    isConsistent: boolean;
    reconstructedState: TState;
    differences?: string;
  }> {
    const result = await this.reconstructAggregate(
      aggregateType,
      aggregateId,
      initialState,
      reducer,
    );

    const isConsistent = comparator(currentState, result.finalState);

    return {
      isConsistent,
      reconstructedState: result.finalState,
      differences: isConsistent ? undefined : 'States do not match',
    };
  }

  /**
   * Génère un rapport de timeline pour un aggregate
   */
  async generateTimeline(
    aggregateType: string,
    aggregateId: string,
  ): Promise<{
    events: Array<{
      timestamp: Date;
      type: EventType;
      description: string;
      userId?: string;
      metadata: unknown;
    }>;
    summary: {
      totalEvents: number;
      firstEvent: Date | null;
      lastEvent: Date | null;
      eventTypes: Record<string, number>;
    };
  }> {
    const events = await this.eventStore.getByAggregate(aggregateType, aggregateId);

    const timeline = events.map((e) => ({
      timestamp: e.createdAt,
      type: e.type,
      description: this.getEventDescription(e),
      userId: e.metadata.userId,
      metadata: e.payload,
    }));

    const eventTypeCounts: Record<string, number> = {};
    for (const e of events) {
      eventTypeCounts[e.type] = (eventTypeCounts[e.type] || 0) + 1;
    }

    return {
      events: timeline,
      summary: {
        totalEvents: events.length,
        firstEvent: events.length > 0 ? events[0].createdAt : null,
        lastEvent: events.length > 0 ? events[events.length - 1].createdAt : null,
        eventTypes: eventTypeCounts,
      },
    };
  }

  /**
   * Génère une description lisible d'un événement
   */
  private getEventDescription(event: DomainEvent): string {
    const payload = event.payload as any;

    switch (event.type) {
      case EventType.STOCK_RECEIVED:
        return `Réception de ${payload.quantity} ${payload.unit || 'unités'}`;
      case EventType.STOCK_CONSUMED:
        return `Consommation de ${payload.quantity} ${payload.unit || 'unités'}`;
      case EventType.STOCK_ADJUSTED:
        return `Ajustement de stock: ${payload.adjustment}`;
      case EventType.PRODUCTION_ORDER_CREATED:
        return `Ordre de production créé: ${payload.orderNumber}`;
      case EventType.PRODUCTION_ORDER_STARTED:
        return 'Production démarrée';
      case EventType.PRODUCTION_ORDER_COMPLETED:
        return `Production complétée: ${payload.actualQuantity} unités`;
      case EventType.ALERT_CREATED:
        return `Alerte créée: ${payload.message}`;
      case EventType.ALERT_ACKNOWLEDGED:
        return 'Alerte accusée';
      default:
        return event.type;
    }
  }
}
