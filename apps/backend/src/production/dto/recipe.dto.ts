import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  ValidateNested,
  ValidateIf,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

enum RecipeItemType {
  MP = 'MP',
  FLUID = 'FLUID',
  PACKAGING = 'PACKAGING',
}

export class CreateRecipeItemDto {
  @ApiPropertyOptional({ enum: RecipeItemType, default: 'MP' })
  @IsOptional()
  @IsEnum(RecipeItemType)
  type?: 'MP' | 'FLUID' | 'PACKAGING';

  @ApiPropertyOptional({ description: 'ID du produit MP (requis pour type MP et PACKAGING)' })
  @ValidateIf((o) => o.type !== 'FLUID')
  @IsInt()
  @Min(1)
  productMpId?: number;

  @ApiPropertyOptional({ description: 'Nom de l\'ingrédient (pour FLUID/PACKAGING)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Quantité nécessaire', example: 500 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ description: 'Unité de mesure', example: 'g' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({ description: 'Coût unitaire' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Affecte le stock', default: true })
  @IsOptional()
  @IsBoolean()
  affectsStock?: boolean;

  @ApiPropertyOptional({ description: 'Ingrédient obligatoire', default: true })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional({ description: 'Substituable', default: false })
  @IsOptional()
  @IsBoolean()
  isSubstitutable?: boolean;

  @ApiPropertyOptional({ description: 'IDs des substituts possibles', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  substituteIds?: number[];

  @ApiPropertyOptional({ description: 'Ordre de tri' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateRecipeDto {
  @ApiProperty({ description: 'ID du produit fini', example: 1 })
  @IsInt()
  @Min(1)
  productPfId: number;

  @ApiProperty({ description: 'Nom de la recette', example: 'Recette Manchego 400g' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Poids du batch en grammes', example: 5000 })
  @IsNumber()
  @Min(1)
  batchWeight: number;

  @ApiProperty({ description: 'Quantité de sortie', example: 10 })
  @IsNumber()
  @Min(1)
  outputQuantity: number;

  @ApiPropertyOptional({ description: 'Tolérance de perte (0.0 à 1.0, ex: 0.02 = 2%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  lossTolerance?: number;

  @ApiPropertyOptional({ description: 'Temps de production (minutes)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  productionTime?: number;

  @ApiPropertyOptional({ description: 'Durée de vie (jours)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  shelfLifeDays?: number;

  @ApiProperty({ description: 'Liste des ingrédients', type: [CreateRecipeItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeItemDto)
  items: CreateRecipeItemDto[];
}
