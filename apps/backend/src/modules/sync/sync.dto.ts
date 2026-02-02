import {
  IsString,
  IsUUID,
  IsArray,
  IsObject,
  IsDateString,
  IsOptional,
  IsInt,
  IsEnum,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export enum SyncEntityType {
  DELIVERY = 'DELIVERY',
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  CLIENT = 'CLIENT',
}

export enum SyncAction {
  // Delivery actions
  DELIVERY_VALIDATED = 'DELIVERY_VALIDATED',
  DELIVERY_CANCELLED = 'DELIVERY_CANCELLED',
  
  // Invoice actions
  INVOICE_CREATED = 'INVOICE_CREATED',
  INVOICE_UPDATED = 'INVOICE_UPDATED',
  
  // Payment actions
  PAYMENT_RECORDED = 'PAYMENT_RECORDED',
  
  // Client actions
  CLIENT_UPDATED = 'CLIENT_UPDATED',
}

export enum SyncEventStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
  ACKED = 'ACKED',
  FAILED = 'FAILED',
}

export enum ConflictErrorCode {
  ALREADY_VALIDATED = 'ALREADY_VALIDATED',
  ALREADY_CANCELLED = 'ALREADY_CANCELLED',
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  INVALID_STATE = 'INVALID_STATE',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  DUPLICATE_EVENT = 'DUPLICATE_EVENT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVOICE_ALREADY_PAID = 'INVOICE_ALREADY_PAID',
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH DTOs
// ═══════════════════════════════════════════════════════════════════════════════

export class SyncEventDto {
  @ApiProperty({ description: 'Client-generated UUID for idempotency' })
  @IsUUID('4')
  id: string;

  @ApiProperty({ enum: SyncEntityType })
  @IsEnum(SyncEntityType)
  entityType: SyncEntityType;

