import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Matches,
  Length,
  MinLength,
} from 'class-validator';

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATIONS FISCALES ALGÉRIENNES - STRICTES
// ═══════════════════════════════════════════════════════════════════════════════
// RC: Registre de Commerce - alphanumérique, doit contenir au moins une lettre
// NIF: Numéro d'Identification Fiscale - exactement 15 chiffres
// AI: Article d'Imposition - alphanumérique, 3 à 20 caractères
// NIS: Numéro d'Identification Statistique - optionnel, 15 chiffres si présent
// Phone: Format algérien - commence par 05/06/07, 10 chiffres total
// ═══════════════════════════════════════════════════════════════════════════════

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom du fournisseur est obligatoire' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Le Registre de Commerce (RC) est obligatoire' })
  @Matches(/^(?=.*[A-Za-z])[A-Za-z0-9]+$/, {
    message: 'RC invalide: doit être alphanumérique et contenir au moins une lettre',
  })
  rc: string;

  @IsString()
  @IsNotEmpty({ message: 'Le NIF est obligatoire' })
  @Matches(/^\d{15}$/, {
    message: 'NIF invalide: doit contenir exactement 15 chiffres',
  })
  nif: string;

  @IsString()
  @IsNotEmpty({ message: "L'Article d'Imposition (AI) est obligatoire" })
  @Matches(/^[A-Za-z0-9]{3,20}$/, {
    message: 'AI invalide: doit être alphanumérique, entre 3 et 20 caractères',
  })
  ai: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{15}$/, {
    message: 'NIS invalide: doit contenir exactement 15 chiffres',
  })
  nis?: string;

  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire' })
  @Matches(/^(05|06|07)\d{8}$/, {
    message: 'Téléphone invalide: format algérien requis (05/06/07 + 8 chiffres)',
  })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: "L'adresse est obligatoire" })
  @MinLength(5, { message: "L'adresse doit contenir au moins 5 caractères" })
  address: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?=.*[A-Za-z])[A-Za-z0-9]+$/, {
    message: 'RC invalide: doit être alphanumérique et contenir au moins une lettre',
  })
  rc?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{15}$/, {
    message: 'NIF invalide: doit contenir exactement 15 chiffres',
  })
  nif?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{3,20}$/, {
    message: 'AI invalide: doit être alphanumérique, entre 3 et 20 caractères',
  })
  ai?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{15}$/, {
    message: 'NIS invalide: doit contenir exactement 15 chiffres',
  })
  nis?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(05|06|07)\d{8}$/, {
    message: 'Téléphone invalide: format algérien requis (05/06/07 + 8 chiffres)',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(5, { message: "L'adresse doit contenir au moins 5 caractères" })
  address?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SupplierResponseDto {
  id: number;
  code: string;
  name: string;
  rc: string;
  nif: string;
  ai: string;
  nis?: string;
  phone: string;
  address: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  receptionCount?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DTOs — Actions fournisseur (blocage, surveillance)
// ═══════════════════════════════════════════════════════════════════════════════

export class BlockSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'Le motif de blocage est obligatoire' })
  @MinLength(10, { message: 'Le motif doit contenir au moins 10 caractères' })
  reason: string;

  @IsOptional()
  blockedUntil?: Date;
}

export class SurveillanceSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'Le motif de surveillance est obligatoire' })
  @MinLength(10, { message: 'Le motif doit contenir au moins 10 caractères' })
  reason: string;

  @IsOptional()
  surveillanceUntil?: Date;
}
