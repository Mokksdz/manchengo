import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SyncDeviceGuard, SyncRateLimitGuard } from './sync.guard';
import { SyncService } from './sync.service';
import {
  PushSyncDto,
  PushSyncResponseDto,
  PullSyncDto,
  PullSyncResponseDto,
  SyncStatusDto,
  SyncStatusResponseDto,
  BootstrapRequestDto,
  BootstrapResponseDto,
  AckEventsDto,
  AckEventsResponseDto,
} from './sync.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
  device: { id: string; name: string; platform: string };
  deviceId: string;
}

@ApiTags('Sync')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Device-Id',
  description: 'Device UUID for sync operations',
  required: true,
})
@Controller('api/sync')
@UseGuards(JwtAuthGuard, SyncDeviceGuard, SyncRateLimitGuard)
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  /**
   * POST /api/sync/push
   * Receive events from mobile device
   */
  @Post('push')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Push sync events from mobile',
    description:
      'Receives a batch of sync events from mobile device. Events are processed idempotently using clientEventId.',
  })
  @ApiResponse({
    status: 200,
    description: 'Events processed',
    type: PushSyncResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Device revoked or user blocked' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async push(
    @Body() dto: PushSyncDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PushSyncResponseDto> {
    this.logger.log(
      `Push request - User: ${req.user.id}, Device: ${req.deviceId}, Events: ${dto.events.length}`,
    );

    return this.syncService.pushEvents(dto, req.user.id);
  }

  /**
   * GET /api/sync/pull
   * Send events to mobile device
   */
  @Get('pull')
  @ApiOperation({
    summary: 'Pull sync events to mobile',
    description:
      'Returns events that occurred since the specified timestamp. Supports pagination via cursor.',
  })
  @ApiResponse({
    status: 200,
    description: 'Events retrieved',
    type: PullSyncResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Device revoked or user blocked' })
  async pull(
    @Query() dto: PullSyncDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PullSyncResponseDto> {
    this.logger.log(
      `Pull request - User: ${req.user.id}, Device: ${req.deviceId}, Since: ${dto.since}`,
    );

    return this.syncService.pullEvents(dto, req.user.id);
  }

  /**
   * GET /api/sync/status
   * Get sync status for device
   */
  @Get('status')
  @ApiOperation({
    summary: 'Get sync status',
    description:
      'Returns the current sync status for the device, including pending events and server health.',
  })
  @ApiResponse({
    status: 200,
    description: 'Status retrieved',
    type: SyncStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async status(
    @Query() dto: SyncStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SyncStatusResponseDto> {
    return this.syncService.getStatus(dto.deviceId || req.deviceId, req.user.id);
  }

  /**
   * POST /api/sync/bootstrap
   * Initial data download for mobile
   */
  @Post('bootstrap')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bootstrap initial data',
    description:
      'Downloads initial reference data (products, clients, pending deliveries) for mobile offline cache.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bootstrap data',
    type: BootstrapResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async bootstrap(
    @Body() dto: BootstrapRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<BootstrapResponseDto> {
    this.logger.log(
      `Bootstrap request - User: ${req.user.id}, Device: ${req.deviceId}, Entities: ${dto.entities.join(', ')}`,
    );

    return this.syncService.bootstrap(dto, req.user.id);
  }

  /**
   * POST /api/sync/ack
   * Acknowledge events have been processed by mobile
   */
  @Post('ack')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acknowledge events',
    description:
      'Marks events as acknowledged by the mobile device. Used for crash recovery.',
  })
  @ApiResponse({
    status: 200,
    description: 'Events acknowledged',
    type: AckEventsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async acknowledge(
    @Body() dto: AckEventsDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AckEventsResponseDto> {
    this.logger.log(
      `Ack request - User: ${req.user.id}, Device: ${req.deviceId}, Events: ${dto.eventIds.length}`,
    );

    return this.syncService.acknowledgeEvents(dto, req.user.id);
  }

  /**
   * GET /api/sync/health
   * Simple health check for sync service
   */
  @Get('health')
  @ApiOperation({
    summary: 'Sync service health check',
    description: 'Returns basic health status of the sync service.',
  })
  @ApiResponse({ status: 200, description: 'Service healthy' })
  async health(): Promise<{ healthy: boolean; serverTime: string }> {
    return {
      healthy: true,
      serverTime: new Date().toISOString(),
    };
  }
}
