import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Matches,
  MinLength,
} from 'class-validator';

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT DTOs — Validation stricte avec champs fiscaux algeriens
// ═══════════════════════════════════════════════════════════════════════════════

export enum ClientTypeDto {
  DISTRIBUTEUR = 'DISTRIBUTEUR',
  GROSSISTE = 'GROSSISTE',
  SUPERETTE = 'SUPERETTE',
  FAST_FOOD = 'FAST_FOOD',
}

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom du client est obligatoire' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caracteres' })
  name: string;

  @IsEnum(ClientTypeDto, { message: 'Type invalide: DISTRIBUTEUR, GROSSISTE, SUPERETTE ou FAST_FOOD' })
  @IsOptional()
  type?: ClientTypeDto;

  @IsString()
  @IsOptional()
  nif?: string;

  @IsString()
  @IsOptional()
  rc?: string;

  @IsString()
  @IsOptional()
  ai?: string;

  @IsString()
  @IsOptional()
  nis?: string;

  @IsString()
  @IsOptional()
  @Matches(/^0[567]\d{8}$/, {
    message: 'Telephone invalide: format algerien attendu (05/06/07 + 8 chiffres)',
  })
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;
}

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caracteres' })
  name?: string;

  @IsEnum(ClientTypeDto, { message: 'Type invalide' })
  @IsOptional()
  type?: ClientTypeDto;

  @IsString()
  @IsOptional()
  nif?: string;

  @IsString()
  @IsOptional()
  rc?: string;

  @IsString()
  @IsOptional()
  ai?: string;

  @IsString()
  @IsOptional()
  nis?: string;

  @IsString()
  @IsOptional()
  @Matches(/^0[567]\d{8}$/, {
    message: 'Telephone invalide: format algerien attendu',
  })
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
