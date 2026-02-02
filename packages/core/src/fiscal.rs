//! Algerian Fiscal Rules (2025 Regulation)
//!
//! This module implements Algerian tax calculations including:
//! - Timbre fiscal (stamp duty) for cash payments
//! - TVA (VAT) rates
//!
//! ⚠️ LEGAL REQUIREMENT - DO NOT SIMPLIFY OR MODIFY WITHOUT LEGAL REVIEW
//! These calculations are based on Algerian fiscal law and must be exact.

/// Payment methods for fiscal calculations
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentMethod {
    /// Cash payment (Espèces) - Subject to timbre fiscal
    Especes,
    /// Check payment (Chèque) - No timbre fiscal
    Cheque,
    /// Bank transfer (Virement) - No timbre fiscal
    Virement,
}

impl PaymentMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            PaymentMethod::Especes => "ESPECES",
            PaymentMethod::Cheque => "CHEQUE",
            PaymentMethod::Virement => "VIREMENT",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "ESPECES" | "CASH" => Some(PaymentMethod::Especes),
            "CHEQUE" | "CHECK" => Some(PaymentMethod::Cheque),
            "VIREMENT" | "TRANSFER" => Some(PaymentMethod::Virement),
            _ => None,
        }
    }
}

/// Standard TVA rate (19%)
pub const TVA_STANDARD: f64 = 0.19;

/// Reduced TVA rate (9%) for eligible products
pub const TVA_REDUCED: f64 = 0.09;

/// Timbre fiscal threshold - No stamp duty below 300 DA
const TIMBRE_THRESHOLD_DA: i64 = 300;

/// Timbre fiscal minimum amount - 5 DA
const TIMBRE_MINIMUM_DA: i64 = 5;

/// Timbre fiscal bracket size - 100 DA tranches
const TIMBRE_BRACKET_SIZE_DA: i64 = 100;

/// Bracket 1 limit: 30,000 DA (300 tranches)
const TIMBRE_BRACKET_1_TRANCHES: i64 = 300;

/// Bracket 2 limit: 100,000 DA (1000 tranches total, 700 in bracket 2)
const TIMBRE_BRACKET_2_TRANCHES: i64 = 700;

/// Total tranches for brackets 1+2
const TIMBRE_BRACKET_12_TOTAL: i64 = 1000;

/// Rate for bracket 1: 1 DA per 100 DA tranche
const TIMBRE_RATE_BRACKET_1_DA: f64 = 1.0;

/// Rate for bracket 2: 1.5 DA per 100 DA tranche
const TIMBRE_RATE_BRACKET_2_DA: f64 = 1.5;

/// Rate for bracket 3: 2 DA per 100 DA tranche
const TIMBRE_RATE_BRACKET_3_DA: f64 = 2.0;

