import { IsDateString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Export format options
 */
export enum ExportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
}

/**
 * Date range query for fiscal exports
 * 
 * Algerian fiscal periods are typically:
 * - Monthly for VAT declarations
 * - Quarterly for stock reports
 * - Annual for fiscal closure
 */
export class DateRangeQueryDto {
  @ApiProperty({ description: 'Start date (ISO8601)', example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO8601)', example: '2024-12-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ enum: ExportFormat, default: ExportFormat.PDF })
  @IsEnum(ExportFormat)
  @IsOptional()
  format?: ExportFormat = ExportFormat.PDF;
}

/**
 * Company fiscal information
 * Required on all official documents
 */
export interface CompanyInfo {
  name: string;
  address: string;
  nif: string;        // Numéro d'Identification Fiscale
  nis: string;        // Numéro d'Identification Statistique
  rc: string;         // Registre de Commerce
  ai: string;         // Article d'Imposition
  phone: string;
  email: string;
}

/**
 * Sales journal entry (one per invoice)
 */
export interface SalesJournalEntry {
  date: Date;
  invoiceRef: string;
  clientName: string;
  clientNif: string | null;
  amountHt: number;      // Montant HT (centimes)
  amountTva: number;     // TVA 19% (centimes)
  amountTimbre: number;  // Timbre fiscal (centimes)
  amountTtc: number;     // Total TTC (centimes)
  paymentMethod: string;
}

/**
 * VAT journal entry
 */
export interface VatJournalEntry {
  date: Date;
  invoiceRef: string;
  clientName: string;
  clientNif: string | null;
  amountHt: number;
  tvaRate: number;       // 19 for 19%
  amountTva: number;
}

/**
 * Stamp duty entry (cash invoices only)
 */
export interface StampDutyEntry {
  date: Date;
  invoiceRef: string;
  clientName: string;
  amountTtc: number;
  stampRate: number;     // Rate applied (0.01 = 1%)
  stampAmount: number;
}

/**
 * Stock movement summary for a product
 */
export interface StockStatementEntry {
  productCode: string;
  productName: string;
  unit: string;
  initialStock: number;
  entries: number;
  exits: number;
  finalStock: number;
  averageValue: number;  // For MP: purchase price, for PF: production cost
}

/**
 * Stock statement totals
 */
export interface StockStatementSummary {
  mp: StockStatementEntry[];
  pf: StockStatementEntry[];
  totalMpValue: number;
  totalPfValue: number;
}
