import 'package:flutter_test/flutter_test.dart';
import 'package:manchengo_mobile/core/fiscal/fiscal.dart';

/// Tests for Algerian fiscal calculations (2025 Regulation)
///
/// ⚠️ These tests verify legal compliance - DO NOT MODIFY without legal review
void main() {
  group('Timbre Fiscal - Payment Method', () {
    test('non-cash payments return zero', () {
      expect(calculateTimbreFiscal(50000, PaymentMethod.cheque), 0);
      expect(calculateTimbreFiscal(50000, PaymentMethod.virement), 0);
    });
  });

  group('Timbre Fiscal - Threshold', () {
    test('below 300 DA returns zero', () {
      expect(calculateTimbreFiscal(0, PaymentMethod.especes), 0);
      expect(calculateTimbreFiscal(100, PaymentMethod.especes), 0);
      expect(calculateTimbreFiscal(200, PaymentMethod.especes), 0);
      expect(calculateTimbreFiscal(299, PaymentMethod.especes), 0);
    });

    test('at threshold applies minimum', () {
      // 300 DA = 3 tranches × 1 DA = 3 DA, but minimum is 5 DA
      expect(calculateTimbreFiscal(300, PaymentMethod.especes), 5);
    });
  });

  group('Timbre Fiscal - Bracket 1 (300 DA → 30,000 DA)', () {
    test('500 DA = 5 tranches × 1 DA = 5 DA', () {
      expect(calculateTimbreFiscal(500, PaymentMethod.especes), 5);
    });

    test('1,000 DA = 10 tranches × 1 DA = 10 DA', () {
      expect(calculateTimbreFiscal(1000, PaymentMethod.especes), 10);
    });

    test('15,000 DA = 150 tranches × 1 DA = 150 DA', () {
      expect(calculateTimbreFiscal(15000, PaymentMethod.especes), 150);
    });

    test('30,000 DA = 300 tranches × 1 DA = 300 DA', () {
      expect(calculateTimbreFiscal(30000, PaymentMethod.especes), 300);
    });
  });

  group('Timbre Fiscal - Bracket 2 (30,001 DA → 100,000 DA)', () {
    test('50,000 DA = 300×1 + 200×1.5 = 600 DA', () {
      // Bracket 1: 300 tranches × 1 DA = 300 DA
      // Bracket 2: 200 tranches × 1.5 DA = 300 DA
      // Total = 600 DA
      expect(calculateTimbreFiscal(50000, PaymentMethod.especes), 600);
    });

    test('100,000 DA = 300×1 + 700×1.5 = 1,350 DA', () {
      // Bracket 1: 300 tranches × 1 DA = 300 DA
      // Bracket 2: 700 tranches × 1.5 DA = 1,050 DA
      // Total = 1,350 DA
      expect(calculateTimbreFiscal(100000, PaymentMethod.especes), 1350);
    });
  });

  group('Timbre Fiscal - Bracket 3 (> 100,000 DA)', () {
    test('150,000 DA = 300×1 + 700×1.5 + 500×2 = 2,350 DA', () {
      // Bracket 1: 300 tranches × 1 DA = 300 DA
      // Bracket 2: 700 tranches × 1.5 DA = 1,050 DA
      // Bracket 3: 500 tranches × 2 DA = 1,000 DA
      // Total = 2,350 DA
      expect(calculateTimbreFiscal(150000, PaymentMethod.especes), 2350);
    });

    test('200,000 DA = 300×1 + 700×1.5 + 1000×2 = 3,350 DA', () {
      // Bracket 1: 300 × 1 = 300 DA
      // Bracket 2: 700 × 1.5 = 1,050 DA
      // Bracket 3: 1000 × 2 = 2,000 DA
      // Total = 3,350 DA
      expect(calculateTimbreFiscal(200000, PaymentMethod.especes), 3350);
    });
  });

  group('Timbre Fiscal - Centimes Wrapper', () {
    test('15,000 DA = 1,500,000 centimes → 150 DA = 15,000 centimes', () {
      expect(
        calculateTimbreFiscalCentimes(1500000, PaymentMethod.especes),
        15000,
      );
    });

    test('50,000 DA = 5,000,000 centimes → 600 DA = 60,000 centimes', () {
      expect(
        calculateTimbreFiscalCentimes(5000000, PaymentMethod.especes),
        60000,
      );
    });
  });

  group('TVA Calculation', () {
    test('standard TVA 19%', () {
      // 10,000 centimes × 19% = 1,900 centimes
      expect(calculateTva(10000, tvaStandard), 1900);
    });

    test('reduced TVA 9%', () {
      // 10,000 centimes × 9% = 900 centimes
      expect(calculateTva(10000, tvaReduced), 900);
    });
  });

  group('TTC Calculation', () {
    test('HT + TVA = TTC', () {
      // 10,000 + 1,900 = 11,900
      expect(calculateTtc(10000, tvaStandard), 11900);
    });
  });

  group('PaymentMethod', () {
    test('fromString parses correctly', () {
      expect(PaymentMethod.fromString('ESPECES'), PaymentMethod.especes);
      expect(PaymentMethod.fromString('especes'), PaymentMethod.especes);
      expect(PaymentMethod.fromString('CASH'), PaymentMethod.especes);
      expect(PaymentMethod.fromString('CHEQUE'), PaymentMethod.cheque);
      expect(PaymentMethod.fromString('VIREMENT'), PaymentMethod.virement);
      expect(PaymentMethod.fromString('INVALID'), null);
    });
  });
}
