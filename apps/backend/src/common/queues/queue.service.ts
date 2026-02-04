/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUEUE SERVICE — BullMQ Integration for Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Service central pour la gestion des files d'attente asynchrones.
 *
 * QUEUES DISPONIBLES:
 * - reports: Génération de rapports Excel/PDF
 * - notifications: Envoi d'emails et notifications push
 * - alerts: Calcul et création d'alertes métier
 * - sync: Synchronisation de données
 *
 * FEATURES:
 * - Retry avec backoff exponentiel
 * - Jobs prioritaires
 * - Scheduling (cron jobs)
 * - Monitoring et métriques
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq';
import { LoggerService } from '../logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export enum QueueName {
  REPORTS = 'reports',
  NOTIFICATIONS = 'notifications',
  ALERTS = 'alerts',
  SYNC = 'sync',
}

export enum JobPriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
}

// Report Jobs
export interface ReportJobData {
  type: 'excel' | 'pdf';
  reportType: string;
  filters: Record<string, unknown>;
  userId: string;
  requestId?: string;
}

// Notification Jobs
export interface NotificationJobData {
  type: 'email' | 'push' | 'sms';
  to: string | string[];
  subject?: string;
  template: string;
  data: Record<string, unknown>;
  userId?: string;
}

// Alert Jobs
export interface AlertJobData {
  type: 'scan_mp' | 'scan_suppliers' | 'scan_production' | 'check_dlc';
  metadata?: Record<string, unknown>;
}

// Sync Jobs
export interface SyncJobData {
  type: 'full' | 'incremental' | 'selective';
  entities?: string[];
  since?: Date;
  metadata?: Record<string, unknown>;
}

export type JobData = ReportJobData | NotificationJobData | AlertJobData | SyncJobData;

export interface QueueJobOptions extends JobsOptions {
  priority?: JobPriority;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class QueueService implements OnModuleDestroy {
  private queues: Map<QueueName, Queue> = new Map();
  private workers: Map<QueueName, Worker> = new Map();
  private queueEvents: Map<QueueName, QueueEvents> = new Map();
  private processors: Map<QueueName, (job: Job) => Promise<unknown>> = new Map();
  private isInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('QueueService');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Initialise les queues BullMQ
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD', '');

    const connection = {
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined,
    };

    // Créer les queues
    for (const queueName of Object.values(QueueName)) {
      const queue = new Queue(queueName, {
        connection,
        defaultJobOptions: this.getDefaultJobOptions(queueName),
      });

      const queueEvents = new QueueEvents(queueName, { connection });

      // Event listeners pour monitoring
      queueEvents.on('completed', ({ jobId }) => {
        this.logger.debug(`Job ${jobId} completed in queue ${queueName}`, 'QueueService');
      });

      queueEvents.on('failed', ({ jobId, failedReason }) => {
        this.logger.error(`Job ${jobId} failed in queue ${queueName}: ${failedReason}`, undefined, 'QueueService');
      });

      this.queues.set(queueName, queue);
      this.queueEvents.set(queueName, queueEvents);

      this.logger.info(`Queue "${queueName}" initialized`, 'QueueService');
    }

    this.isInitialized = true;
  }

  /**
   * Options par défaut selon le type de queue
   */
  private getDefaultJobOptions(queueName: QueueName): JobsOptions {
    const baseOptions: JobsOptions = {
      removeOnComplete: {
        count: 100, // Garder les 100 derniers jobs complétés
        age: 24 * 60 * 60, // Ou ceux des dernières 24h
      },
      removeOnFail: {
        count: 500, // Garder les 500 derniers échecs
        age: 7 * 24 * 60 * 60, // Ou ceux des 7 derniers jours
      },
    };

    switch (queueName) {
      case QueueName.REPORTS:
        return {
          ...baseOptions,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5s, 10s, 20s
          },
        };

      case QueueName.NOTIFICATIONS:
        return {
          ...baseOptions,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000, // 1s, 2s, 4s, 8s, 16s
          },
        };

      case QueueName.ALERTS:
        return {
          ...baseOptions,
          attempts: 3,
          backoff: {
            type: 'fixed',
            delay: 10000, // 10s entre chaque retry
          },
        };

