import {
  IsInt,
  IsPositive,
  IsString,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@prisma/client';

/**
 * DTO ajustement inventaire MP/PF
 * Opération sensible - validation stricte anti-fraude
 */
export class AdjustInventoryDto {
  @ApiProperty({ description: 'ID produit', example: 1 })
  @IsInt({ message: 'productId doit être un entier' })
  @IsPositive({ message: 'productId doit être positif' })
  productId: number;

  @ApiProperty({ description: 'Stock physique compté', example: 95 })
  @IsInt({ message: 'physicalQuantity doit être un entier' })
  @Min(0, { message: 'physicalQuantity ne peut être négatif' })
  @Max(10000000, { message: 'physicalQuantity ne peut dépasser 10 000 000' })
  physicalQuantity: number;

  @ApiProperty({ description: 'Motif de l\'ajustement (obligatoire pour traçabilité)', example: 'Inventaire mensuel - écart constaté' })
  @IsString({ message: 'reason doit être une chaîne' })
  @MinLength(10, { message: 'reason doit contenir au moins 10 caractères' })
  @MaxLength(500, { message: 'reason ne peut dépasser 500 caractères' })
  reason: string;

  @ApiPropertyOptional({ description: 'Photos preuve (URLs)', example: ['https://...'] })
  @IsOptional()
  @IsArray({ message: 'evidencePhotos doit être un tableau' })
  @IsString({ each: true, message: 'Chaque photo doit être une URL string' })
  evidencePhotos?: string[];
}

/**
 * DTO inventaire MP spécifique
 */
export class AdjustInventoryMpDto extends AdjustInventoryDto {
  // Hérite de AdjustInventoryDto
  // ProductType = 'MP' sera forcé côté controller
}

/**
 * DTO inventaire PF spécifique
 */
export class AdjustInventoryPfDto extends AdjustInventoryDto {
  // Hérite de AdjustInventoryDto
  // ProductType = 'PF' sera forcé côté controller
}
