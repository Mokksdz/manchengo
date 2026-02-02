/**
 * Shared validation patterns for Manchengo Smart ERP
 * Algerian DGI (Direction Générale des Impôts) compliance
 */

/** NIF: 15 digits exactly */
export const NIF_REGEX = /^\d{15}$/;

/** NIS: 15 digits exactly (optional field) */
export const NIS_REGEX = /^\d{15}$/;

/** RC: Alphanumeric, at least 1 letter */
export const RC_REGEX = /^(?=.*[a-zA-Z])[a-zA-Z0-9]+$/;

/** AI: Alphanumeric 3-20 characters */
export const AI_REGEX = /^[a-zA-Z0-9]{3,20}$/;

/** Algerian phone: starts with 05, 06, or 07 + 8 digits */
export const PHONE_DZ_REGEX = /^(05|06|07)\d{8}$/;

/** Algerian TVA rates */
export const TVA_RATES = [0, 9, 19] as const;

/** Default TVA rate */
export const DEFAULT_TVA_RATE = 19;

/** Validate NIF format */
export function validateNif(nif: string): string | undefined {
  if (!nif || !NIF_REGEX.test(nif)) {
    return 'NIF invalide (15 chiffres requis)';
  }
}

/** Validate RC format */
export function validateRc(rc: string): string | undefined {
  if (!rc || !RC_REGEX.test(rc)) {
    return 'RC invalide (alphanumérique, min 1 lettre)';
  }
}

/** Validate AI format */
export function validateAi(ai: string): string | undefined {
  if (!ai || !AI_REGEX.test(ai)) {
    return 'AI invalide (alphanumérique 3-20 caractères)';
  }
}

/** Validate NIS format (optional) */
export function validateNis(nis: string): string | undefined {
  if (nis && !NIS_REGEX.test(nis)) {
    return 'NIS invalide (15 chiffres requis)';
  }
}

/** Validate Algerian phone number */
export function validatePhoneDz(phone: string): string | undefined {
  if (phone && !PHONE_DZ_REGEX.test(phone)) {
    return 'Téléphone invalide (format: 05/06/07 + 8 chiffres)';
  }
}
