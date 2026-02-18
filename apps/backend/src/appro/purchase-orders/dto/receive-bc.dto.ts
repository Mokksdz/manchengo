/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RECEIVE BC DTO — Réception de Bon de Commande
 * ═══════════════════════════════════════════════════════════════════════════════
 * TRANSITION: SENT/CONFIRMED → PARTIAL/RECEIVED
 * ACTION: Crée StockMovement + Met à jour stock MP + Clôture Demande
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Ligne de réception pour une MP spécifique
 */
export class ReceiveLineDto {
  @ApiProperty({ description: 'ID de la ligne du BC (PurchaseOrderItem)' })
  @IsString()
  itemId: string;

  @ApiProperty({ description: 'Quantité effectivement reçue' })
  @IsNumber()
  @Min(0)
  quantityReceived: number;

  @ApiProperty({ description: 'Numéro de lot fournisseur (obligatoire si quantité > 0)' })
  @ValidateIf((o) => o.quantityReceived > 0)
  @IsNotEmpty({ message: 'Le numéro de lot est obligatoire pour la traçabilité' })
  @IsString()
  lotNumber?: string;

  @ApiProperty({ description: 'Date d\'expiration du lot (obligatoire si quantité > 0)' })
  @ValidateIf((o) => o.quantityReceived > 0)
  @IsNotEmpty({ message: 'La date d\'expiration (DLC) est obligatoire pour la traçabilité alimentaire' })
  @IsDateString({}, { message: 'Format de date invalide (attendu: YYYY-MM-DD)' })
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Note sur la ligne' })
  @IsOptional()
  @IsString()
  note?: string;
}

/**
 * DTO pour la réception d'un BC
 */
export class ReceiveBcDto {
  @ApiProperty({ 
    description: 'Lignes reçues',
    type: [ReceiveLineDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines: ReceiveLineDto[];

  @ApiPropertyOptional({ 
    description: 'Numéro du bon de livraison fournisseur',
    example: 'BL-2025-001234'
  })
  @IsOptional()
  @IsString()
  blNumber?: string;

  @ApiPropertyOptional({ description: 'Date de réception (défaut: maintenant)' })
  @IsOptional()
  @IsDateString()
  receptionDate?: string;

  @ApiPropertyOptional({ description: 'Notes générales sur la réception' })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Réponse après réception de BC
 */
export class ReceiveBcResponseDto {
  @ApiProperty({ description: 'ID du BC' })
  id: string;

  @ApiProperty({ description: 'Référence du BC' })
  reference: string;

  @ApiProperty({ description: 'Nouveau statut (PARTIAL ou RECEIVED)' })
  status: string;

  @ApiProperty({ description: 'ID de la réception MP créée' })
  receptionMpId: number;

  @ApiProperty({ description: 'Référence de la réception MP' })
  receptionMpReference: string;

  @ApiProperty({ description: 'Nombre de mouvements de stock créés' })
  stockMovementsCreated: number;

  @ApiProperty({ description: 'Message de confirmation' })
  message: string;
}
