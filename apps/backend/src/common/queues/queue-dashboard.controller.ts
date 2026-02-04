/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUEUE DASHBOARD CONTROLLER — Monitoring et gestion des queues
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * API REST pour monitorer et gérer les queues BullMQ.
 *
 * ENDPOINTS:
 * - GET /queues/stats - Statistiques de toutes les queues
 * - GET /queues/:name/stats - Statistiques d'une queue
 * - GET /queues/:name/jobs/:id - Détails d'un job
 * - POST /queues/:name/pause - Pause une queue
 * - POST /queues/:name/resume - Resume une queue
 * - DELETE /queues/:name/jobs/:id - Supprime un job
 * - POST /queues/:name/jobs/:id/retry - Retry un job
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QueueService, QueueName, QueueStats } from './queue.service';

@ApiTags('Queues')
@ApiBearerAuth()
@Controller('queues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QueueDashboardController {
  constructor(private readonly queueService: QueueService) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get statistics for all queues' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        queues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              waiting: { type: 'number' },
              active: { type: 'number' },
              completed: { type: 'number' },
              failed: { type: 'number' },
              delayed: { type: 'number' },
              paused: { type: 'boolean' },
            },
          },
        },
        summary: {
          type: 'object',
          properties: {
            totalWaiting: { type: 'number' },
            totalActive: { type: 'number' },
            totalFailed: { type: 'number' },
          },
        },
      },
    },
  })
  async getAllStats(): Promise<{
    queues: QueueStats[];
    summary: {
      totalWaiting: number;
      totalActive: number;
      totalFailed: number;
      totalCompleted: number;
    };
  }> {
    const queues = await this.queueService.getAllQueuesStats();

    const summary = queues.reduce(
      (acc, q) => ({
        totalWaiting: acc.totalWaiting + q.waiting,
        totalActive: acc.totalActive + q.active,
        totalFailed: acc.totalFailed + q.failed,
        totalCompleted: acc.totalCompleted + q.completed,
      }),
      { totalWaiting: 0, totalActive: 0, totalFailed: 0, totalCompleted: 0 },
    );

    return { queues, summary };
  }

  @Get(':name/stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get statistics for a specific queue' })
  @ApiParam({ name: 'name', enum: QueueName, description: 'Queue name' })
  @ApiResponse({ status: 200, description: 'Queue statistics retrieved' })
  @ApiResponse({ status: 400, description: 'Invalid queue name' })
  async getQueueStats(@Param('name') name: string): Promise<QueueStats> {
    this.validateQueueName(name);
    return this.queueService.getQueueStats(name as QueueName);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // JOB MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get(':name/jobs/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get details of a specific job' })
  @ApiParam({ name: 'name', enum: QueueName, description: 'Queue name' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job details retrieved' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(
    @Param('name') name: string,
    @Param('id') id: string,
  ): Promise<{
    id: string | undefined;
    name: string;
    data: unknown;
    state: string | undefined;
    progress: unknown;
    attemptsMade: number;
    failedReason?: string;
    timestamp: number | undefined;
    finishedOn: number | undefined;
    processedOn: number | undefined;
  }> {
    this.validateQueueName(name);

    const job = await this.queueService.getJob(name as QueueName, id);
    if (!job) {
      throw new NotFoundException(`Job ${id} not found in queue ${name}`);
    }

    const state = await job.getState();

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    };
  }

  @Get(':name/jobs/:id/state')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get state of a specific job' })
  @ApiParam({ name: 'name', enum: QueueName, description: 'Queue name' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async getJobState(
    @Param('name') name: string,
    @Param('id') id: string,
  ): Promise<{ state: string | undefined }> {
    this.validateQueueName(name);

    const state = await this.queueService.getJobState(name as QueueName, id);
    if (state === undefined) {
      throw new NotFoundException(`Job ${id} not found in queue ${name}`);
    }

    return { state };
  }

  @Delete(':name/jobs/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a job from queue' })
  @ApiParam({ name: 'name', enum: QueueName, description: 'Queue name' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({ status: 204, description: 'Job removed successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async removeJob(@Param('name') name: string, @Param('id') id: string): Promise<void> {
    this.validateQueueName(name);

    const removed = await this.queueService.removeJob(name as QueueName, id);
    if (!removed) {
      throw new NotFoundException(`Job ${id} not found in queue ${name}`);
    }
  }

  @Post(':name/jobs/:id/retry')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiParam({ name: 'name', enum: QueueName, description: 'Queue name' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job retry initiated' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async retryJob(
    @Param('name') name: string,
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    this.validateQueueName(name);

    const retried = await this.queueService.retryJob(name as QueueName, id);
    if (!retried) {
      throw new NotFoundException(`Job ${id} not found in queue ${name}`);
    }

    return { success: true, message: `Job ${id} retry initiated` };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // QUEUE CONTROL
  // ═══════════════════════════════════════════════════════════════════════════════

  @Post(':name/pause')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause a queue' })
  @ApiParam({ name: 'name', enum: QueueName, description: 'Queue name' })
  @ApiResponse({ status: 200, description: 'Queue paused successfully' })
  async pauseQueue(@Param('name') name: string): Promise<{ success: boolean; message: string }> {
    this.validateQueueName(name);

    await this.queueService.pauseQueue(name as QueueName);
    return { success: true, message: `Queue ${name} paused` };
  }

  @Post(':name/resume')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused queue' })
  @ApiParam({ name: 'name', enum: QueueName, description: 'Queue name' })
  @ApiResponse({ status: 200, description: 'Queue resumed successfully' })
  async resumeQueue(@Param('name') name: string): Promise<{ success: boolean; message: string }> {
    this.validateQueueName(name);

    await this.queueService.resumeQueue(name as QueueName);
    return { success: true, message: `Queue ${name} resumed` };
  }

  @Post(':name/drain')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Drain all waiting jobs from a queue' })
  @ApiParam({ name: 'name', enum: QueueName, description: 'Queue name' })
  @ApiResponse({ status: 200, description: 'Queue drained successfully' })
  async drainQueue(@Param('name') name: string): Promise<{ success: boolean; message: string }> {
    this.validateQueueName(name);

    await this.queueService.drainQueue(name as QueueName);
    return { success: true, message: `Queue ${name} drained` };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MANUAL JOB CREATION (for admin testing)
  // ═══════════════════════════════════════════════════════════════════════════════

  @Post('alerts/scan')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger a manual alert scan' })
  @ApiQuery({ name: 'type', enum: ['scan_mp', 'scan_suppliers', 'scan_production', 'check_dlc'] })
  async triggerAlertScan(
    @Query('type') type: 'scan_mp' | 'scan_suppliers' | 'scan_production' | 'check_dlc' = 'scan_mp',
  ): Promise<{ success: boolean; jobId: string | undefined; message: string }> {
    const job = await this.queueService.addAlertJob({ type });

    return {
      success: true,
      jobId: job.id,
      message: `Alert scan ${type} job created`,
    };
  }

  @Post('sync/trigger')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger a manual sync job' })
  @ApiQuery({ name: 'type', enum: ['full', 'incremental', 'selective'] })
  async triggerSync(
    @Query('type') type: 'full' | 'incremental' | 'selective' = 'incremental',
  ): Promise<{ success: boolean; jobId: string | undefined; message: string }> {
    const job = await this.queueService.addSyncJob({ type });

    return {
      success: true,
      jobId: job.id,
      message: `Sync ${type} job created`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private validateQueueName(name: string): void {
    if (!Object.values(QueueName).includes(name as QueueName)) {
      throw new BadRequestException(
        `Invalid queue name: ${name}. Valid names are: ${Object.values(QueueName).join(', ')}`,
      );
    }
  }
}
