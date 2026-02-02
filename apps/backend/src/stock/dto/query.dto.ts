import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO pour paramètres de pagination mouvements
 * Protection contre DoS (limit injecté)
 */
export class MovementsQueryDto {
  @ApiPropertyOptional({ description: 'Nombre max de mouvements', default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit doit être un entier' })
  @Min(1, { message: 'limit minimum: 1' })
  @Max(200, { message: 'limit maximum: 200' })
  limit?: number = 50;
}
