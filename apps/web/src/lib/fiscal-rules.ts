/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RÈGLES FISCALES ALGÉRIENNES — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Source unique de vérité pour les calculs fiscaux (timbre, TVA, etc.)
 * Les montants sont en CENTIMES (1 DA = 100 centimes).
 *
 * Timbre fiscal (paiement ESPÈCES uniquement) :
 *   - TTC ≤  30 000 DA ( 3 000 000 cts) → 1%
 *   - TTC ≤ 100 000 DA (10 000 000 cts) → 1.5%
 *   - TTC >  100 000 DA                 → 2%
 *
 * TVA : 19% (taux normal)
 */

// ── Seuils en centimes ──────────────────────────────────────────────────────
const TIMBRE_SEUIL_BAS = 3_000_000;   // 30 000 DA
const TIMBRE_SEUIL_HAUT = 10_000_000; // 100 000 DA

export const TVA_RATE = 0.19;

/**
 * Retourne le taux de timbre fiscal en RATIO (0.01, 0.015, 0.02)
 * Aligné avec le backend `calculateTimbreRate()`
 */
export function calculateTimbreRate(totalTtc: number): number {
  if (totalTtc <= TIMBRE_SEUIL_BAS) return 0.01;
  if (totalTtc <= TIMBRE_SEUIL_HAUT) return 0.015;
  return 0.02;
}

/**
 * Retourne le taux de timbre en POURCENTAGE pour l'affichage (1, 1.5, 2)
 */
export function calculateTimbreRatePercent(totalTtc: number): number {
  return calculateTimbreRate(totalTtc) * 100;
}

/**
 * Calcule le montant du timbre fiscal en centimes
 */
export function calculateTimbreAmount(totalTtc: number, paymentMethod: string, applyTimbre: boolean): number {
  if (!applyTimbre || paymentMethod !== 'ESPECES') return 0;
  return Math.round(totalTtc * calculateTimbreRate(totalTtc));
}
