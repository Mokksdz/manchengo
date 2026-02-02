import { IsOptional, IsString, IsInt, Min, Max, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * COMMON DTOs — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R9: DTOs typés pour tous les endpoints inline
 *
 * Shared DTOs used across multiple controllers to avoid inline types
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Date range query ──
export class DateRangeDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// ── Days query parameter ──
export class DaysQueryDto {
  @ApiPropertyOptional({ description: 'Number of days (1-365, default: 7)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 7;
}

// ── Limit query parameter ──
export class LimitQueryDto {
  @ApiPropertyOptional({ description: 'Number of items (1-100, default: 20)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ── Generic success response ──
export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}

// ── Generic error response ──
export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({ example: 'Validation failed' })
  message: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/stock/dashboard' })
  path: string;
}

// ── Change password DTO ──
export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: 'New password (min 8 chars, 1 uppercase, 1 digit)' })
  @IsString()
  newPassword: string;
}

// ── Alert acknowledge DTO ──
export class AcknowledgeAlertDto {
  @ApiPropertyOptional({ description: 'Note about the acknowledgment' })
  @IsOptional()
  @IsString()
  note?: string;
}
