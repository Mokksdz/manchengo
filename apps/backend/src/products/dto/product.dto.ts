import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  Matches,
  MinLength,
  Min,
} from 'class-validator';

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT DTOs - Articles (MP, PF, CONSOMMABLE)
// ═══════════════════════════════════════════════════════════════════════════════
// Code: Préfixe selon type (MP-XXX, PF-XXX, EMB-XXX)
// Type: Définit les flux autorisés (entrée/sortie)
// ═══════════════════════════════════════════════════════════════════════════════

export enum ProductTypeDto {
  MP = 'MP',
  PF = 'PF',
  CONSOMMABLE = 'CONSOMMABLE',
}

export enum ProductMpCategoryDto {
  RAW_MATERIAL = 'RAW_MATERIAL',
  PACKAGING = 'PACKAGING',
  ADDITIVE = 'ADDITIVE',
  CONSUMABLE = 'CONSUMABLE',
}

export class CreateProductMpDto {
  @IsOptional()
  @IsString()
  @Matches(/^MP-\d{3,}$/, {
    message: 'Code invalide: format MP-XXX requis (ex: MP-001)',
  })
  code?: string; // Auto-généré si non fourni

  @IsString()
  @IsNotEmpty({ message: 'Le nom du produit est obligatoire' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: "L'unité de mesure est obligatoire" })
  unit: string;

  @IsOptional()
  @IsEnum(ProductMpCategoryDto, { message: 'Catégorie invalide' })
  category?: ProductMpCategoryDto;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Le stock minimum doit être positif ou zéro' })
  minStock?: number;

  @IsOptional()
  @IsBoolean()
  isStockTracked?: boolean; // false pour Eau, électricité, etc.

  @IsOptional()
  @IsNumber()
  defaultTvaRate?: number; // 0, 9, ou 19
}

export class UpdateProductMpDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  name?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Le stock minimum doit être positif ou zéro' })
  minStock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductPfDto {
  @IsString()
  @IsNotEmpty({ message: 'Le code produit est obligatoire' })
  @Matches(/^PF-\d{3,}$/, {
    message: 'Code invalide: format PF-XXX requis (ex: PF-001)',
  })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom du produit est obligatoire' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: "L'unité de mesure est obligatoire" })
  unit: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Le prix HT doit être positif' })
  priceHt?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Le stock minimum doit être positif ou zéro' })
  minStock?: number;
}

export class UpdateProductPfDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  name?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Le prix HT doit être positif' })
  priceHt?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Le stock minimum doit être positif ou zéro' })
  minStock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProductMpResponseDto {
  id: number;
  code: string;
  name: string;
  unit: string;
  category?: string;
  minStock: number;
  isActive: boolean;
  isStockTracked?: boolean;
  defaultTvaRate?: number;
  createdAt: Date;
  updatedAt: Date;
  movementCount?: number;
  currentStock?: number;
}

export class ProductPfResponseDto {
  id: number;
  code: string;
  name: string;
  unit: string;
  priceHt: number;
  minStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  movementCount?: number;
  currentStock?: number;
}