/// Calculate Algerian timbre fiscal (stamp duty) for cash payments.
///
/// # Algerian Fiscal Law 2025
///
/// Timbre fiscal applies ONLY to cash payments (ESPECES) and is calculated
/// on the total TTC amount using progressive brackets:
///
/// | Amount (TTC)           | Rate per 100 DA | Effective Rate |
/// |------------------------|-----------------|----------------|
/// | 300 DA → 30,000 DA     | 1.00 DA         | 1.0%           |
/// | 30,001 DA → 100,000 DA | 1.50 DA         | 1.5%           |
/// | > 100,000 DA           | 2.00 DA         | 2.0%           |
///
/// # Arguments
///
/// * `total_ttc_da` - Total amount TTC in Dinars (DA), NOT centimes
/// * `payment_method` - Payment method (only ESPECES triggers timbre)
///
/// # Returns
///
/// Timbre fiscal amount in Dinars (DA), NOT centimes
///
/// # Examples
///
/// ```
/// use manchengo_core::fiscal::{calculate_timbre_fiscal, PaymentMethod};
///
/// // 500 DA cash → 5 DA timbre (5 tranches × 1 DA)
/// assert_eq!(calculate_timbre_fiscal(500, PaymentMethod::Especes), 5);
///
/// // 15,000 DA cash → 150 DA timbre (150 tranches × 1 DA)
/// assert_eq!(calculate_timbre_fiscal(15_000, PaymentMethod::Especes), 150);
///
/// // 50,000 DA cash → 600 DA timbre
/// // Bracket 1: 300 × 1 DA = 300 DA
/// // Bracket 2: 200 × 1.5 DA = 300 DA
/// assert_eq!(calculate_timbre_fiscal(50_000, PaymentMethod::Especes), 600);
///
/// // Check payment → 0 DA (no timbre)
/// assert_eq!(calculate_timbre_fiscal(50_000, PaymentMethod::Cheque), 0);
///
/// // Below threshold → 0 DA
/// assert_eq!(calculate_timbre_fiscal(200, PaymentMethod::Especes), 0);
/// ```
///
/// # ⚠️ Legal Notice
///
/// This function implements Algerian fiscal law. DO NOT MODIFY without
/// consulting current legislation. Any changes must be reviewed for
/// legal compliance.
pub fn calculate_timbre_fiscal(total_ttc_da: i64, payment_method: PaymentMethod) -> i64 {
    // RULE 1: Timbre fiscal applies ONLY to cash payments
    if payment_method != PaymentMethod::Especes {
        return 0;
    }

    // RULE 2: No timbre if total < 300 DA
    if total_ttc_da < TIMBRE_THRESHOLD_DA {
        return 0;
    }

    // RULE 3: Calculate number of 100 DA tranches using CEILING
    // For integer division with ceiling: (a + b - 1) / b
    let tranches = (total_ttc_da + TIMBRE_BRACKET_SIZE_DA - 1) / TIMBRE_BRACKET_SIZE_DA;

    let mut timbre: f64 = 0.0;

    // Bracket 1: 300 DA → 30,000 DA (first 300 tranches at 1 DA each)
    let tranche1 = tranches.min(TIMBRE_BRACKET_1_TRANCHES);
    timbre += tranche1 as f64 * TIMBRE_RATE_BRACKET_1_DA;

    // Bracket 2: 30,001 DA → 100,000 DA (next 700 tranches at 1.5 DA each)
    if tranches > TIMBRE_BRACKET_1_TRANCHES {
        let tranche2 = (tranches - TIMBRE_BRACKET_1_TRANCHES).min(TIMBRE_BRACKET_2_TRANCHES);
        timbre += tranche2 as f64 * TIMBRE_RATE_BRACKET_2_DA;
    }

    // Bracket 3: > 100,000 DA (remaining tranches at 2 DA each)
    if tranches > TIMBRE_BRACKET_12_TOTAL {
        let tranche3 = tranches - TIMBRE_BRACKET_12_TOTAL;
        timbre += tranche3 as f64 * TIMBRE_RATE_BRACKET_3_DA;
    }

    // RULE 4: Apply minimum (5 DA)
    let timbre_rounded = timbre.ceil() as i64;
    if timbre_rounded < TIMBRE_MINIMUM_DA {
        return TIMBRE_MINIMUM_DA;
    }

    timbre_rounded
}

/// Calculate timbre fiscal with amounts in centimes.
///
/// This is a convenience wrapper that accepts centimes and returns centimes.
///
/// # Arguments
///
/// * `total_ttc_centimes` - Total amount TTC in centimes (1 DA = 100 centimes)
/// * `payment_method` - Payment method
///
/// # Returns
///
/// Timbre fiscal amount in centimes
pub fn calculate_timbre_fiscal_centimes(
    total_ttc_centimes: i64,
    payment_method: PaymentMethod,
) -> i64 {
    let total_da = total_ttc_centimes / 100;
    let timbre_da = calculate_timbre_fiscal(total_da, payment_method);
    timbre_da * 100
}

/// Calculate TVA amount
///
/// # Arguments
///
/// * `amount_ht` - Amount before tax (in any unit, returned in same unit)
/// * `tva_rate` - TVA rate (0.19 for standard, 0.09 for reduced)
///
/// # Returns
///
/// TVA amount (floored to avoid overcharging)
pub fn calculate_tva(amount_ht: i64, tva_rate: f64) -> i64 {
    (amount_ht as f64 * tva_rate).floor() as i64
}

