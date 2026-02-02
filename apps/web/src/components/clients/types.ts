// ═══════════════════════════════════════════════════════════════════════════════
// Client Types — shared across client sub-components
// ═══════════════════════════════════════════════════════════════════════════════

export interface Client {
  id: number;
  code: string;
  name: string;
  type: 'DISTRIBUTEUR' | 'GROSSISTE' | 'SUPERETTE' | 'FAST_FOOD';
  nif: string;
  rc: string;
  ai: string;
  nis: string | null;
  phone: string | null;
  address: string | null;
  _count?: { invoices: number };
}

export interface FieldErrors {
  code?: string;
  name?: string;
  nif?: string;
  rc?: string;
  ai?: string;
  nis?: string;
  phone?: string;
}

export interface ClientFormData {
  code: string;
  name: string;
  type: Client['type'];
  nif: string;
  rc: string;
  ai: string;
  nis: string;
  phone: string;
  address: string;
}

// Validation patterns - Conformite DGI Algerie
export const VALIDATION = {
  NIF: /^\d{15}$/,
  RC: /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{8,15}$/,
  AI: /^\d{6,10}$/,
  NIS: /^\d{15}$/,
  PHONE: /^(0|\+213)[5-7]\d{8}$/,
};

export const typeConfig = {
  DISTRIBUTEUR: { label: 'Distributeur', color: 'bg-[#007AFF]/10 text-[#007AFF]' },
  GROSSISTE: { label: 'Grossiste', color: 'bg-[#AF52DE]/10 text-[#AF52DE]' },
  SUPERETTE: { label: 'Superette', color: 'bg-[#34C759]/10 text-[#34C759]' },
  FAST_FOOD: { label: 'Fast Food', color: 'bg-[#FF9500]/10 text-[#FF9500]' },
} as const;

export const clientTypes = ['DISTRIBUTEUR', 'GROSSISTE', 'SUPERETTE', 'FAST_FOOD'] as const;

export const EMPTY_FORM_DATA: ClientFormData = {
  code: '',
  name: '',
  type: 'DISTRIBUTEUR',
  nif: '',
  rc: '',
  ai: '',
  nis: '',
  phone: '',
  address: '',
};
