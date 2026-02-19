import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, IsOptional, IsNotEmpty, MinLength, Min, Max, IsDateString, IsNumber } from 'class-validator';

/**
 * DTO pour créer un ordre de production
 */
export class CreateProductionOrderDto {
  @ApiProperty({
    description: 'ID du produit fini à produire',
    example: 1,
  })
  @IsInt()
  @Min(1)
  productPfId: number;

  @ApiProperty({
    description: 'Nombre de batchs à produire',
    example: 2,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  batchCount: number;

  @ApiPropertyOptional({
    description: 'Date planifiée de production (ISO 8601)',
    example: '2026-02-10',
  })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({
    description: 'Notes additionnelles',
    example: 'Commande urgente client X',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO pour compléter une production
 */
export class CompleteProductionDto {
  @ApiProperty({
    description: 'Quantité réellement produite (doit être > 0, sinon annuler la production)',
    example: 95,
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: 'La quantité produite doit être supérieure à 0. Pour une production nulle, utilisez l\'annulation.' })
  quantityProduced: number;

  @ApiPropertyOptional({
    description: 'Poids réel du batch (kg)',
    example: 48.5,
  })
  @IsOptional()
  @IsNumber()
  batchWeightReal?: number;

  @ApiPropertyOptional({
    description: 'Statut qualité (PASSED, FAILED, PENDING)',
    example: 'PASSED',
    enum: ['PASSED', 'FAILED', 'PENDING'],
  })
  @IsOptional()
  @IsString()
  qualityStatus?: string;

  @ApiPropertyOptional({
    description: 'Notes de contrôle qualité',
    example: 'Conforme aux spécifications',
  })
  @IsOptional()
  @IsString()
  qualityNotes?: string;

  @ApiPropertyOptional({
    description: 'Notes de fin de production',
    example: 'Perte de 5% due à équipement',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO pour annuler une production
 */
export class CancelProductionDto {
  @ApiProperty({
    description: 'Raison de l\'annulation (obligatoire pour traçabilité audit)',
    example: 'Matières premières insuffisantes',
  })
  @IsNotEmpty({ message: 'Le motif d\'annulation est obligatoire pour la traçabilité' })
  @IsString()
  @MinLength(10, { message: 'Le motif doit contenir au moins 10 caractères' })
  reason: string;
}

/**
 * DTO pour mettre à jour la date planifiée
 */
export class UpdateScheduledDateDto {
  @ApiProperty({
    description: 'Nouvelle date planifiée (null pour retirer la planification)',
    example: '2026-02-15',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  scheduledDate: string | null;
}

/**
 * DTO pour les filtres de requête
 */
export class ProductionQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrer par statut',
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    example: 'PENDING',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Nombre maximum de résultats',
    example: 50,
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Offset pour pagination',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

/**
 * Response DTO pour un ordre de production
 */
export class ProductionOrderResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'PRD-2026-0042' })
  reference: string;

  @ApiProperty({ example: 'PENDING' })
  status: string;

  @ApiProperty({ example: 1 })
  productPfId: number;

  @ApiProperty({ example: 2 })
  batchCount: number;

  @ApiProperty({ example: 100 })
  targetQuantity: number;

  @ApiProperty({ example: 0 })
  quantityProduced: number;

  @ApiPropertyOptional({ example: 95.5 })
  yieldPercentage?: number;

  @ApiPropertyOptional({ example: '2026-02-10T00:00:00.000Z' })
  scheduledDate?: string;

  @ApiProperty({ example: '2026-02-03T12:00:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({ example: '2026-02-03T14:00:00.000Z' })
  startedAt?: string;

  @ApiPropertyOptional({ example: '2026-02-03T16:00:00.000Z' })
  completedAt?: string;
}

/**
 * Response DTO pour les KPIs dashboard
 */
export class ProductionKpisResponseDto {
  @ApiProperty({
    description: 'KPIs du jour',
    example: { completed: 5, inProgress: 2, pending: 3, totalProduced: 500 },
  })
  today: {
    completed: number;
    inProgress: number;
    pending: number;
    totalProduced: number;
  };

  @ApiProperty({
    description: 'KPIs de la semaine',
    example: { completed: 25, totalProduced: 2500, avgYield: 94.5, lowYieldCount: 2 },
  })
  week: {
    completed: number;
    totalProduced: number;
    avgYield: number;
    lowYieldCount: number;
  };

  @ApiProperty({
    description: 'KPIs du mois',
    example: { completed: 100, totalProduced: 10000 },
  })
  month: {
    completed: number;
    totalProduced: number;
  };

  @ApiProperty({ example: 5 })
  activeOrders: number;

  @ApiProperty({ example: 1 })
  blockedOrders: number;
}

/**
 * DTO pour vérification de stock planning
 */
export class CheckPlanningStockDto {
  @ApiProperty({
    description: 'Liste des items à vérifier',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        recipeId: { type: 'number', example: 1 },
        batchCount: { type: 'number', example: 2 },
      },
    },
  })
  items: Array<{ recipeId: number; batchCount: number }>;
}
