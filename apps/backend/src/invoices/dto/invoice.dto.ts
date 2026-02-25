import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE DTOs — Facturation algerienne conforme
// ═══════════════════════════════════════════════════════════════════════════════
// Montants en centimes (entiers) pour precision monetaire
// TVA 19% standard Algerie
// Timbre fiscal optionnel (50 DA par defaut si especes)
// ═══════════════════════════════════════════════════════════════════════════════

export enum PaymentMethodDto {
  ESPECES = 'ESPECES',
  CHEQUE = 'CHEQUE',
  VIREMENT = 'VIREMENT',
}

export enum InvoiceStatusDto {
  DRAFT = 'DRAFT',
  PAID = 'PAID',
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
  @Min(0)
  unitPriceHt: number;
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
  @IsEnum(InvoiceStatusDto, { message: 'Statut: DRAFT, PAID ou CANCELLED' })
  status: InvoiceStatusDto;
}
