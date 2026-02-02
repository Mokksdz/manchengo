import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PAGINATION HELPER — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R8: Cursor-based pagination pour listes admin
 *
 * Supports both offset-based (legacy) and cursor-based pagination.
 * Cursor-based is preferred for:
 * - Large datasets
 * - Real-time data (avoids page drift)
 * - Infinite scroll UIs
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── DTO for cursor-based pagination request ──
export class CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Cursor ID for next page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Number of items per page (default: 20, max: 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortDirection?: 'asc' | 'desc' = 'desc';
}

// ── DTO for offset-based pagination request ──
export class OffsetPaginationDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (max: 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ── Response type for paginated results ──
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    hasMore: boolean;
  } & (
    | { type: 'cursor'; nextCursor: string | null }
    | { type: 'offset'; page: number; totalPages: number }
  );
}

// ── Helper to build cursor pagination response ──
export function buildCursorResponse<T extends { id: string | number }>(
  items: T[],
  total: number,
  limit: number,
): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const lastItem = data[data.length - 1];

  return {
    data,
    pagination: {
      type: 'cursor',
      total,
      limit,
      hasMore,
      nextCursor: hasMore && lastItem ? String(lastItem.id) : null,
    },
  };
}

// ── Helper to build offset pagination response ──
export function buildOffsetResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data: items,
    pagination: {
      type: 'offset',
      total,
      limit,
      page,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}
