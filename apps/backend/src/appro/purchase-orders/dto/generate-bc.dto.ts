/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GENERATE BC DTO — Génération de Bon de Commande depuis Demande validée
 * ═══════════════════════════════════════════════════════════════════════════════
 * RÈGLE: Le BC est TOUJOURS généré depuis une Demande APPRO validée
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsDateString,
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Prix unitaire override pour une MP spécifique
 * Utilisé quand le dernier prix fournisseur n'est pas disponible
 */
export class PriceOverrideDto {
  @ApiProperty({ description: 'ID du produit MP' })
  @IsNumber()
  productMpId: number;

  @ApiProperty({ description: 'Prix unitaire HT en DA' })
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

/**
 * DTO pour la génération de BC depuis une Demande validée
 */
export class GenerateBcDto {
  @ApiPropertyOptional({ 
    description: 'Date de livraison attendue',
    example: '2025-01-15T00:00:00.000Z'
  })
  @IsOptional()
  @IsDateString()
  expectedDelivery?: string;

  @ApiPropertyOptional({ description: 'Adresse de livraison' })
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional({ description: 'Notes pour le fournisseur' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Override des prix unitaires (si dernier prix non disponible)',
    type: [PriceOverrideDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceOverrideDto)
  priceOverrides?: PriceOverrideDto[];
}

/**
 * Réponse après génération de BC
 */
export class GenerateBcResponseDto {
  @ApiProperty({ description: 'Nombre de BC générés' })
  count: number;

  @ApiProperty({ description: 'Liste des BC générés avec leur référence' })
  purchaseOrders: {
    id: string;
    reference: string;
    supplierId: number;
    supplierName: string;
    totalHT: number;
    itemsCount: number;
  }[];

  @ApiProperty({ description: 'Message de confirmation' })
  message: string;
}
