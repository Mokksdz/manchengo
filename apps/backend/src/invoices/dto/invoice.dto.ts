import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsString,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE DTOs — Facturation algerienne conforme
// ═══════════════════════════════════════════════════════════════════════════════
// Montants en centimes (entiers) pour precision monetaire
// TVA 19% standard Algerie
// Timbre fiscal bareme progressif (1%, 1.5%, 2%) si paiement especes
// ═══════════════════════════════════════════════════════════════════════════════

export enum PaymentMethodDto {
  ESPECES = 'ESPECES',
  CHEQUE = 'CHEQUE',
  VIREMENT = 'VIREMENT',
}

export enum InvoiceStatusDto {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PAID = 'PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  CANCELLED = 'CANCELLED',
}

export class CreateInvoiceLineDto {
  @IsInt()
  @Min(1)
  productPfId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsInt()
  @Min(1, { message: 'Le prix unitaire HT doit être au moins 1 centime' })
  unitPriceHt: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  remise?: number;
}

export class CreateInvoiceDto {
  @IsInt()
  @IsNotEmpty({ message: 'Le client est obligatoire' })
  clientId: number;

  @IsDateString()
  @IsNotEmpty({ message: 'La date est obligatoire' })
  date: string;

  @IsEnum(PaymentMethodDto, { message: 'Mode de paiement: ESPECES, CHEQUE ou VIREMENT' })
  paymentMethod: PaymentMethodDto;

  @IsArray()
  @ArrayMinSize(1, { message: 'Une facture doit contenir au moins une ligne' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines: CreateInvoiceLineDto[];
}

export class UpdateInvoiceDto {
  @IsOptional()
  @IsInt()
  clientId?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(PaymentMethodDto, { message: 'Mode de paiement: ESPECES, CHEQUE ou VIREMENT' })
  paymentMethod?: PaymentMethodDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines?: CreateInvoiceLineDto[];
}

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatusDto, { message: 'Statut: DRAFT, VALIDATED, PAID, PARTIALLY_PAID ou CANCELLED' })
  status: InvoiceStatusDto;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Le motif d\'annulation ne doit pas dépasser 500 caractères' })
  cancellationReason?: string;
}
