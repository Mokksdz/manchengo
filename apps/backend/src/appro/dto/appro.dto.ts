/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * APPRO DTOs - Data Transfer Objects
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { IsInt, IsOptional, IsEnum, IsNumber, Min, Max, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MpCriticite } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE PRODUCT MP (APPRO FIELDS)
// ═══════════════════════════════════════════════════════════════════════════════

export class UpdateProductMpApproDto {
  @ApiPropertyOptional({ description: 'Seuil de sécurité (stock minimum de sécurité)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  seuilSecurite?: number;

  @ApiPropertyOptional({ description: 'Seuil de commande (déclenche une commande)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  seuilCommande?: number;

  @ApiPropertyOptional({ description: 'Quantité standard de commande' })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantiteCommande?: number;

  @ApiPropertyOptional({ description: 'Lead time fournisseur en jours' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  leadTimeFournisseur?: number;

  @ApiPropertyOptional({ description: 'Niveau de criticité', enum: MpCriticite })
  @IsOptional()
  @IsEnum(MpCriticite)
  criticite?: MpCriticite;

  @ApiPropertyOptional({ description: 'ID du fournisseur principal' })
  @IsOptional()
  @IsInt()
  fournisseurPrincipalId?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY PARAMS
// ═══════════════════════════════════════════════════════════════════════════════

export class StockMpQueryDto {
  @ApiPropertyOptional({ description: 'Filtrer par état', enum: ['SAIN', 'SOUS_SEUIL', 'A_COMMANDER', 'RUPTURE', 'BLOQUANT_PRODUCTION'] })
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ description: 'Filtrer par criticité', enum: MpCriticite })
  @IsOptional()
  @IsEnum(MpCriticite)
  criticite?: MpCriticite;

  @ApiPropertyOptional({ description: 'Uniquement les MP critiques pour production' })
  @IsOptional()
  criticalOnly?: boolean;
}

export class PerformanceQueryDto {
  @ApiPropertyOptional({ description: 'Nombre de jours pour le calcul des métriques', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(365)
  @Type(() => Number)
  days?: number = 30;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════════

export class CheckProductionDto {
  @ApiProperty({ description: 'ID de la recette' })
  @IsInt()
  @Type(() => Number)
  recipeId: number;

  @ApiProperty({ description: 'Nombre de batchs à produire' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  batchCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE TYPES (pour documentation Swagger)
// ═══════════════════════════════════════════════════════════════════════════════

export class IrsResponseDto {
  @ApiProperty({ description: 'Valeur de l\'IRS (0-100)' })
  value: number;

  @ApiProperty({ description: 'Statut global', enum: ['SAIN', 'SURVEILLANCE', 'CRITIQUE'] })
  status: string;

  @ApiProperty({ description: 'Détails du calcul' })
  details: {
    mpRupture: number;
    mpSousSeuil: number;
    mpCritiquesProduction: number;
  };
}

export class StockStatsDto {
  @ApiProperty() total: number;
  @ApiProperty() sain: number;
  @ApiProperty() sousSeuil: number;
  @ApiProperty() aCommander: number;
  @ApiProperty() rupture: number;
  @ApiProperty() bloquantProduction: number;
}

export class DashboardResponseDto {
  @ApiProperty({ type: IrsResponseDto })
  irs: IrsResponseDto;

  @ApiProperty({ type: StockStatsDto })
  stockStats: StockStatsDto;

  @ApiProperty({ description: 'MP critiques pour la production (top 5)' })
  mpCritiquesProduction: any[];

  @ApiProperty() alertesActives: number;
  @ApiProperty() demandesEnAttente: number;
  @ApiProperty() receptionsAttendues: number;
}

export class ProductionCheckResponseDto {
  @ApiProperty({ description: 'Peut démarrer la production' })
  canStart: boolean;

  @ApiProperty({ description: 'Liste des MP bloquantes' })
  blockers: {
    productMpId: number;
    name: string;
    required: number;
    available: number;
    shortage: number;
  }[];
}

export class RequisitionSuggestionDto {
  @ApiProperty() productMpId: number;
  @ApiProperty() productMp: { code: string; name: string; unit: string };
  @ApiProperty() currentStock: number;
  @ApiProperty() seuilCommande: number;
  @ApiProperty() quantiteRecommandee: number;
  @ApiProperty({ enum: ['CRITIQUE', 'ELEVEE', 'NORMALE'] }) priority: string;
  @ApiProperty({ nullable: true }) fournisseurSuggere: { id: number; name: string; grade: string } | null;
  @ApiProperty() justification: string;
  @ApiProperty({ nullable: true }) joursCouvertureActuels: number | null;
  @ApiProperty() impactProduction: string[];
}

export class SupplierPerformanceDto {
  @ApiProperty() id: number;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: ['A', 'B', 'C'] }) grade: string;
  @ApiProperty() scorePerformance: number;
  @ApiProperty() metrics: {
    delaiReelMoyen: number | null;
    leadTimeAnnonce: number;
    tauxRetard: number;
    tauxEcartQuantite: number;
    tauxRupturesCausees: number;
  };
  @ApiProperty() stats: {
    totalLivraisons: number;
    livraisonsRetard: number;
  };
  @ApiProperty() productsMpCount: number;
}
