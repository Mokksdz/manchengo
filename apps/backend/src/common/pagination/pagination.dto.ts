/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PAGINATION DTOs — Request & Response types
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

// ═══════════════════════════════════════════════════════════════════════════════
// CURSOR PAGINATION
// ═══════════════════════════════════════════════════════════════════════════════

export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination (base64 encoded)',
    example: 'eyJpZCI6MTIzfQ==',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SortDirection,
    default: SortDirection.DESC,
  })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection;

  @ApiPropertyOptional({
    description: 'Pagination direction',
    enum: ['forward', 'backward'],
    default: 'forward',
  })
  @IsOptional()
  @IsString()
  direction?: 'forward' | 'backward';
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFSET PAGINATION
// ═══════════════════════════════════════════════════════════════════════════════

export class OffsetPaginationDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SortDirection,
    default: SortDirection.DESC,
  })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export class CursorPaginationMeta {
  @ApiProperty({ description: 'Current cursor', nullable: true })
  cursor: string | null;

  @ApiProperty({ description: 'Cursor for next page', nullable: true })
  nextCursor: string | null;

  @ApiProperty({ description: 'Cursor for previous page', nullable: true })
  prevCursor: string | null;

  @ApiProperty({ description: 'Whether more items exist' })
  hasMore: boolean;

  @ApiProperty({ description: 'Whether previous items exist' })
  hasPrevious: boolean;

  @ApiProperty({ description: 'Items per page' })
  limit: number;
}

export class OffsetPaginationMeta {
  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of items' })
  total: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether next page exists' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether previous page exists' })
  hasPrevious: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC PAGINATED RESPONSE
// ═══════════════════════════════════════════════════════════════════════════════

export class CursorPaginatedResponse<T> {
  data: T[];
  pagination: CursorPaginationMeta;
}

export class OffsetPaginatedResponse<T> {
  data: T[];
  pagination: OffsetPaginationMeta;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTERS COMMON
// ═══════════════════════════════════════════════════════════════════════════════

export class DateRangeFilterDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  toDate?: string;
}

export class SearchFilterDto {
  @ApiPropertyOptional({
    description: 'Search query',
    example: 'farine',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;
}
