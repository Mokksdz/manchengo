/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SEND BC DTO — Envoi de Bon de Commande au fournisseur
 * ═══════════════════════════════════════════════════════════════════════════════
 * TRANSITION: DRAFT → SENT
 * 
 * RÈGLE P0.1: Un BC ne peut JAMAIS être marqué SENT sans PREUVE d'envoi
 * - Mode EMAIL: email envoyé automatiquement, messageId stocké
 * - Mode MANUAL: preuve obligatoire (URL ou note explicative)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsOptional, 
  IsString, 
  IsEmail, 
  IsEnum, 
  ValidateIf, 
  IsNotEmpty, 
  MinLength,
  IsUUID,
} from 'class-validator';

/**
 * Mode d'envoi du BC
 */
export enum SendVia {
  EMAIL = 'EMAIL',   // Envoi email automatique
  MANUAL = 'MANUAL', // Envoi manuel (fax, téléphone, remise en main propre)
}

/**
 * DTO pour l'envoi d'un BC au fournisseur
 * 
 * RÈGLE MÉTIER: Preuve obligatoire dans tous les cas
 * - EMAIL: supplierEmail requis
 * - MANUAL: proofNote requis (min 20 caractères)
 */
export class SendBcDto {
  @ApiProperty({ 
    description: 'Mode d\'envoi du BC',
    enum: SendVia,
    example: SendVia.EMAIL
  })
  @IsEnum(SendVia, { message: 'sendVia doit être EMAIL ou MANUAL' })
  sendVia: SendVia;

  @ApiPropertyOptional({ 
    description: 'Email du fournisseur (OBLIGATOIRE si sendVia = EMAIL)',
    example: 'commandes@fournisseur.dz'
  })
  @ValidateIf((o) => o.sendVia === SendVia.EMAIL)
  @IsEmail({}, { message: 'Email fournisseur invalide' })
  @IsNotEmpty({ message: 'Email fournisseur obligatoire pour envoi EMAIL' })
  supplierEmail?: string;

  @ApiPropertyOptional({ 
    description: 'Copie à une adresse email supplémentaire' 
  })
  @IsOptional()
  @IsEmail()
  ccEmail?: string;

  @ApiPropertyOptional({ 
    description: 'Message personnalisé pour le fournisseur' 
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ 
    description: 'Note de preuve d\'envoi (OBLIGATOIRE si sendVia = MANUAL, min 20 caractères)',
    example: 'Envoyé par fax au 021 XX XX XX, confirmation reçue par téléphone de M. Ahmed'
  })
  @ValidateIf((o) => o.sendVia === SendVia.MANUAL)
  @IsString()
  @IsNotEmpty({ message: 'Note de preuve obligatoire pour envoi MANUAL' })
  @MinLength(20, { message: 'La note de preuve doit contenir au moins 20 caractères' })
  proofNote?: string;

  @ApiPropertyOptional({ 
    description: 'URL de la preuve uploadée (capture écran, accusé réception...)',
  })
  @IsOptional()
  @IsString()
  proofUrl?: string;

  @ApiPropertyOptional({ 
    description: 'Clé d\'idempotence pour éviter double envoi',
  })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}

/**
 * Réponse après envoi de BC
 */
export class SendBcResponseDto {
  @ApiProperty({ description: 'ID du BC' })
  id: string;

  @ApiProperty({ description: 'Référence du BC' })
  reference: string;

  @ApiProperty({ description: 'Nouveau statut' })
  status: string;

  @ApiProperty({ description: 'Date d\'envoi' })
  sentAt: Date;

  @ApiProperty({ description: 'Mode d\'envoi utilisé', enum: SendVia })
  sentVia: SendVia;

  @ApiProperty({ description: 'Email envoyé (si applicable)' })
  emailSent: boolean;

  @ApiProperty({ description: 'Message de confirmation' })
  message: string;
}
