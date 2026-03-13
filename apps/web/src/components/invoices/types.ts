export interface Invoice {
  id: number;
  reference: string;
  date: string;
  client: { id: number; name: string; code: string; nif?: string };
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  timbreFiscal: number;
  timbreRatePercent?: number;
  netToPay: number;
  paymentMethod: string;
  status: string;
  lines?: InvoiceLine[];
}

export interface InvoiceLine {
  productPfId: number;
  productName?: string;
  productPf?: { code: string; name: string; unit: string };
  quantity: number;
  unitPriceHt: number;
  remise?: number;
  lineHt: number;
}

export interface Client {
  id: number;
  code: string;
  name: string;
  nif?: string;
}

export interface ProductPf {
  id: number;
  code: string;
  name: string;
  priceHt: number;
  unit: string;
}

export interface EditFormLine {
  productPfId: number;
  productName?: string;
  quantity: number;
  unitPriceHt: number;
  lineHt: number;
}

export const paymentMethods = [
  { value: 'ESPECES', label: 'Especes' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'VIREMENT', label: 'Virement' },
];

// Status values must match Prisma InvoiceStatus enum
export const invoiceStatuses = [
  { value: 'DRAFT', label: 'Brouillon', color: 'bg-black/5 text-[#86868B]' },
  { value: 'VALIDATED', label: 'Validee', color: 'bg-[#007AFF]/10 text-[#007AFF]' },
  { value: 'PARTIALLY_PAID', label: 'Partiellement payee', color: 'bg-[#FF9500]/10 text-[#C93400]' },
  { value: 'PAID', label: 'Payee', color: 'bg-[#34C759]/10 text-[#248A3D]' },
  { value: 'CANCELLED', label: 'Annulee', color: 'bg-[#FF3B30]/10 text-[#D70015]' },
];

export function getStatusStyle(status: string): string {
  return invoiceStatuses.find(s => s.value === status)?.color || 'bg-black/5 text-[#86868B]';
}

export function getStatusLabel(status: string): string {
  return invoiceStatuses.find(s => s.value === status)?.label || status;
}

export type StatusFilter = 'ALL' | 'DRAFT' | 'VALIDATED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
