/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BULLMQ QUEUES MODULE — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Gestion des tâches asynchrones avec BullMQ pour:
 * - Génération de rapports (Excel, PDF)
 * - Envoi de notifications par email
 * - Calculs lourds (KPIs, alertes)
 * - Synchronisation de données
 *
 * Avantages:
 * - Découplage des tâches longues
 * - Retry automatique avec backoff exponentiel
 * - Monitoring des jobs via Bull Board
 * - Scalabilité horizontale
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Module, Global, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { ReportProcessor } from './processors/report.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { AlertProcessor } from './processors/alert.processor';
import { SyncProcessor } from './processors/sync.processor';
import { QueueDashboardController } from './queue-dashboard.controller';
import { LoggerService } from '../logger';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [QueueDashboardController],
  providers: [
    QueueService,
    ReportProcessor,
    NotificationProcessor,
    AlertProcessor,
    SyncProcessor,
  ],
  exports: [QueueService],
})
export class QueuesModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly queueService: QueueService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('QueuesModule');
  }

  async onModuleInit() {
    this.logger.info('Initializing BullMQ queues...', 'QueuesModule');
    await this.queueService.initialize();
    this.logger.info('BullMQ queues initialized successfully', 'QueuesModule');
  }

  async onModuleDestroy() {
    this.logger.info('Shutting down BullMQ queues...', 'QueuesModule');
    await this.queueService.shutdown();
    this.logger.info('BullMQ queues shut down', 'QueuesModule');
  }
}