  @ApiProperty({ description: 'ID of the entity being modified' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  entityId: string;

  @ApiProperty({ enum: SyncAction })
  @IsEnum(SyncAction)
  action: SyncAction;

  @ApiProperty({ description: 'Event payload data' })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiProperty({ description: 'ISO8601 timestamp when event occurred on client' })
  @IsDateString()
  occurredAt: string;

  @ApiProperty({ description: 'SHA256 hash of payload for integrity check' })
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  checksum: string;
}

export class PushSyncDto {
  @ApiProperty({ description: 'Device UUID' })
  @IsUUID('4')
  deviceId: string;

  @ApiProperty({ description: 'Batch UUID for idempotent batch processing' })
  @IsUUID('4')
  batchId: string;

  @ApiProperty({ type: [SyncEventDto], description: 'Array of sync events (max 50)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SyncEventDto)
  events: SyncEventDto[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH RESPONSE DTOs
// ═══════════════════════════════════════════════════════════════════════════════

export class ConflictResolutionDto {
  @ApiProperty({ description: 'Resolution action to take' })
  action: 'DISCARD_LOCAL' | 'MERGE' | 'RETRY' | 'MANUAL';

  @ApiPropertyOptional({ description: 'Additional resolution data' })
  data?: Record<string, unknown>;
}

export class FailedEventDto {
  @ApiProperty({ description: 'Client event ID that failed' })
  eventId: string;

  @ApiProperty({ enum: ConflictErrorCode })
  errorCode: ConflictErrorCode;

  @ApiProperty({ description: 'Human-readable error message' })
  errorMessage: string;

  @ApiProperty({ description: 'Whether mobile should retry this event' })
  retry: boolean;

  @ApiPropertyOptional({ type: ConflictResolutionDto })
  resolution?: ConflictResolutionDto;
}

export class PushSyncResponseDto {
  @ApiProperty({ description: 'Overall success status' })
  success: boolean;

  @ApiProperty({ description: 'Echo of the batch ID' })
  batchId: string;

  @ApiProperty({ description: 'Server-generated event IDs for acked events' })
  ackedEventIds: string[];

  @ApiProperty({ description: 'Server-generated IDs mapped to client IDs' })
  serverEventIds: Record<string, string>;

  @ApiProperty({ type: [FailedEventDto] })
  failedEvents: FailedEventDto[];

  @ApiProperty({ description: 'Server time for clock drift calculation' })
  serverTime: string;

  @ApiProperty({ description: 'Non-blocking warnings' })
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PULL DTOs
// ═══════════════════════════════════════════════════════════════════════════════

export class PullSyncDto {
  @ApiProperty({ description: 'Device UUID' })
  @IsUUID('4')
  deviceId: string;

  @ApiProperty({ description: 'Last sync timestamp (ISO8601)' })
  @IsDateString()
  since: string;

  @ApiPropertyOptional({ description: 'Entity types to pull (comma-separated)' })
  @IsOptional()
  @IsString()
  entities?: string;

  @ApiPropertyOptional({ description: 'Max events to return (default 100)' })
  @IsOptional()
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ServerEventDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  payload: Record<string, unknown>;

  @ApiProperty()
  occurredAt: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  sourceDeviceId?: string;
}

export class CacheInvalidationDto {
  @ApiProperty()
  entityType: string;

  @ApiProperty({ description: 'IDs to invalidate, or ["*"] for all' })
  entityIds: string[];

  @ApiProperty()
  reason: string;
}

export class DeviceStatusDto {
  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  requiresReauth: boolean;

  @ApiPropertyOptional()
  message?: string;
}

export class PullSyncResponseDto {
  @ApiProperty({ type: [ServerEventDto] })
  events: ServerEventDto[];

  @ApiProperty()
  hasMore: boolean;

  @ApiPropertyOptional()
  nextCursor?: string;

  @ApiProperty()
  serverTime: string;

  @ApiProperty({ type: [CacheInvalidationDto] })
  cacheInvalidations: CacheInvalidationDto[];

  @ApiProperty({ type: DeviceStatusDto })
  deviceStatus: DeviceStatusDto;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS DTOs
// ═══════════════════════════════════════════════════════════════════════════════

export class SyncStatusDto {
  @ApiProperty({ description: 'Device UUID' })
  @IsUUID('4')
  deviceId: string;
}

export class DeviceSyncInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  lastPushAt: string | null;

  @ApiPropertyOptional()
  lastPullAt: string | null;

  @ApiProperty()
  pendingEvents: number;
}

export class UserSyncInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  role: string;
}

export class SyncStatusResponseDto {
  @ApiProperty()
  serverHealthy: boolean;

  @ApiProperty()
  serverTime: string;

  @ApiProperty({ type: DeviceSyncInfoDto })
  device: DeviceSyncInfoDto;

  @ApiProperty({ type: UserSyncInfoDto })
  user: UserSyncInfoDto;

  @ApiProperty()
  syncRequired: boolean;

  @ApiProperty()
  maintenanceMode: boolean;

  @ApiPropertyOptional()
  message?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP DTOs
// ═══════════════════════════════════════════════════════════════════════════════

export class BootstrapRequestDto {
  @ApiProperty({ description: 'Device UUID' })
  @IsUUID('4')
  deviceId: string;

  @ApiProperty({ description: 'Entities to bootstrap', example: ['products', 'clients', 'deliveries'] })
  @IsArray()
  @IsString({ each: true })
  entities: string[];

  @ApiPropertyOptional({ description: 'Force full refresh ignoring cache' })
  @IsOptional()
  forceFull?: boolean;
}

export class BootstrapResponseDto {
  @ApiPropertyOptional()
  productsPf?: Record<string, unknown>[];

  @ApiPropertyOptional()
  clients?: Record<string, unknown>[];

  @ApiPropertyOptional()
  deliveriesPending?: Record<string, unknown>[];

  @ApiPropertyOptional()
  stockPf?: Record<string, unknown>[];

  @ApiProperty()
  serverTime: string;

  @ApiProperty()
  dataVersion: string;

  @ApiPropertyOptional()
  nextBootstrapRecommended?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACK DTOs
// ═══════════════════════════════════════════════════════════════════════════════

export class AckEventsDto {
  @ApiProperty({ description: 'Device UUID' })
  @IsUUID('4')
  deviceId: string;

  @ApiProperty({ description: 'Event IDs to acknowledge' })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  eventIds: string[];
}

export class AckEventsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  ackedCount: number;

  @ApiProperty()
  serverTime: string;
}
