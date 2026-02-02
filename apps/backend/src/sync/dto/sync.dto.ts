import { IsString, IsArray, IsNumber, IsOptional, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Event from mobile device
export class SyncEventDto {
  @ApiProperty({ description: 'Event UUID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Entity type (LOT_MP, INVOICE, etc.)' })
  @IsString()
  entity_type: string;

  @ApiProperty({ description: 'Entity ID' })
  @IsString()
  entity_id: string;

  @ApiProperty({ description: 'Action (MP_RECEIVED, PF_SOLD, etc.)' })
  @IsString()
  action: string;

  @ApiProperty({ description: 'Event payload' })
  payload: Record<string, any>;

  @ApiProperty({ description: 'When event occurred (ISO8601)' })
  @IsDateString()
  occurred_at: string;

  @ApiProperty({ description: 'User ID who triggered event' })
  @IsNumber()
  user_id: number;
}

// Push request from mobile
export class PushEventsDto {
  @ApiProperty({ description: 'Device UUID' })
  @IsString()
  device_id: string;

  @ApiProperty({ type: [SyncEventDto], description: 'Events to sync' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncEventDto)
  events: SyncEventDto[];
}

// Push response to mobile
export class PushEventsResponseDto {
  @ApiProperty({ description: 'Successfully acknowledged event IDs' })
  acked_event_ids: string[];

  @ApiPropertyOptional({ description: 'Failed event IDs' })
  failed_event_ids?: string[];
}

// Pull query params
export class PullEventsQueryDto {
  @ApiPropertyOptional({ description: 'Fetch events since this timestamp' })
  @IsDateString()
  @IsOptional()
  since?: string;

  @ApiProperty({ description: 'Device UUID' })
  @IsString()
  device_id: string;
}

// Pull response to mobile
export class PullEventsResponseDto {
  @ApiProperty({ type: [SyncEventDto], description: 'Events since last sync' })
  events: SyncEventDto[];

  @ApiProperty({ description: 'Current server time (ISO8601)' })
  server_time: string;
}
