/// QR Code domain model for Manchengo Smart ERP
/// 
/// Format: MCG:{TYPE}:{SHORT_ID}

/// Entity types that can be encoded in QR codes
enum QrEntityType {
  mp('MP', 'Lot Matière Première'),
  pf('PF', 'Lot Produit Fini'),
  prod('PROD', 'Ordre de Production'),
  client('CLI', 'Client');

  final String code;
  final String label;
  
  const QrEntityType(this.code, this.label);
  
  /// Parse from QR type string
  static QrEntityType? fromCode(String code) {
    for (final type in values) {
      if (type.code == code.toUpperCase()) {
        return type;
      }
    }
    return null;
  }
}

/// Parsed QR code payload
class QrCodePayload {
  final QrEntityType type;
  final String shortId;
  
  const QrCodePayload({
    required this.type,
    required this.shortId,
  });
  
  /// Reconstruct raw QR value
  String toRawValue() => 'MCG:${type.code}:$shortId';
  
  @override
  String toString() => 'QrCodePayload(type: ${type.label}, id: $shortId)';
  
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is QrCodePayload &&
          runtimeType == other.runtimeType &&
          type == other.type &&
          shortId == other.shortId;

  @override
  int get hashCode => type.hashCode ^ shortId.hashCode;
}
