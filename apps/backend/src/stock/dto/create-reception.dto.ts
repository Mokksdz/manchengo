import {
  IsInt,
  IsPositive,
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO ligne de réception MP
 * Validation stricte pour éviter corruption stock
 */
export class ReceptionLineDto {
  @ApiProperty({ description: 'ID produit MP', example: 1 })
  @IsInt({ message: 'productMpId doit être un entier' })
  @IsPositive({ message: 'productMpId doit être positif' })
  productMpId: number;

  @ApiProperty({ description: 'Quantité reçue (unité de base)', example: 100 })
  @IsInt({ message: 'quantity doit être un entier' })
  @IsPositive({ message: 'quantity doit être strictement positif' })
  @Max(1000000, { message: 'quantity ne peut dépasser 1 000 000' })
  quantity: number;

  @ApiPropertyOptional({ description: 'Coût unitaire en centimes', example: 15000 })
  @IsOptional()
  @IsInt({ message: 'unitCost doit être un entier (centimes)' })
  @Min(0, { message: 'unitCost ne peut être négatif' })
  @Max(100000000, { message: 'unitCost ne peut dépasser 1 000 000 DA' })
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Numéro de lot fournisseur', example: 'LOT-2024-001' })
  @IsOptional()
  @IsString({ message: 'lotNumber doit être une chaîne' })
  lotNumber?: string;

  @ApiPropertyOptional({ description: 'Date d\'expiration (DLC)', example: '2024-06-30' })
  @IsOptional()
  @IsDateString({}, { message: 'expiryDate doit être une date valide ISO' })
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Date de fabrication', example: '2024-01-15' })
  @IsOptional()
  @IsDateString({}, { message: 'manufactureDate doit être une date valide ISO' })
  manufactureDate?: string;
}

/**
 * DTO création réception MP
 * Point d'entrée stock - validation critique
 */
export class CreateReceptionDto {
  @ApiProperty({ description: 'ID fournisseur', example: 1 })
  @IsInt({ message: 'supplierId doit être un entier' })
  @IsPositive({ message: 'supplierId doit être positif' })
  supplierId: number;

  @ApiProperty({ description: 'Date de réception', example: '2024-01-20T10:00:00Z' })
  @IsDateString({}, { message: 'date doit être une date valide ISO' })
  date: string;

  @ApiPropertyOptional({ description: 'Numéro bon de livraison fournisseur', example: 'BL-2024-0123' })
  @IsOptional()
  @IsString({ message: 'blNumber doit être une chaîne' })
  blNumber?: string;

  @ApiPropertyOptional({ description: 'Note/commentaire', example: 'Réception complète' })
  @IsOptional()
  @IsString({ message: 'note doit être une chaîne' })
  note?: string;

  @ApiProperty({ description: 'Lignes de réception', type: [ReceptionLineDto] })
  @IsArray({ message: 'lines doit être un tableau' })
  @ArrayMinSize(1, { message: 'Au moins une ligne de réception requise' })
  @ValidateNested({ each: true })
  @Type(() => ReceptionLineDto)
  lines: ReceptionLineDto[];
}
