import {
  IsInt,
  IsPositive,
  IsOptional,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO complétion ordre de production
 * Consomme MP (FIFO) et crée PF
 * Opération atomique critique
 */
export class CompleteProductionDto {
  @ApiProperty({ description: 'ID ordre de production', example: 1 })
  @IsInt({ message: 'orderId doit être un entier' })
  @IsPositive({ message: 'orderId doit être positif' })
  orderId: number;

  @ApiProperty({ description: 'Quantité réellement produite', example: 100 })
  @IsInt({ message: 'quantityProduced doit être un entier' })
  @IsPositive({ message: 'quantityProduced doit être strictement positif' })
  @Max(100000, { message: 'quantityProduced ne peut dépasser 100 000' })
  quantityProduced: number;

  @ApiPropertyOptional({ description: 'Note de production', example: 'Production normale' })
  @IsOptional()
  @IsString({ message: 'note doit être une chaîne' })
  @MaxLength(500, { message: 'note ne peut dépasser 500 caractères' })
  note?: string;
}