/// Calculate TTC from HT
///
/// # Arguments
///
/// * `amount_ht` - Amount before tax
/// * `tva_rate` - TVA rate
///
/// # Returns
///
/// Total TTC (HT + TVA)
pub fn calculate_ttc(amount_ht: i64, tva_rate: f64) -> i64 {
    amount_ht + calculate_tva(amount_ht, tva_rate)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timbre_non_cash_returns_zero() {
        assert_eq!(calculate_timbre_fiscal(50_000, PaymentMethod::Cheque), 0);
        assert_eq!(calculate_timbre_fiscal(50_000, PaymentMethod::Virement), 0);
    }

    #[test]
    fn test_timbre_below_threshold_returns_zero() {
        assert_eq!(calculate_timbre_fiscal(0, PaymentMethod::Especes), 0);
        assert_eq!(calculate_timbre_fiscal(100, PaymentMethod::Especes), 0);
        assert_eq!(calculate_timbre_fiscal(200, PaymentMethod::Especes), 0);
        assert_eq!(calculate_timbre_fiscal(299, PaymentMethod::Especes), 0);
    }

    #[test]
    fn test_timbre_at_threshold() {
        // 300 DA = 3 tranches × 1 DA = 3 DA, but minimum is 5 DA
        assert_eq!(calculate_timbre_fiscal(300, PaymentMethod::Especes), 5);
    }

    #[test]
    fn test_timbre_bracket_1() {
        // 500 DA = 5 tranches × 1 DA = 5 DA
        assert_eq!(calculate_timbre_fiscal(500, PaymentMethod::Especes), 5);

        // 1,000 DA = 10 tranches × 1 DA = 10 DA
        assert_eq!(calculate_timbre_fiscal(1_000, PaymentMethod::Especes), 10);

        // 15,000 DA = 150 tranches × 1 DA = 150 DA
        assert_eq!(calculate_timbre_fiscal(15_000, PaymentMethod::Especes), 150);

        // 30,000 DA = 300 tranches × 1 DA = 300 DA
        assert_eq!(calculate_timbre_fiscal(30_000, PaymentMethod::Especes), 300);
    }

    #[test]
    fn test_timbre_bracket_2() {
        // 50,000 DA:
        // Bracket 1: 300 tranches × 1 DA = 300 DA
        // Bracket 2: 200 tranches × 1.5 DA = 300 DA
        // Total = 600 DA
        assert_eq!(calculate_timbre_fiscal(50_000, PaymentMethod::Especes), 600);

        // 100,000 DA:
        // Bracket 1: 300 tranches × 1 DA = 300 DA
        // Bracket 2: 700 tranches × 1.5 DA = 1,050 DA
        // Total = 1,350 DA
        assert_eq!(calculate_timbre_fiscal(100_000, PaymentMethod::Especes), 1_350);
    }

    #[test]
    fn test_timbre_bracket_3() {
        // 150,000 DA:
        // Bracket 1: 300 tranches × 1 DA = 300 DA
        // Bracket 2: 700 tranches × 1.5 DA = 1,050 DA
        // Bracket 3: 500 tranches × 2 DA = 1,000 DA
        // Total = 2,350 DA
        assert_eq!(calculate_timbre_fiscal(150_000, PaymentMethod::Especes), 2_350);

        // 200,000 DA:
        // Bracket 1: 300 × 1 = 300 DA
        // Bracket 2: 700 × 1.5 = 1,050 DA
        // Bracket 3: 1000 × 2 = 2,000 DA
        // Total = 3,350 DA
        assert_eq!(calculate_timbre_fiscal(200_000, PaymentMethod::Especes), 3_350);
    }

    #[test]
    fn test_timbre_centimes_wrapper() {
        // 15,000 DA = 1,500,000 centimes → 150 DA = 15,000 centimes
        assert_eq!(
            calculate_timbre_fiscal_centimes(1_500_000, PaymentMethod::Especes),
            15_000
        );

        // 50,000 DA = 5,000,000 centimes → 600 DA = 60,000 centimes
        assert_eq!(
            calculate_timbre_fiscal_centimes(5_000_000, PaymentMethod::Especes),
            60_000
        );
    }

    #[test]
    fn test_tva_calculation() {
        // 10,000 centimes × 19% = 1,900 centimes
        assert_eq!(calculate_tva(10_000, TVA_STANDARD), 1_900);

        // 10,000 centimes × 9% = 900 centimes
        assert_eq!(calculate_tva(10_000, TVA_REDUCED), 900);
    }

    #[test]
    fn test_ttc_calculation() {
        // 10,000 + 1,900 = 11,900
        assert_eq!(calculate_ttc(10_000, TVA_STANDARD), 11_900);
    }

    #[test]
    fn test_payment_method_from_str() {
        assert_eq!(PaymentMethod::from_str("ESPECES"), Some(PaymentMethod::Especes));
        assert_eq!(PaymentMethod::from_str("especes"), Some(PaymentMethod::Especes));
        assert_eq!(PaymentMethod::from_str("CASH"), Some(PaymentMethod::Especes));
        assert_eq!(PaymentMethod::from_str("CHEQUE"), Some(PaymentMethod::Cheque));
        assert_eq!(PaymentMethod::from_str("VIREMENT"), Some(PaymentMethod::Virement));
        assert_eq!(PaymentMethod::from_str("INVALID"), None);
    }
}
