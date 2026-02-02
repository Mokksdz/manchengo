/// Algerian Fiscal Rules (2025 Regulation)
///
/// This module implements Algerian tax calculations including:
/// - Timbre fiscal (stamp duty) for cash payments
/// - TVA (VAT) rates
///
/// ⚠️ LEGAL REQUIREMENT - DO NOT SIMPLIFY OR MODIFY WITHOUT LEGAL REVIEW
/// These calculations are based on Algerian fiscal law and must be exact.
library;

/// Payment methods for fiscal calculations
enum PaymentMethod {
  /// Cash payment (Espèces) - Subject to timbre fiscal
  especes('ESPECES'),

  /// Check payment (Chèque) - No timbre fiscal
  cheque('CHEQUE'),

  /// Bank transfer (Virement) - No timbre fiscal
  virement('VIREMENT');

  final String value;
  const PaymentMethod(this.value);

  static PaymentMethod? fromString(String s) {
    switch (s.toUpperCase()) {
      case 'ESPECES':
      case 'CASH':
        return PaymentMethod.especes;
      case 'CHEQUE':
      case 'CHECK':
        return PaymentMethod.cheque;
      case 'VIREMENT':
      case 'TRANSFER':
        return PaymentMethod.virement;
      default:
        return null;
    }
  }
}

/// Standard TVA rate (19%)
const double tvaStandard = 0.19;

/// Reduced TVA rate (9%) for eligible products
const double tvaReduced = 0.09;

/// Timbre fiscal threshold - No stamp duty below 300 DA
const int _timbreThresholdDa = 300;

/// Timbre fiscal minimum amount - 5 DA
const int _timbreMinimumDa = 5;

/// Timbre fiscal bracket size - 100 DA tranches
const int _timbreBracketSizeDa = 100;

/// Bracket 1 limit: 30,000 DA (300 tranches)
const int _timbreBracket1Tranches = 300;

/// Bracket 2 limit: 100,000 DA (1000 tranches total, 700 in bracket 2)
const int _timbreBracket2Tranches = 700;

/// Total tranches for brackets 1+2
const int _timbreBracket12Total = 1000;

/// Rate for bracket 1: 1 DA per 100 DA tranche
const double _timbreRateBracket1Da = 1.0;

/// Rate for bracket 2: 1.5 DA per 100 DA tranche
const double _timbreRateBracket2Da = 1.5;

/// Rate for bracket 3: 2 DA per 100 DA tranche
const double _timbreRateBracket3Da = 2.0;

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
/// [totalTtcDa] - Total amount TTC in Dinars (DA), NOT centimes
/// [paymentMethod] - Payment method (only ESPECES triggers timbre)
///
/// Returns timbre fiscal amount in Dinars (DA), NOT centimes
///
/// Examples:
/// ```dart
/// // 500 DA cash → 5 DA timbre (5 tranches × 1 DA)
/// calculateTimbreFiscal(500, PaymentMethod.especes) // => 5
///
/// // 15,000 DA cash → 150 DA timbre (150 tranches × 1 DA)
/// calculateTimbreFiscal(15000, PaymentMethod.especes) // => 150
///
/// // 50,000 DA cash → 600 DA timbre
/// // Bracket 1: 300 × 1 DA = 300 DA
/// // Bracket 2: 200 × 1.5 DA = 300 DA
/// calculateTimbreFiscal(50000, PaymentMethod.especes) // => 600
///
/// // Check payment → 0 DA (no timbre)
/// calculateTimbreFiscal(50000, PaymentMethod.cheque) // => 0
///
/// // Below threshold → 0 DA
/// calculateTimbreFiscal(200, PaymentMethod.especes) // => 0
/// ```
///
/// ⚠️ Legal Notice
///
/// This function implements Algerian fiscal law. DO NOT MODIFY without
/// consulting current legislation. Any changes must be reviewed for
/// legal compliance.
int calculateTimbreFiscal(int totalTtcDa, PaymentMethod paymentMethod) {
  // RULE 1: Timbre fiscal applies ONLY to cash payments
  if (paymentMethod != PaymentMethod.especes) {
    return 0;
  }

  // RULE 2: No timbre if total < 300 DA
  if (totalTtcDa < _timbreThresholdDa) {
    return 0;
  }

  // RULE 3: Calculate number of 100 DA tranches using CEILING
  final tranches = (totalTtcDa / _timbreBracketSizeDa).ceil();

  double timbre = 0;

  // Bracket 1: 300 DA → 30,000 DA (first 300 tranches at 1 DA each)
  final tranche1 = tranches < _timbreBracket1Tranches ? tranches : _timbreBracket1Tranches;
  timbre += tranche1 * _timbreRateBracket1Da;

  // Bracket 2: 30,001 DA → 100,000 DA (next 700 tranches at 1.5 DA each)
  if (tranches > _timbreBracket1Tranches) {
    final remaining = tranches - _timbreBracket1Tranches;
    final tranche2 = remaining < _timbreBracket2Tranches ? remaining : _timbreBracket2Tranches;
    timbre += tranche2 * _timbreRateBracket2Da;
  }

  // Bracket 3: > 100,000 DA (remaining tranches at 2 DA each)
  if (tranches > _timbreBracket12Total) {
    final tranche3 = tranches - _timbreBracket12Total;
    timbre += tranche3 * _timbreRateBracket3Da;
  }

  // RULE 4: Apply minimum (5 DA)
  final timbreRounded = timbre.ceil();
  if (timbreRounded < _timbreMinimumDa) {
    return _timbreMinimumDa;
  }

  return timbreRounded;
}

/// Calculate timbre fiscal with amounts in centimes.
///
/// This is a convenience wrapper that accepts centimes and returns centimes.
///
/// [totalTtcCentimes] - Total amount TTC in centimes (1 DA = 100 centimes)
/// [paymentMethod] - Payment method
///
/// Returns timbre fiscal amount in centimes
int calculateTimbreFiscalCentimes(int totalTtcCentimes, PaymentMethod paymentMethod) {
  final totalDa = totalTtcCentimes ~/ 100;
  final timbreDa = calculateTimbreFiscal(totalDa, paymentMethod);
  return timbreDa * 100;
}

/// Calculate TVA amount
///
/// [amountHt] - Amount before tax (in any unit, returned in same unit)
/// [tvaRate] - TVA rate (0.19 for standard, 0.09 for reduced)
///
/// Returns TVA amount (floored to avoid overcharging)
int calculateTva(int amountHt, double tvaRate) {
  return (amountHt * tvaRate).floor();
}

/// Calculate TTC from HT
///
/// [amountHt] - Amount before tax
/// [tvaRate] - TVA rate
///
/// Returns Total TTC (HT + TVA)
int calculateTtc(int amountHt, double tvaRate) {
  return amountHt + calculateTva(amountHt, tvaRate);
}