      case QueueName.SYNC:
        return {
          ...baseOptions,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 30000, // 30s, 60s
          },
        };

      default:
        return baseOptions;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKER REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Enregistre un processor pour une queue
   */
  registerProcessor(queueName: QueueName, processor: (job: Job) => Promise<unknown>): void {
    if (this.workers.has(queueName)) {
      this.logger.warn(`Worker already registered for queue ${queueName}, skipping`, 'QueueService');
      return;
    }

    this.processors.set(queueName, processor);

    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD', '');

    const worker = new Worker(
      queueName,
      async (job: Job) => {
        this.logger.info(`Processing job ${job.id} in queue ${queueName}`, 'QueueService', {
          jobId: job.id,
          jobName: job.name,
          attempt: job.attemptsMade + 1,
        });

        const startTime = Date.now();
        try {
          const result = await processor(job);
          const duration = Date.now() - startTime;

          this.logger.info(`Job ${job.id} completed in ${duration}ms`, 'QueueService', {
            jobId: job.id,
            duration,
          });

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          this.logger.error(
            `Job ${job.id} failed after ${duration}ms: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error.stack : undefined,
            'QueueService',
          );
          throw error;
        }
      },
      {
        connection: {
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
        },
        concurrency: this.getConcurrency(queueName),
      },
    );

    worker.on('error', (error) => {
      this.logger.error(`Worker error in queue ${queueName}: ${error.message}`, error.stack, 'QueueService');
    });

    this.workers.set(queueName, worker);
    this.logger.info(`Worker registered for queue "${queueName}" with concurrency ${this.getConcurrency(queueName)}`, 'QueueService');
  }

  /**
   * Concurrence par type de queue
   */
  private getConcurrency(queueName: QueueName): number {
    switch (queueName) {
      case QueueName.REPORTS:
        return 2; // Rapports = memory intensive
      case QueueName.NOTIFICATIONS:
        return 10; // Notifications = léger
      case QueueName.ALERTS:
        return 3; // Alertes = modéré
      case QueueName.SYNC:
        return 1; // Sync = séquentiel
      default:
        return 5;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // JOB MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Ajoute un job à une queue
   */
  async addJob<T extends JobData>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: QueueJobOptions,
  ): Promise<Job<T>> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" not found`);
    }

    const jobOptions: JobsOptions = {
      ...options,
      priority: options?.priority ?? JobPriority.NORMAL,
    };

    const job = await queue.add(jobName, data, jobOptions);

    this.logger.info(`Job added to queue "${queueName}"`, 'QueueService', {
      jobId: job.id,
      jobName,
      priority: jobOptions.priority,
    });

    return job as Job<T>;
  }

  /**
   * Ajoute plusieurs jobs en bulk
   */
  async addBulkJobs<T extends JobData>(
    queueName: QueueName,
    jobs: Array<{ name: string; data: T; options?: QueueJobOptions }>,
  ): Promise<Job<T>[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" not found`);
    }

    const bulkJobs = jobs.map((job) => ({
      name: job.name,
      data: job.data,
      opts: {
        ...job.options,
        priority: job.options?.priority ?? JobPriority.NORMAL,
      },
    }));

    const addedJobs = await queue.addBulk(bulkJobs);

    this.logger.info(`${addedJobs.length} jobs added to queue "${queueName}"`, 'QueueService');

    return addedJobs as Job<T>[];
  }

  /**
   * Planifie un job récurrent (cron)
   */
  async scheduleJob<T extends JobData>(
    queueName: QueueName,
    jobName: string,
    data: T,
    cron: string,
    options?: QueueJobOptions,
  ): Promise<Job<T>> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" not found`);
    }

    const job = await queue.add(jobName, data, {
      ...options,
      repeat: { pattern: cron },
      priority: options?.priority ?? JobPriority.NORMAL,
    });

    this.logger.info(`Scheduled job "${jobName}" with cron "${cron}" in queue "${queueName}"`, 'QueueService', {
      jobId: job.id,
    });

    return job as Job<T>;
  }

  /**
   * Récupère un job par ID
   */
  async getJob<T extends JobData>(queueName: QueueName, jobId: string): Promise<Job<T> | undefined> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" not found`);
    }

    return await queue.getJob(jobId) as Job<T> | undefined;
  }

  /**
   * Récupère l'état d'un job
   */
  async getJobState(queueName: QueueName, jobId: string): Promise<string | undefined> {
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      return undefined;
    }
    return await job.getState();
  }

  /**
   * Annule un job
   */
  async removeJob(queueName: QueueName, jobId: string): Promise<boolean> {
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      return false;
    }

    await job.remove();
    this.logger.info(`Job ${jobId} removed from queue "${queueName}"`, 'QueueService');
    return true;
  }

  /**
   * Retry un job échoué
   */
  async retryJob(queueName: QueueName, jobId: string): Promise<boolean> {
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      return false;
    }

    await job.retry();
    this.logger.info(`Job ${jobId} retried in queue "${queueName}"`, 'QueueService');
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // QUEUE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Pause une queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" not found`);
    }

    await queue.pause();
    this.logger.info(`Queue "${queueName}" paused`, 'QueueService');
  }

  /**
   * Resume une queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" not found`);
    }

    await queue.resume();
    this.logger.info(`Queue "${queueName}" resumed`, 'QueueService');
  }

  /**
   * Vide une queue
   */
  async drainQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" not found`);
    }

    await queue.drain();
    this.logger.info(`Queue "${queueName}" drained`, 'QueueService');
  }

  /**
   * Statistiques d'une queue
   */
  async getQueueStats(queueName: QueueName): Promise<QueueStats> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" not found`);
    }

    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return {
      name: queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }

  /**
   * Statistiques de toutes les queues
   */
  async getAllQueuesStats(): Promise<QueueStats[]> {
    const stats: QueueStats[] = [];

    for (const queueName of Object.values(QueueName)) {
      try {
        const queueStats = await this.getQueueStats(queueName);
        stats.push(queueStats);
      } catch (error) {
        this.logger.warn(`Failed to get stats for queue ${queueName}: ${error}`, 'QueueService');
      }
    }

    return stats;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONVENIENCE METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Ajoute un job de génération de rapport
   */
  async addReportJob(data: ReportJobData, options?: QueueJobOptions): Promise<Job<ReportJobData>> {
    return this.addJob(QueueName.REPORTS, `report:${data.reportType}`, data, options);
  }

  /**
   * Ajoute un job de notification
   */
  async addNotificationJob(data: NotificationJobData, options?: QueueJobOptions): Promise<Job<NotificationJobData>> {
    return this.addJob(QueueName.NOTIFICATIONS, `notification:${data.type}`, data, options);
  }

  /**
   * Ajoute un job d'alerte
   */
  async addAlertJob(data: AlertJobData, options?: QueueJobOptions): Promise<Job<AlertJobData>> {
    return this.addJob(QueueName.ALERTS, `alert:${data.type}`, data, options);
  }

  /**
   * Ajoute un job de synchronisation
   */
  async addSyncJob(data: SyncJobData, options?: QueueJobOptions): Promise<Job<SyncJobData>> {
    return this.addJob(QueueName.SYNC, `sync:${data.type}`, data, options);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SHUTDOWN
  // ═══════════════════════════════════════════════════════════════════════════════

  async shutdown(): Promise<void> {
    // Fermer les workers d'abord
    for (const [name, worker] of this.workers) {
      await worker.close();
      this.logger.debug(`Worker for queue "${name}" closed`, 'QueueService');
    }

    // Fermer les queue events
    for (const [name, queueEvents] of this.queueEvents) {
      await queueEvents.close();
      this.logger.debug(`QueueEvents for queue "${name}" closed`, 'QueueService');
    }

    // Fermer les queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.debug(`Queue "${name}" closed`, 'QueueService');
    }

    this.workers.clear();
    this.queueEvents.clear();
    this.queues.clear();
    this.isInitialized = false;
  }

  async onModuleDestroy() {
    await this.shutdown();
  }
}
