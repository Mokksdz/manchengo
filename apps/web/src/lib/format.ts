/**
 * Shared formatting utilities for Manchengo Smart ERP
 * Extracted from multiple page components to eliminate duplication.
 */

/**
 * Format centimes to DZD currency string
 * @param centimes - Amount in centimes (1 DA = 100 centimes)
 */
export function formatPrice(centimes: number): string {
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 2,
  }).format(centimes / 100);
}

/**
 * Format ISO date string to French locale
 * @param dateStr - ISO 8601 date string
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format ISO date with time
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format weight in grams to human-readable string
 */
export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toLocaleString('fr-FR')} kg`;
  }
  return `${grams} g`;
}
