import { z } from 'zod';
import { NIF_REGEX, NIS_REGEX, RC_REGEX, AI_REGEX, PHONE_DZ_REGEX, TVA_RATES } from './validation';

// ═══════════════════════════════════════════════════════════════════════════
// ZOD SCHEMAS — Validation côté frontend (conformité DGI algérienne)
// ═══════════════════════════════════════════════════════════════════════════

// ── Champs fiscaux réutilisables ─────────────────────────────────────────

export const nifSchema = z.string().regex(NIF_REGEX, 'NIF invalide (15 chiffres requis)');
export const nisSchema = z.string().regex(NIS_REGEX, 'NIS invalide (15 chiffres requis)').optional().or(z.literal(''));
export const rcSchema = z.string().regex(RC_REGEX, 'RC invalide (alphanumérique, min 1 lettre)');
export const aiSchema = z.string().regex(AI_REGEX, 'AI invalide (alphanumérique 3-20 caractères)');
export const phoneDzSchema = z.string().regex(PHONE_DZ_REGEX, 'Téléphone invalide (format: 05/06/07 + 8 chiffres)').optional().or(z.literal(''));
export const tvaRateSchema = z.number().refine((v) => (TVA_RATES as readonly number[]).includes(v), 'Taux TVA invalide');

// ── Client ───────────────────────────────────────────────────────────────

export const clientSchema = z.object({
  code: z.string().min(1, 'Le code client est obligatoire'),
  name: z.string().min(1, 'Le nom du client est obligatoire'),
  type: z.enum(['DISTRIBUTEUR', 'GROSSISTE', 'SUPERETTE', 'FAST_FOOD', 'AUTRE'], {
    error: 'Type de client invalide',
  }),
  nif: nifSchema,
  rc: rcSchema,
  ai: aiSchema,
  nis: nisSchema,
  phone: phoneDzSchema,
  address: z.string().optional(),
});

export type ClientFormData = z.infer<typeof clientSchema>;

// ── Fournisseur ──────────────────────────────────────────────────────────

export const supplierSchema = z.object({
  name: z.string().min(1, 'Le nom du fournisseur est obligatoire'),
  rc: rcSchema,
  nif: nifSchema,
  ai: aiSchema,
  nis: nisSchema,
  phone: z.string().regex(PHONE_DZ_REGEX, 'Téléphone invalide (format: 05/06/07 + 8 chiffres)'),
  address: z.string().min(1, 'L\'adresse est obligatoire'),
});

export type SupplierFormData = z.infer<typeof supplierSchema>;

// ── Utilisateur ──────────────────────────────────────────────────────────

export const userSchema = z.object({
  email: z.string().email('Email invalide'),
  firstName: z.string().min(1, 'Le prénom est obligatoire'),
  lastName: z.string().min(1, 'Le nom est obligatoire'),
  role: z.enum(['ADMIN', 'APPRO', 'PRODUCTION', 'COMMERCIAL'], {
    error: 'Rôle invalide',
  }),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').optional(),
});

export type UserFormData = z.infer<typeof userSchema>;

// ── Demande d'achat ──────────────────────────────────────────────────────

export const demandItemSchema = z.object({
  productMpId: z.number().positive('Produit requis'),
  quantity: z.number().positive('La quantité doit être positive'),
  note: z.string().optional(),
});

export const demandSchema = z.object({
  items: z.array(demandItemSchema).min(1, 'Au moins un produit requis'),
  priority: z.enum(['NORMALE', 'ELEVEE', 'CRITIQUE']).default('NORMALE'),
  justification: z.string().min(1, 'La justification est obligatoire'),
});

export type DemandFormData = z.infer<typeof demandSchema>;

// ── Inventaire ───────────────────────────────────────────────────────────

export const inventorySchema = z.object({
  productType: z.enum(['MP', 'PF']),
  productId: z.number().positive(),
  declaredQty: z.number().min(0, 'La quantité déclarée doit être >= 0'),
  note: z.string().optional(),
});

export type InventoryFormData = z.infer<typeof inventorySchema>;

// ── Login ────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
