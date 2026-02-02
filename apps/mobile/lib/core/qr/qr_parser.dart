import 'qr_code.dart';

/// QR code parsing errors
class InvalidQrCodeError implements Exception {
  final String message;
  final String? rawValue;
  
  const InvalidQrCodeError(this.message, [this.rawValue]);
  
  @override
  String toString() => 'InvalidQrCodeError: $message';
}

/// QR code parser and validator
/// 
/// Expected format: MCG:{TYPE}:{SHORT_ID}
/// - MCG: Fixed prefix
/// - TYPE: MP, PF, PROD, CLI
/// - SHORT_ID: 8-12 uppercase alphanumeric chars
class QrParser {
  /// Regex for SHORT_ID validation: 8-12 uppercase alphanumeric
  static final RegExp _shortIdPattern = RegExp(r'^[A-Z0-9]{8,12}$');
  
  /// QR prefix
  static const String _prefix = 'MCG';
  
  /// Parse and validate a raw QR code string
  /// 
  /// Throws [InvalidQrCodeError] if validation fails
  static QrCodePayload parse(String rawValue) {
    final trimmed = rawValue.trim();
    
    // Check empty
    if (trimmed.isEmpty) {
      throw const InvalidQrCodeError('Code QR vide');
    }
    
    // Split by delimiter
    final parts = trimmed.split(':');
    
    // Must have exactly 3 parts
    if (parts.length != 3) {
      throw InvalidQrCodeError(
        'Format invalide: attendu MCG:TYPE:ID (${parts.length} parties trouvées)',
        rawValue,
      );
    }
    
    final prefix = parts[0];
    final typeCode = parts[1];
    final shortId = parts[2];
    
    // Validate prefix
    if (prefix.toUpperCase() != _prefix) {
      throw InvalidQrCodeError(
        'Préfixe invalide: "$prefix" (attendu: MCG)',
        rawValue,
      );
    }
    
    // Validate type
    final entityType = QrEntityType.fromCode(typeCode);
    if (entityType == null) {
      throw InvalidQrCodeError(
        'Type invalide: "$typeCode" (attendu: MP, PF, PROD, CLI)',
        rawValue,
      );
    }
    
    // Validate SHORT_ID
    final normalizedId = shortId.toUpperCase();
    if (!_shortIdPattern.hasMatch(normalizedId)) {
      throw InvalidQrCodeError(
        'ID invalide: "$shortId" (attendu: 8-12 caractères alphanumériques)',
        rawValue,
      );
    }
    
    return QrCodePayload(
      type: entityType,
      shortId: normalizedId,
    );
  }
  
  /// Check if a string is a valid Manchengo QR code (without throwing)
  static bool isValid(String rawValue) {
    try {
      parse(rawValue);
      return true;
    } catch (_) {
      return false;
    }
  }
}
