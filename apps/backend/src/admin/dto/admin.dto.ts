import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsEmail, MinLength, IsBoolean, IsArray, ValidateNested, Min, IsNotEmpty, Matches, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

export class CreateProductMpDto {
  @ApiProperty({ example: 'MP-004' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Lait frais' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'L' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}

export class UpdateProductMpDto {
  @ApiPropertyOptional({ example: 'Lait pasteurisé' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'L' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}

export class CreateProductPfDto {
  @ApiProperty({ example: 'PF-004' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Fromage Gouda 500g' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'unité' })
  @IsString()
  unit: string;

  @ApiProperty({ example: 85000, description: 'Prix HT en centimes (850.00 DA)' })
  @IsNumber()
  @Min(0)
  priceHt: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}

export class UpdateProductPfDto {
  @ApiPropertyOptional({ example: 'Fromage Gouda 500g' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'unité' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 90000, description: 'Prix HT en centimes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceHt?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════════════════════════════════

export enum ClientType {
  DISTRIBUTEUR = 'DISTRIBUTEUR',
  GROSSISTE = 'GROSSISTE',
  SUPERETTE = 'SUPERETTE',
  FAST_FOOD = 'FAST_FOOD',
}

export class CreateClientDto {
  @ApiProperty({ example: 'CLI-004' })
  @IsString()
  @IsNotEmpty({ message: 'Le code client est obligatoire' })
  code: string;

  @ApiProperty({ example: 'Supermarché El Baraka' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du client est obligatoire' })
  name: string;

  @ApiProperty({ enum: ClientType, example: 'GROSSISTE' })
  @IsEnum(ClientType)
  type: ClientType;

  // Champs fiscaux algériens - Validation stricte conformité DGI
  @ApiProperty({ example: '000000000000000', description: 'Numéro d\'Identification Fiscale (15 chiffres)' })
  @IsString()
  @IsNotEmpty({ message: 'Le NIF est obligatoire' })
  @Matches(/^(?!0{15}$)\d{15}$/, { message: 'NIF invalide – 15 chiffres requis, ne peut pas être tout zéros' })
  nif: string;

  @ApiProperty({ example: '17B0809707', description: 'Registre de Commerce (8-15 caractères, lettres et chiffres)' })
  @IsString()
  @IsNotEmpty({ message: 'Le RC est obligatoire' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{8,15}$/, { message: 'RC invalide – doit contenir au moins une lettre et des chiffres (8 à 15 caractères)' })
  rc: string;

  @ApiProperty({ example: '16123456', description: 'Article d\'Imposition (6 à 10 chiffres)' })
  @IsString()
  @IsNotEmpty({ message: 'L\'AI est obligatoire' })
  @Matches(/^\d{6,10}$/, { message: 'AI invalide – 6 à 10 chiffres requis' })
  ai: string;

  @ApiPropertyOptional({ example: '000000000000000', description: 'Numéro d\'Identification Statistique (15 chiffres si renseigné)' })
  @IsOptional()
  @ValidateIf((o) => o.nis !== null && o.nis !== undefined && o.nis !== '')
  @Matches(/^\d{15}$/, { message: 'NIS invalide – 15 chiffres requis si renseigné' })
  nis?: string;

  @ApiPropertyOptional({ example: '+213551234567', description: 'Téléphone algérien' })
  @IsOptional()
  @ValidateIf((o) => o.phone !== null && o.phone !== undefined && o.phone !== '')
  @Matches(/^(0|\+213)[5-7]\d{8}$/, { message: 'Téléphone invalide – format: 05/06/07XXXXXXXX ou +2135/6/7XXXXXXXX' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Rue des Martyrs, Blida' })
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Supermarché El Baraka' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ClientType })
  @IsOptional()
  @IsEnum(ClientType)
  type?: ClientType;

  // Champs fiscaux algériens - Validation stricte conformité DGI
  @ApiPropertyOptional({ example: '000000000000000', description: 'Numéro d\'Identification Fiscale (15 chiffres)' })
  @IsOptional()
  @ValidateIf((o) => o.nif !== null && o.nif !== undefined && o.nif !== '')
  @Matches(/^\d{15}$/, { message: 'NIF invalide – 15 chiffres requis' })
  nif?: string;

  @ApiPropertyOptional({ example: '17B0809707', description: 'Registre de Commerce (8-15 caractères, lettres et chiffres)' })
  @IsOptional()
  @ValidateIf((o) => o.rc !== null && o.rc !== undefined && o.rc !== '')
  @Matches(/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{8,15}$/, { message: 'RC invalide – doit contenir au moins une lettre et des chiffres (8 à 15 caractères)' })
  rc?: string;

  @ApiPropertyOptional({ example: '16123456', description: 'Article d\'Imposition (6 à 10 chiffres)' })
  @IsOptional()
  @ValidateIf((o) => o.ai !== null && o.ai !== undefined && o.ai !== '')
  @Matches(/^\d{6,10}$/, { message: 'AI invalide – 6 à 10 chiffres requis' })
  ai?: string;

  @ApiPropertyOptional({ example: '000000000000000', description: 'Numéro d\'Identification Statistique (15 chiffres si renseigné)' })
  @IsOptional()
  @ValidateIf((o) => o.nis !== null && o.nis !== undefined && o.nis !== '')
  @Matches(/^\d{15}$/, { message: 'NIS invalide – 15 chiffres requis si renseigné' })
  nis?: string;

  @ApiPropertyOptional({ example: '+213551234567', description: 'Téléphone algérien' })
  @IsOptional()
  @ValidateIf((o) => o.phone !== null && o.phone !== undefined && o.phone !== '')
  @Matches(/^(0|\+213)[5-7]\d{8}$/, { message: 'Téléphone invalide – format: 05/06/07XXXXXXXX ou +2135/6/7XXXXXXXX' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Rue des Martyrs, Blida' })
  @IsOptional()
  @IsString()
  address?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════════════════════════════════════════════

export class CreateSupplierDto {
  @ApiProperty({ example: 'FOUR-003' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Laiterie du Sahel' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '+213 555 789 012' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'fournisseur@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Zone industrielle, Tipaza' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'NIF fournisseur (15 chiffres)' })
  @IsOptional()
  @ValidateIf((o) => o.nif !== null && o.nif !== undefined && o.nif !== '')
  @Matches(/^(?!0{15}$)\d{15}$/, { message: 'NIF invalide – 15 chiffres requis' })
  nif?: string;

  @ApiPropertyOptional({ description: 'Registre de Commerce' })
  @IsOptional()
  @IsString()
  rc?: string;

  @ApiPropertyOptional({ description: "Article d'Imposition" })
  @IsOptional()
  @IsString()
  ai?: string;

  @ApiPropertyOptional({ description: 'NIS fournisseur (15 chiffres si renseigné)' })
  @IsOptional()
  @ValidateIf((o) => o.nis !== null && o.nis !== undefined && o.nis !== '')
  @Matches(/^\d{15}$/, { message: 'NIS invalide – 15 chiffres requis si renseigné' })
  nis?: string;
}

export class UpdateSupplierDto {
  @ApiPropertyOptional({ example: 'Laiterie du Sahel' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+213 555 789 012' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'fournisseur@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Zone industrielle, Tipaza' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'NIF fournisseur (15 chiffres)' })
  @IsOptional()
  @ValidateIf((o) => o.nif !== null && o.nif !== undefined && o.nif !== '')
  @Matches(/^(?!0{15}$)\d{15}$/, { message: 'NIF invalide – 15 chiffres requis' })
  nif?: string;

  @ApiPropertyOptional({ description: 'Registre de Commerce' })
  @IsOptional()
  @IsString()
  rc?: string;

  @ApiPropertyOptional({ description: "Article d'Imposition" })
  @IsOptional()
  @IsString()
  ai?: string;

  @ApiPropertyOptional({ description: 'NIS fournisseur (15 chiffres si renseigné)' })
  @IsOptional()
  @ValidateIf((o) => o.nis !== null && o.nis !== undefined && o.nis !== '')
  @Matches(/^\d{15}$/, { message: 'NIS invalide – 15 chiffres requis si renseigné' })
  nis?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════

export enum UserRole {
  ADMIN = 'ADMIN',
  APPRO = 'APPRO',
  PRODUCTION = 'PRODUCTION',
  COMMERCIAL = 'COMMERCIAL',
}

export class CreateUserDto {
  @ApiProperty({ example: 'USR-004' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'user@manchengo.dz' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'P@ssword1234!', minLength: 12, description: '12+ chars, MAJ + min + chiffre + spécial' })
  @IsString()
  @MinLength(12, { message: 'Le mot de passe doit contenir au moins 12 caractères' })
  @Matches(/[A-Z]/, { message: 'Le mot de passe doit contenir au moins une majuscule' })
  @Matches(/[a-z]/, { message: 'Le mot de passe doit contenir au moins une minuscule' })
  @Matches(/[0-9]/, { message: 'Le mot de passe doit contenir au moins un chiffre' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, { message: 'Le mot de passe doit contenir au moins un caractère spécial' })
  password: string;

  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Benali' })
  @IsString()
  lastName: string;

  @ApiProperty({ enum: UserRole, example: 'COMMERCIAL' })
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'user@manchengo.dz' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Ahmed' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Benali' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'P@ssword1234!', minLength: 12, description: '12+ chars, MAJ + min + chiffre + spécial' })
  @IsString()
  @MinLength(12, { message: 'Le mot de passe doit contenir au moins 12 caractères' })
  @Matches(/[A-Z]/, { message: 'Le mot de passe doit contenir au moins une majuscule' })
  @Matches(/[a-z]/, { message: 'Le mot de passe doit contenir au moins une minuscule' })
  @Matches(/[0-9]/, { message: 'Le mot de passe doit contenir au moins un chiffre' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, { message: 'Le mot de passe doit contenir au moins un caractère spécial' })
  newPassword: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════════════════════════

export enum PaymentMethod {
  ESPECES = 'ESPECES',
  CHEQUE = 'CHEQUE',
  VIREMENT = 'VIREMENT',
}

export class InvoiceLineDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  productPfId: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 85000, description: 'Prix unitaire HT en centimes (override, doit être > 0)' })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Le prix unitaire HT doit être supérieur à 0 centime' })
  unitPriceHt?: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  clientId: number;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines: InvoiceLineDto[];

  @ApiProperty({ enum: PaymentMethod, example: 'ESPECES' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: true, description: 'Appliquer le timbre fiscal (1% pour cash)' })
  @IsOptional()
  @IsBoolean()
  applyTimbre?: boolean;
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  clientId?: number;

  @ApiPropertyOptional({ type: [InvoiceLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines?: InvoiceLineDto[];

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  applyTimbre?: boolean;
}

// Must match Prisma InvoiceStatus enum exactly
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export class UpdateInvoiceStatusDto {
  @ApiProperty({ enum: InvoiceStatus, example: 'PAID' })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK ADJUSTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export class StockAdjustmentDto {
  @ApiProperty({ enum: ['MP', 'PF'] })
  @IsEnum(['MP', 'PF'])
  productType: 'MP' | 'PF';

  @ApiProperty({ example: 1 })
  @IsNumber()
  productId: number;

  @ApiProperty({ example: 50, description: 'Positive = entrée, Negative = sortie' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 'Ajustement inventaire', description: 'Raison de l\'ajustement' })
  @IsString()
  reason: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICES
// ═══════════════════════════════════════════════════════════════════════════════

export class RevokeDeviceDto {
  @ApiPropertyOptional({ example: 'Appareil perdu' })
  @IsOptional()
  @IsString()
  reason?: string;
}
