import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:uuid/uuid.dart';
import 'database.dart';

/// Sync event status
enum SyncEventStatus {
  pending,
  sending,
  acked,
  failed,
}

/// Sync entity types
enum SyncEntityType {
  delivery,
  invoice,
  payment,
  client,
}

/// Sync actions
enum SyncAction {
  deliveryValidated,
  deliveryCancelled,
  invoiceCreated,
  invoiceUpdated,
  paymentRecorded,
  clientUpdated,
}

/// Represents a sync event in the queue
class SyncEvent {
  final String id;
  final SyncEntityType entityType;
  final String entityId;
  final SyncAction action;
  final Map<String, dynamic> payload;
  final DateTime occurredAt;
  final String userId;
  final String deviceId;
  final String checksum;
  SyncEventStatus status;
  int retryCount;
  String? lastError;
  String? batchId;
  DateTime? sentAt;
  DateTime? ackedAt;

  SyncEvent({
    required this.id,
    required this.entityType,
    required this.entityId,
    required this.action,
    required this.payload,
    required this.occurredAt,
    required this.userId,
    required this.deviceId,
    required this.checksum,
    this.status = SyncEventStatus.pending,
    this.retryCount = 0,
    this.lastError,
    this.batchId,
    this.sentAt,
    this.ackedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'entity_type': entityType.name.toUpperCase(),
      'entity_id': entityId,
      'action': _actionToString(action),
      'payload': jsonEncode(payload),
      'occurred_at': occurredAt.toUtc().toIso8601String(),
      'user_id': userId,
      'device_id': deviceId,
      'checksum': checksum,
      'status': status.name.toUpperCase(),
      'retry_count': retryCount,
      'last_error': lastError,
      'batch_id': batchId,
      'sent_at': sentAt?.toUtc().toIso8601String(),
      'acked_at': ackedAt?.toUtc().toIso8601String(),
    };
  }

  factory SyncEvent.fromMap(Map<String, dynamic> map) {
    return SyncEvent(
      id: map['id'] as String,
      entityType: _parseEntityType(map['entity_type'] as String),
      entityId: map['entity_id'] as String,
      action: _parseAction(map['action'] as String),
      payload: jsonDecode(map['payload'] as String) as Map<String, dynamic>,
      occurredAt: DateTime.parse(map['occurred_at'] as String),
      userId: map['user_id'] as String,
      deviceId: map['device_id'] as String,
      checksum: map['checksum'] as String,
      status: _parseStatus(map['status'] as String),
      retryCount: map['retry_count'] as int? ?? 0,
      lastError: map['last_error'] as String?,
      batchId: map['batch_id'] as String?,
      sentAt: map['sent_at'] != null ? DateTime.parse(map['sent_at'] as String) : null,
      ackedAt: map['acked_at'] != null ? DateTime.parse(map['acked_at'] as String) : null,
    );
  }

  /// Convert to API payload format
  Map<String, dynamic> toApiPayload() {
    return {
      'id': id,
      'entityType': entityType.name.toUpperCase(),
      'entityId': entityId,
      'action': _actionToString(action),
      'payload': payload,
      'occurredAt': occurredAt.toUtc().toIso8601String(),
      'checksum': checksum,
    };
  }

  static String _actionToString(SyncAction action) {
    switch (action) {
      case SyncAction.deliveryValidated:
        return 'DELIVERY_VALIDATED';
      case SyncAction.deliveryCancelled:
        return 'DELIVERY_CANCELLED';
      case SyncAction.invoiceCreated:
        return 'INVOICE_CREATED';
      case SyncAction.invoiceUpdated:
        return 'INVOICE_UPDATED';
      case SyncAction.paymentRecorded:
        return 'PAYMENT_RECORDED';
      case SyncAction.clientUpdated:
        return 'CLIENT_UPDATED';
    }
  }

  static SyncEntityType _parseEntityType(String type) {
    switch (type.toUpperCase()) {
      case 'DELIVERY':
        return SyncEntityType.delivery;
      case 'INVOICE':
        return SyncEntityType.invoice;
      case 'PAYMENT':
        return SyncEntityType.payment;
      case 'CLIENT':
        return SyncEntityType.client;
      default:
        throw ArgumentError('Unknown entity type: $type');
    }
  }

  static SyncAction _parseAction(String action) {
    switch (action.toUpperCase()) {
      case 'DELIVERY_VALIDATED':
        return SyncAction.deliveryValidated;
      case 'DELIVERY_CANCELLED':
        return SyncAction.deliveryCancelled;
      case 'INVOICE_CREATED':
        return SyncAction.invoiceCreated;
      case 'INVOICE_UPDATED':
        return SyncAction.invoiceUpdated;
      case 'PAYMENT_RECORDED':
        return SyncAction.paymentRecorded;
      case 'CLIENT_UPDATED':
        return SyncAction.clientUpdated;
      default:
        throw ArgumentError('Unknown action: $action');
    }
  }

  static SyncEventStatus _parseStatus(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return SyncEventStatus.pending;
      case 'SENDING':
        return SyncEventStatus.sending;
      case 'ACKED':
        return SyncEventStatus.acked;
      case 'FAILED':
        return SyncEventStatus.failed;
      default:
        return SyncEventStatus.pending;
    }
  }
}

/// Manages the sync queue in SQLite
class SyncQueue {
  final OfflineDatabase _db;
  final Uuid _uuid = const Uuid();

  SyncQueue(this._db);

