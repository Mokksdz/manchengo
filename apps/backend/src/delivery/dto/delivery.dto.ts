import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY DTOs - QR Validation & Proof of Delivery
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DTO for validating a delivery via QR code scan
 * This is the CRITICAL endpoint for delivery validation
 */
export class ValidateDeliveryDto {
  @ApiProperty({
    description: 'Full QR code string scanned from the delivery document',
    example: 'MCG:DLV:550e8400-e29b-41d4-a716-446655440000:LIV-240101-001:a1b2c3d4e5f6g7h8',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  qrCode: string;

  @ApiPropertyOptional({
    description: 'Device ID performing the scan (for mobile validation)',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'GPS coordinates of validation location',
    example: '36.7538,3.0588',
  })
  @IsOptional()
  @IsString()
  gpsCoordinates?: string;

  @ApiPropertyOptional({
    description: 'Name of the person receiving the delivery',
  })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({
    description: 'Base64 encoded signature of recipient',
  })
  @IsOptional()
  @IsString()
  recipientSignature?: string;

  @ApiPropertyOptional({
    description: 'Base64 encoded photo proof of delivery',
  })
  @IsOptional()
  @IsString()
  proofPhoto?: string;
}

/**
 * DTO for cancelling a delivery
 */
export class CancelDeliveryDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'Client absent - reprogrammer livraison',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason: string;
}

/**
 * DTO for creating a new delivery (linked to invoice)
 */
export class CreateDeliveryDto {
  @ApiProperty({
    description: 'Invoice ID to create delivery for',
  })
  @IsNotEmpty()
  invoiceId: number;

  @ApiPropertyOptional({
    description: 'Scheduled delivery date',
  })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({
    description: 'Delivery address (overrides client address)',
  })
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional({
    description: 'Notes for the delivery driver',
  })
  @IsOptional()
  @IsString()
  deliveryNotes?: string;
}

/**
 * Response after successful delivery validation
 */
export class DeliveryValidationResponse {
  success: boolean;
  message: string;
  delivery?: {
    id: string;
    reference: string;
    status: string;
    validatedAt: Date;
    client: {
      id: number;
      name: string;
    };
    invoice: {
      id: number;
      reference: string;
    };
  };
  error?: DeliveryValidationError;
}

/**
 * Possible delivery validation errors
 */
export enum DeliveryValidationError {
  INVALID_QR_FORMAT = 'INVALID_QR_FORMAT',
  INVALID_QR_CHECKSUM = 'INVALID_QR_CHECKSUM',
  DELIVERY_NOT_FOUND = 'DELIVERY_NOT_FOUND',
  DELIVERY_ALREADY_VALIDATED = 'DELIVERY_ALREADY_VALIDATED',
  DELIVERY_CANCELLED = 'DELIVERY_CANCELLED',
  DEVICE_NOT_ACTIVE = 'DEVICE_NOT_ACTIVE',
  USER_NOT_ACTIVE = 'USER_NOT_ACTIVE',
  INVALID_ENTITY_TYPE = 'INVALID_ENTITY_TYPE',
}

/**
 * Delivery list query filters
 */
export class DeliveryQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'VALIDATED' | 'CANCELLED';

  @ApiPropertyOptional({ description: 'Filter by client ID' })
  @IsOptional()
  clientId?: number;

  @ApiPropertyOptional({ description: 'Filter by date from' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by date to' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  limit?: number;
}
