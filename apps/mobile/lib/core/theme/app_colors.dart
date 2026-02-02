import 'package:flutter/material.dart';

/// Manchengo Smart ERP Color System
/// Based on FIGMA_DESIGN_SPEC.md
abstract class AppColors {
  // Brand Colors
  static const Color brandGold = Color(0xFFD4A84B);
  static const Color brandGoldHover = Color(0xFFC49A3D);
  static const Color brandGoldLight = Color(0xFFF5ECD9);
  static const Color brandBlue = Color(0xFF1E3A5F);
  static const Color brandBlueLight = Color(0xFF2D4A6F);

  // Neutral Colors
  static const Color white = Color(0xFFFFFFFF);
  static const Color neutral50 = Color(0xFFF9FAFB);
  static const Color neutral100 = Color(0xFFF3F4F6);
  static const Color neutral200 = Color(0xFFE5E7EB);
  static const Color neutral300 = Color(0xFFD1D5DB);
  static const Color neutral400 = Color(0xFF9CA3AF);
  static const Color neutral500 = Color(0xFF6B7280);
  static const Color neutral600 = Color(0xFF4B5563);
  static const Color neutral700 = Color(0xFF374151);
  static const Color neutral800 = Color(0xFF1F2937);
  static const Color neutral900 = Color(0xFF111827);

  // Status Colors
  static const Color success = Color(0xFF22C55E);
  static const Color successLight = Color(0xFFDCFCE7);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFEF4444);
  static const Color errorLight = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF3B82F6);
  static const Color infoLight = Color(0xFFDBEAFE);
  static const Color offline = Color(0xFFF97316);
  static const Color offlineLight = Color(0xFFFFEDD5);

  // Domain Colors
  static const Color domainMp = Color(0xFF8B5CF6);
  static const Color domainPf = Color(0xFF06B6D4);
  static const Color domainInvoice = Color(0xFF10B981);
  static const Color domainProduction = Color(0xFFF59E0B);
}
