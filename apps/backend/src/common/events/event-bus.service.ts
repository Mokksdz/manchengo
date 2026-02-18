/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EVENT BUS SERVICE — Publication et souscription aux événements
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Service de publication/souscription in-process pour les événements domain.
 *
 * FEATURES:
 * - Publication synchrone et asynchrone
 * - Handlers multiples par type d'événement
 * - Retry automatique en cas d'échec
 * - Logging et monitoring des handlers
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../logger';
import {
  EventStoreService,
  DomainEvent,
  EventType,
  EventCategory,
  EventMetadata,
} from './event-store.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

export interface EventSubscription {
  id: string;
  eventType: EventType | '*';
  handler: EventHandler;
  priority: number;
}

export interface PublishOptions {
  persist?: boolean; // Sauvegarder dans l'event store (défaut: true)
  async?: boolean; // Publier de manière asynchrone (défaut: false)
  retryOnFailure?: boolean; // Réessayer si un handler échoue (défaut: true)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private subscriptions: Map<EventType | '*', EventSubscription[]> = new Map();
  private subscriptionCounter = 0;
  private isShuttingDown = false;

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('EventBusService');
  }

  async onModuleInit() {
    this.logger.info('Event bus initialized', 'EventBusService');
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.subscriptions.clear();
    this.logger.info('Event bus shutdown complete', 'EventBusService');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * S'abonne à un type d'événement spécifique
   */
  subscribe<T = unknown>(
    eventType: EventType,
    handler: EventHandler<T>,
    priority = 0,
  ): string {
    return this.addSubscription(eventType, handler as EventHandler, priority);
  }

  /**
   * S'abonne à tous les événements
   */
  subscribeAll<T = unknown>(handler: EventHandler<T>, priority = 0): string {
    return this.addSubscription('*', handler as EventHandler, priority);
  }

  /**
   * S'abonne à plusieurs types d'événements
   */
  subscribeMany<T = unknown>(
    eventTypes: EventType[],
    handler: EventHandler<T>,
    priority = 0,
  ): string[] {
    return eventTypes.map((type) => this.subscribe(type, handler, priority));
  }

  /**
   * Se désabonne d'un événement
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [_type, subs] of this.subscriptions) {
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        this.logger.debug(`Unsubscribed: ${subscriptionId}`, 'EventBusService');
        return true;
      }
    }
    return false;
  }

  /**
   * Ajoute une souscription
   */
  private addSubscription(
    eventType: EventType | '*',
    handler: EventHandler,
    priority: number,
  ): string {
    const id = `sub-${++this.subscriptionCounter}`;

    const subscription: EventSubscription = {
      id,
      eventType,
      handler,
      priority,
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    const subs = this.subscriptions.get(eventType)!;
    subs.push(subscription);

    // Trier par priorité (plus haute en premier)
    subs.sort((a, b) => b.priority - a.priority);

    this.logger.debug(`Subscribed to ${eventType}: ${id}`, 'EventBusService');

    return id;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLICATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Publie un événement
   */
  async publish<T>(
    type: EventType,
    category: EventCategory,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    metadata: EventMetadata = {},
    options: PublishOptions = {},
  ): Promise<DomainEvent<T>> {
    const {
      persist = true,
      async: isAsync = false,
      retryOnFailure = true,
    } = options;

    // Persister l'événement si demandé
    let event: DomainEvent<T>;
    if (persist) {
      event = await this.eventStore.append(
        type,
        category,
        aggregateType,
        aggregateId,
        payload,
        metadata,
      );
    } else {
      // Créer un événement éphémère
      event = {
        id: `ephemeral-${Date.now()}`,
        version: -1,
        type,
        category,
        aggregateType,
        aggregateId,
        payload,
        metadata,
        createdAt: new Date(),
      };
    }

    // Dispatcher l'événement
    if (isAsync) {
      setImmediate(() => this.dispatchEvent(event, retryOnFailure));
    } else {
      await this.dispatchEvent(event, retryOnFailure);
    }

    return event;
  }

  /**
   * Publie plusieurs événements en batch
   */
  async publishBatch<T>(
    events: Array<{
      type: EventType;
      category: EventCategory;
      aggregateType: string;
      aggregateId: string;
      payload: T;
      metadata?: EventMetadata;
    }>,
    options: PublishOptions = {},
  ): Promise<DomainEvent<T>[]> {
    const {
      persist = true,
      async: isAsync = false,
      retryOnFailure = true,
    } = options;

    let domainEvents: DomainEvent<T>[];

    if (persist) {
      domainEvents = await this.eventStore.appendBatch(events);
    } else {
      domainEvents = events.map((e, i) => ({
        id: `ephemeral-${Date.now()}-${i}`,
        version: -1,
        type: e.type,
        category: e.category,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        payload: e.payload,
        metadata: e.metadata || {},
        createdAt: new Date(),
      }));
    }

    // Dispatcher les événements
    for (const event of domainEvents) {
      if (isAsync) {
        setImmediate(() => this.dispatchEvent(event, retryOnFailure));
      } else {
        await this.dispatchEvent(event, retryOnFailure);
      }
    }

    return domainEvents;
  }

  /**
   * Dispatch un événement aux handlers
   */
  private async dispatchEvent(event: DomainEvent, retryOnFailure: boolean): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    const handlers = this.getHandlersForEvent(event.type);

    if (handlers.length === 0) {
      this.logger.debug(`No handlers for event type: ${event.type}`, 'EventBusService');
      return;
    }

    this.logger.debug(`Dispatching event ${event.id} to ${handlers.length} handlers`, 'EventBusService');

    for (const subscription of handlers) {
      try {
        await this.executeHandler(subscription, event, retryOnFailure);
      } catch (error) {
        // Handler failure is logged but doesn't stop other handlers
        this.logger.error(
          `Handler ${subscription.id} failed for event ${event.id}: ${error}`,
          error instanceof Error ? error.stack : undefined,
          'EventBusService',
        );
      }
    }
  }

  /**
   * Exécute un handler avec retry optionnel
   */
  private async executeHandler(
    subscription: EventSubscription,
    event: DomainEvent,
    retryOnFailure: boolean,
  ): Promise<void> {
    const maxRetries = retryOnFailure ? 3 : 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        await subscription.handler(event);
        const duration = Date.now() - startTime;

        this.logger.debug(`Handler ${subscription.id} completed in ${duration}ms`, 'EventBusService', {
          eventId: event.id,
          eventType: event.type,
          attempt,
          duration,
        });

        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt - 1) * 100;
          this.logger.warn(
            `Handler ${subscription.id} failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`,
            'EventBusService',
          );
          await this.sleep(delay);
        }
      }
    }

    // Échec après tous les retries
    throw lastError;
  }

  /**
   * Récupère les handlers pour un type d'événement
   */
  private getHandlersForEvent(eventType: EventType): EventSubscription[] {
    const specificHandlers = this.subscriptions.get(eventType) || [];
    const wildcardHandlers = this.subscriptions.get('*') || [];

    // Combiner et trier par priorité
    return [...specificHandlers, ...wildcardHandlers].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Nombre de souscriptions actives
   */
  getSubscriptionCount(): number {
    let count = 0;
    for (const subs of this.subscriptions.values()) {
      count += subs.length;
    }
    return count;
  }

  /**
   * Liste des types d'événements avec souscriptions
   */
  getSubscribedEventTypes(): string[] {
    return Array.from(this.subscriptions.keys()).filter(
      (type) => (this.subscriptions.get(type)?.length || 0) > 0,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECORATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Décorateur pour marquer une méthode comme handler d'événements
 * Note: Nécessite une intégration avec le module discovery de NestJS
 */
export function EventHandler(eventType: EventType, priority = 0): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata('event:handler', { eventType, priority }, target, propertyKey);
    return descriptor;
  };
}
