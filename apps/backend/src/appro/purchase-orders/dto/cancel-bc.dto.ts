/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CANCEL BC DTO — Annulation sécurisée d'un Bon de Commande
 * ═══════════════════════════════════════════════════════════════════════════════
 * TRANSITION: DRAFT/SENT/CONFIRMED → CANCELLED
 * 
 * RÈGLE P0.2: Annulation contrôlée avec motif obligatoire
 * - Rôle ADMIN uniquement
 * - Motif obligatoire (min 10 caractères)
 * - Interdit si réception partielle effectuée
 * - Audit log obligatoire
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, IsOptional, IsUUID } from 'class-validator';

/**
 * DTO pour l'annulation d'un BC
 */
export class CancelBcDto {
  @ApiProperty({
    description: 'Motif d\'annulation (OBLIGATOIRE, min 10 caractères)',
    example: 'Erreur de quantité - BC recréé avec les bonnes valeurs',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty({ message: 'Le motif d\'annulation est obligatoire' })
  @MinLength(10, { message: 'Le motif doit contenir au moins 10 caractères' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Clé d\'idempotence pour éviter double annulation',
  })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}

/**
 * Réponse après annulation de BC
 */
export class CancelBcResponseDto {
  @ApiProperty({ description: 'ID du BC' })
  id: string;

  @ApiProperty({ description: 'Référence du BC' })
  reference: string;

  @ApiProperty({ description: 'Nouveau statut (CANCELLED)' })
  status: string;

  @ApiProperty({ description: 'Date d\'annulation' })
  cancelledAt: Date;

  @ApiProperty({ description: 'Motif d\'annulation' })
  reason: string;

  @ApiProperty({ description: 'Message de confirmation' })
  message: string;
}
