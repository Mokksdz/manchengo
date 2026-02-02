import 'dart:convert';

/// Sync event actions
abstract class SyncAction {
  static const String mpReceived = 'MP_RECEIVED';
  static const String mpConsumed = 'MP_CONSUMED';
  static const String pfProduced = 'PF_PRODUCED';
  static const String pfSold = 'PF_SOLD';
  static const String invoiceCreated = 'INVOICE_CREATED';
  static const String paymentCreated = 'PAYMENT_CREATED';
}

/// Sync event entity types
abstract class SyncEntityType {
  static const String lotMp = 'LOT_MP';
  static const String lotPf = 'LOT_PF';
  static const String stockMovement = 'STOCK_MOVEMENT';
  static const String invoice = 'INVOICE';
  static const String invoiceLine = 'INVOICE_LINE';
  static const String payment = 'PAYMENT';
  static const String productionOrder = 'PRODUCTION_ORDER';
}

/// Local sync event model
/// 
/// Represents a business mutation that needs to be synced to server.
/// Events are receipts of completed operations, not state builders.
class SyncEvent {
  final String id;
  final String entityType;
  final String entityId;
  final String action;
  final Map<String, dynamic> payload;
  final DateTime occurredAt;
  final String deviceId;
  final int userId;
  final bool synced;
  final DateTime? syncedAt;
  final DateTime createdAt;

  const SyncEvent({
    required this.id,
    required this.entityType,
    required this.entityId,
    required this.action,
    required this.payload,
    required this.occurredAt,
    required this.deviceId,
    required this.userId,
    this.synced = false,
    this.syncedAt,
    required this.createdAt,
  });

  /// Create from database map
  factory SyncEvent.fromMap(Map<String, dynamic> map) {
    return SyncEvent(
      id: map['id'] as String,
      entityType: map['entity_type'] as String,
      entityId: map['entity_id'] as String,
      action: map['action'] as String,
      payload: jsonDecode(map['payload'] as String) as Map<String, dynamic>,
      occurredAt: DateTime.parse(map['occurred_at'] as String),
      deviceId: map['device_id'] as String,
      userId: map['user_id'] as int,
      synced: (map['synced'] as int) == 1,
      syncedAt: map['synced_at'] != null 
          ? DateTime.parse(map['synced_at'] as String) 
          : null,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  /// Convert to database map
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'entity_type': entityType,
      'entity_id': entityId,
      'action': action,
      'payload': jsonEncode(payload),
      'occurred_at': occurredAt.toUtc().toIso8601String(),
      'device_id': deviceId,
      'user_id': userId,
      'synced': synced ? 1 : 0,
      'synced_at': syncedAt?.toUtc().toIso8601String(),
      'created_at': createdAt.toUtc().toIso8601String(),
    };
  }

  /// Create copy with synced status
  SyncEvent markSynced() {
    return SyncEvent(
      id: id,
      entityType: entityType,
      entityId: entityId,
      action: action,
      payload: payload,
      occurredAt: occurredAt,
      deviceId: deviceId,
      userId: userId,
      synced: true,
      syncedAt: DateTime.now().toUtc(),
      createdAt: createdAt,
    );
  }

  @override
  String toString() => 'SyncEvent($action: $entityType#$entityId)';
}
