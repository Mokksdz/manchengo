/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EVENT SOURCING MODULE — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Event Sourcing léger pour traçabilité complète des modifications.
 *
 * OBJECTIFS:
 * - Traçabilité complète: qui a fait quoi, quand, pourquoi
 * - Replay: pouvoir reconstruire l'état à n'importe quel moment
 * - Debug: comprendre le flux des modifications
 * - Audit: preuves légales des changements
 *
 * EVENTS SUPPORTÉS:
 * - Stock: Réceptions, consommations, ajustements
 * - Production: Création, démarrage, complétion d'ordres
 * - APPRO: Alertes, commandes, livraisons
 * - Utilisateurs: Connexions, actions critiques
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Module, Global } from '@nestjs/common';
import { EventStoreService } from './event-store.service';
import { EventBusService } from './event-bus.service';
import { EventReplayService } from './event-replay.service';
import { EventsController } from './events.controller';

@Global()
@Module({
  controllers: [EventsController],
  providers: [
    EventStoreService,
    EventBusService,
    EventReplayService,
  ],
  exports: [
    EventStoreService,
    EventBusService,
    EventReplayService,
  ],
})
export class EventsModule {}
