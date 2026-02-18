/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INTERNATIONALIZATION — Language Context & Utilities
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { t as fr } from './fr';
import { t as ar } from './ar';

export type Language = 'fr' | 'ar';
export type Translations = typeof fr;

// All translations - ar uses same structure as fr
export const translations: Record<Language, Translations> = {
  fr,
  ar: ar as unknown as Translations,
};

// Language metadata
export const languages: Record<Language, { name: string; nativeName: string; dir: 'ltr' | 'rtl' }> = {
  fr: { name: 'French', nativeName: 'Francais', dir: 'ltr' },
  ar: { name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
};

// Default language
export const defaultLanguage: Language = 'fr';

// Get translations for a language
export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations[defaultLanguage];
}

// Format currency
export function formatCurrency(amount: number, lang: Language = 'fr'): string {
  const formatter = new Intl.NumberFormat(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(amount / 100); // Amount is in centimes
}

// Format date
export function formatDate(date: Date | string, lang: Language = 'fr'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

// Format number
export function formatNumber(num: number, lang: Language = 'fr'): string {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-DZ' : 'fr-DZ').format(num);
}

// Re-export default language
export { t } from './fr';
