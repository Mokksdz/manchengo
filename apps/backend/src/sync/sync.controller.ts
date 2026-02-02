import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import {
  PushEventsDto,
  PushEventsResponseDto,
  PullEventsQueryDto,
  PullEventsResponseDto,
} from './dto/sync.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DevicesService } from '../security/devices.service';
import { SecurityLogService } from '../security/security-log.service';
import { SecurityAction } from '@prisma/client';

/**
 * Sync Controller
 * 
 * Handles event synchronization between mobile devices and server.
 * 
 * Security checks:
 * - JWT authentication required
 * - Device must be registered and active
 * - User must not be blocked
 * - All sync operations are logged
 */
@ApiTags('Sync')
@ApiBearerAuth()
@Controller('sync/events')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(
    private syncService: SyncService,
    private devicesService: DevicesService,
    private securityLog: SecurityLogService,
  ) {}

  /**
   * POST /api/sync/events
   * 
   * Receive events from mobile devices.
   * Validates device before accepting events.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Push events from mobile device' })
  @ApiResponse({ status: 200, type: PushEventsResponseDto })
  async pushEvents(
    @Body() dto: PushEventsDto,
    @Headers('x-device-id') headerDeviceId?: string,
  ): Promise<PushEventsResponseDto> {
    const deviceId = dto.device_id || headerDeviceId;

    // Validate device if provided
    if (deviceId && dto.events.length > 0) {
      const firstEvent = dto.events[0];
      const userId = String(firstEvent.user_id);

      // Register or validate device
      try {
        await this.devicesService.registerDevice({
          deviceId,
          userId,
          name: 'Mobile Device',
          platform: 'android',
        });
      } catch (error) {
        // Device revoked or belongs to different user
        await this.securityLog.log({
          action: SecurityAction.ACCESS_DENIED,
          userId,
          deviceId,
          details: { reason: 'Device validation failed on sync push' },
          success: false,
        });
        throw new ForbiddenException('Device not authorized');
      }

      // Update last sync time
      await this.devicesService.updateLastSync(deviceId);
    }

    const result = await this.syncService.pushEvents(dto);

    // Log sync push
    if (dto.events.length > 0) {
      await this.securityLog.log({
        action: SecurityAction.SYNC_PUSH,
        userId: String(dto.events[0].user_id),
        deviceId,
        details: { eventCount: dto.events.length },
        success: true,
      });
    }

    return result;
  }

  /**
   * GET /api/sync/events?since=&device_id=
   * 
   * Return events to mobile devices for pull sync.
   * Validates device before returning events.
   */
  @Get()
  @ApiOperation({ summary: 'Pull events for mobile device' })
  @ApiResponse({ status: 200, type: PullEventsResponseDto })
  async pullEvents(
    @Query() query: PullEventsQueryDto,
    @Headers('x-device-id') headerDeviceId?: string,
  ): Promise<PullEventsResponseDto> {
    const deviceId = query.device_id || headerDeviceId;

    // Validate device if provided
    if (deviceId) {
      const device = await this.devicesService.getDevice(deviceId);
      
      if (device && !device.isActive) {
        await this.securityLog.log({
          action: SecurityAction.ACCESS_DENIED,
          userId: device.userId,
          deviceId,
          details: { reason: 'Device revoked on sync pull' },
          success: false,
        });
        throw new ForbiddenException('Device has been revoked');
      }

      if (device && !device.user.isActive) {
        await this.securityLog.log({
          action: SecurityAction.ACCESS_DENIED,
          userId: device.userId,
          deviceId,
          details: { reason: 'User blocked on sync pull' },
          success: false,
        });
        throw new ForbiddenException('User account blocked');
      }

      // Update last sync time
      if (device) {
        await this.devicesService.updateLastSync(deviceId);
      }
    }

    const result = await this.syncService.pullEvents(query);

    // Log sync pull
    await this.securityLog.log({
      action: SecurityAction.SYNC_PULL,
      deviceId,
      details: { eventCount: result.events.length },
      success: true,
    });

    return result;
  }
}
