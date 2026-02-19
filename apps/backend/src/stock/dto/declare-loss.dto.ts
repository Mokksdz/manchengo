import {
  IsInt,
  IsPositive,
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@prisma/client';

/**
 * Raisons de perte autorisées
 * Limitées pour anti-fraude
 */
export enum LossReason {
  DLC_EXPIRED = 'DLC_EXPIRED',           // DLC dépassée
  QUALITY_DEFECT = 'QUALITY_DEFECT',     // Défaut qualité
  DAMAGE = 'DAMAGE',                     // Casse/dommage
  CONTAMINATION = 'CONTAMINATION',       // Contamination
  INVENTORY_ADJUSTMENT = 'INVENTORY_ADJUSTMENT', // Ajustement inventaire
  OTHER = 'OTHER',                       // Autre (nécessite justification détaillée)
}

/**
 * DTO déclaration de perte MP/PF
 * ADMIN uniquement - traçabilité obligatoire
 */
export class DeclareLossDto {
  @ApiProperty({ enum: ProductType, description: 'Type de produit', example: 'MP' })
  @IsEnum(ProductType, { message: 'productType doit être MP ou PF' })
  productType: ProductType;

  @ApiProperty({ description: 'ID produit', example: 1 })
  @IsInt({ message: 'productId doit être un entier' })
  @IsPositive({ message: 'productId doit être positif' })
  productId: number;

  @ApiPropertyOptional({ description: 'ID lot spécifique (si applicable)', example: 5 })
  @IsOptional()
  @IsInt({ message: 'lotId doit être un entier' })
  @IsPositive({ message: 'lotId doit être positif' })
  lotId?: number;

  @ApiProperty({ description: 'Quantité perdue', example: 10 })
  @IsInt({ message: 'quantity doit être un entier' })
  @IsPositive({ message: 'quantity doit être strictement positif' })
  @Max(100000, { message: 'quantity ne peut dépasser 100 000' })
  quantity: number;

  @ApiProperty({ enum: LossReason, description: 'Raison de la perte', example: 'DLC_EXPIRED' })
  @IsEnum(LossReason, { message: 'reason doit être une raison valide' })
  reason: LossReason;

  @ApiProperty({ description: 'Description détaillée (obligatoire)', example: 'Lot expiré depuis 3 jours, odeur anormale détectée' })
  @IsString({ message: 'description doit être une chaîne' })
  @MinLength(20, { message: 'description doit contenir au moins 20 caractères pour traçabilité' })
  @MaxLength(1000, { message: 'description ne peut dépasser 1000 caractères' })
  description: string;

  @ApiPropertyOptional({ description: 'Photos preuve (URLs)', example: ['https://...'] })
  @IsOptional()
  @IsArray({ message: 'evidencePhotos doit être un tableau' })
  @IsString({ each: true, message: 'Chaque photo doit être une URL string' })
  evidencePhotos?: string[];
}
