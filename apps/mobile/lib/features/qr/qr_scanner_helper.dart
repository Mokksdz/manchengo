import 'package:flutter/material.dart';
import '../../core/qr/qr.dart';
import 'qr_scanner_screen.dart';

/// Reusable helper to scan QR codes
/// 
/// Opens fullscreen scanner and returns parsed payload.
/// Returns null if user cancels or closes scanner.
/// 
/// Usage:
/// ```dart
/// final payload = await scanQr(context);
/// if (payload != null) {
///   // Handle scanned QR
/// }
/// ```
Future<QrCodePayload?> scanQr(
  BuildContext context, {
  String? title,
  String? hint,
}) async {
  return Navigator.of(context).push<QrCodePayload>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (context) => QrScannerScreen(
        title: title,
        hint: hint,
      ),
    ),
  );
}

/// Scan QR with specific entity type filter
/// 
/// Only returns payload if it matches expected type.
/// Shows error if wrong type is scanned.
Future<QrCodePayload?> scanQrForType(
  BuildContext context,
  QrEntityType expectedType, {
  String? title,
}) async {
  final payload = await scanQr(
    context,
    title: title ?? 'Scanner ${expectedType.label}',
    hint: 'Scannez un code QR ${expectedType.label}',
  );
  
  if (payload == null) return null;
  
  if (payload.type != expectedType) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Type incorrect: attendu ${expectedType.label}, reçu ${payload.type.label}',
          ),
          backgroundColor: Colors.red,
        ),
      );
    }
    return null;
  }
  
  return payload;
}