  /// Generate SHA256 checksum for payload
  String generateChecksum(Map<String, dynamic> payload) {
    final sortedKeys = payload.keys.toList()..sort();
    final normalized = <String, dynamic>{};
    for (final key in sortedKeys) {
      normalized[key] = payload[key];
    }
    final jsonStr = jsonEncode(normalized);
    return sha256.convert(utf8.encode(jsonStr)).toString();
  }

  /// Enqueue a new sync event
  Future<SyncEvent> enqueue({
    required SyncEntityType entityType,
    required String entityId,
    required SyncAction action,
    required Map<String, dynamic> payload,
    required String userId,
    required String deviceId,
  }) async {
    final id = _uuid.v4();
    final now = DateTime.now();
    final checksum = generateChecksum(payload);

    final event = SyncEvent(
      id: id,
      entityType: entityType,
      entityId: entityId,
      action: action,
      payload: payload,
      occurredAt: now,
      userId: userId,
      deviceId: deviceId,
      checksum: checksum,
    );

    final db = await _db.database;
    await db.insert('sync_queue', event.toMap());

    return event;
  }

  /// Get all pending events
  Future<List<SyncEvent>> getPendingEvents({int limit = 50}) async {
    final db = await _db.database;
    final results = await db.query(
      'sync_queue',
      where: 'status = ?',
      whereArgs: ['PENDING'],
      orderBy: 'occurred_at ASC',
      limit: limit,
    );
    return results.map((map) => SyncEvent.fromMap(map)).toList();
  }

  /// Get events by status
  Future<List<SyncEvent>> getEventsByStatus(SyncEventStatus status) async {
    final db = await _db.database;
    final results = await db.query(
      'sync_queue',
      where: 'status = ?',
      whereArgs: [status.name.toUpperCase()],
      orderBy: 'occurred_at ASC',
    );
    return results.map((map) => SyncEvent.fromMap(map)).toList();
  }

  /// Mark events as sending
  Future<void> markAsSending(List<String> eventIds, String batchId) async {
    if (eventIds.isEmpty) return;

    final db = await _db.database;
    final placeholders = List.filled(eventIds.length, '?').join(',');
    await db.rawUpdate(
      '''
      UPDATE sync_queue 
      SET status = 'SENDING', 
          batch_id = ?, 
          sent_at = ?
      WHERE id IN ($placeholders)
      ''',
      [batchId, DateTime.now().toUtc().toIso8601String(), ...eventIds],
    );
  }

  /// Mark events as acknowledged
  Future<void> markAsAcked(List<String> eventIds) async {
    if (eventIds.isEmpty) return;

    final db = await _db.database;
    final placeholders = List.filled(eventIds.length, '?').join(',');
    await db.rawUpdate(
      '''
      UPDATE sync_queue 
      SET status = 'ACKED', 
          acked_at = ?
      WHERE id IN ($placeholders)
      ''',
      [DateTime.now().toUtc().toIso8601String(), ...eventIds],
    );
  }

  /// Mark event as failed
  Future<void> markAsFailed(String eventId, String error, {bool incrementRetry = true}) async {
    final db = await _db.database;

    if (incrementRetry) {
      await db.rawUpdate(
        '''
        UPDATE sync_queue 
        SET status = 'FAILED', 
            last_error = ?,
            retry_count = retry_count + 1
        WHERE id = ?
        ''',
        [error, eventId],
      );
    } else {
      await db.update(
        'sync_queue',
        {'status': 'FAILED', 'last_error': error},
        where: 'id = ?',
        whereArgs: [eventId],
      );
    }
  }

  /// Reset failed events to pending for retry
  Future<int> resetFailedForRetry({int maxRetries = 5}) async {
    final db = await _db.database;
    final result = await db.rawUpdate(
      '''
      UPDATE sync_queue 
      SET status = 'PENDING'
      WHERE status = 'FAILED' AND retry_count < ?
      ''',
      [maxRetries],
    );
    return result;
  }

  /// Reset sending events to pending (for crash recovery)
  Future<int> resetSendingToPending() async {
    final db = await _db.database;
    return await db.rawUpdate(
      '''
      UPDATE sync_queue 
      SET status = 'PENDING'
      WHERE status = 'SENDING'
      ''',
    );
  }

  /// Delete acknowledged events
  Future<int> purgeAckedEvents() async {
    final db = await _db.database;
    return await db.delete(
      'sync_queue',
      where: 'status = ?',
      whereArgs: ['ACKED'],
    );
  }

  /// Get count of events by status
  Future<Map<SyncEventStatus, int>> getStatusCounts() async {
    final db = await _db.database;
    final result = await db.rawQuery(
      '''
      SELECT status, COUNT(*) as count 
      FROM sync_queue 
      GROUP BY status
      ''',
    );

    final counts = <SyncEventStatus, int>{};
    for (final row in result) {
      final status = SyncEvent._parseStatus(row['status'] as String);
      counts[status] = row['count'] as int;
    }
    return counts;
  }

  /// Check if event already exists (for idempotency)
  Future<bool> eventExists(String eventId) async {
    final db = await _db.database;
    final result = await db.query(
      'sync_queue',
      columns: ['id'],
      where: 'id = ?',
      whereArgs: [eventId],
      limit: 1,
    );
    return result.isNotEmpty;
  }

  /// Get event by ID
  Future<SyncEvent?> getEvent(String eventId) async {
    final db = await _db.database;
    final result = await db.query(
      'sync_queue',
      where: 'id = ?',
      whereArgs: [eventId],
      limit: 1,
    );
    if (result.isEmpty) return null;
    return SyncEvent.fromMap(result.first);
  }
}
