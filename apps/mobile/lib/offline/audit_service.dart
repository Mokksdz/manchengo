import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:uuid/uuid.dart';
import 'database.dart';

/// Local audit entry for offline audit trail
class LocalAuditEntry {
  final String id;
  final String? eventId;
  final String action;
  final String entityType;
  final String entityId;
  final String userId;
  final String deviceId;
  final DateTime occurredAt;
  final Map<String, dynamic>? context;
  final String? payloadHash;
  bool synced;

  LocalAuditEntry({
    required this.id,
    this.eventId,
    required this.action,
    required this.entityType,
    required this.entityId,
    required this.userId,
    required this.deviceId,
    required this.occurredAt,
    this.context,
    this.payloadHash,
    this.synced = false,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'event_id': eventId,
      'action': action,
      'entity_type': entityType,
      'entity_id': entityId,
      'user_id': userId,
      'device_id': deviceId,
      'occurred_at': occurredAt.toUtc().toIso8601String(),
      'context': context != null ? jsonEncode(context) : null,
      'payload_hash': payloadHash,
      'synced': synced ? 1 : 0,
    };
  }

  factory LocalAuditEntry.fromMap(Map<String, dynamic> map) {
    return LocalAuditEntry(
      id: map['id'] as String,
      eventId: map['event_id'] as String?,
      action: map['action'] as String,
      entityType: map['entity_type'] as String,
      entityId: map['entity_id'] as String,
      userId: map['user_id'] as String,
      deviceId: map['device_id'] as String,
      occurredAt: DateTime.parse(map['occurred_at'] as String),
      context: map['context'] != null
          ? jsonDecode(map['context'] as String) as Map<String, dynamic>
          : null,
      payloadHash: map['payload_hash'] as String?,
      synced: (map['synced'] as int?) == 1,
    );
  }

  Map<String, dynamic> toApiPayload() {
    return {
      'id': id,
      'event_id': eventId,
      'action': action,
      'entity_type': entityType,
      'entity_id': entityId,
      'user_id': userId,
      'device_id': deviceId,
      'occurred_at': occurredAt.toUtc().toIso8601String(),
      'context': context,
      'payload_hash': payloadHash,
    };
  }
}

/// Append-only audit service for offline operations
class AuditService {
  final OfflineDatabase _db;
  final Uuid _uuid = const Uuid();

  String? _currentUserId;
  String? _currentDeviceId;

  AuditService(this._db);

  /// Initialize with current user and device
  Future<void> initialize() async {
    final db = await _db.database;

    // Get current user from session
    final session = await db.query('user_session', limit: 1);
    if (session.isNotEmpty) {
      _currentUserId = session.first['user_id'] as String?;
      _currentDeviceId = session.first['device_id'] as String?;
    }

    // Fallback to sync_meta for device_id
    _currentDeviceId ??= await _db.getDeviceId();
  }

  /// Set current user context
  void setUserContext(String userId, String deviceId) {
    _currentUserId = userId;
    _currentDeviceId = deviceId;
  }

  /// Generate SHA256 hash for payload
  String generatePayloadHash(Map<String, dynamic> payload) {
    final jsonStr = jsonEncode(payload);
    return sha256.convert(utf8.encode(jsonStr)).toString();
  }

  /// Log an audit entry (append-only)
  Future<LocalAuditEntry> log({
    required String action,
    required String entityType,
    required String entityId,
    String? eventId,
    Map<String, dynamic>? payload,
    Map<String, dynamic>? context,
  }) async {
    final entry = LocalAuditEntry(
      id: _uuid.v4(),
      eventId: eventId,
      action: action,
      entityType: entityType,
      entityId: entityId,
      userId: _currentUserId ?? 'UNKNOWN',
      deviceId: _currentDeviceId ?? 'UNKNOWN',
      occurredAt: DateTime.now(),
      context: context,
      payloadHash: payload != null ? generatePayloadHash(payload) : null,
    );

    final db = await _db.database;
    await db.insert('local_audit_log', entry.toMap());

    return entry;
  }

  /// Log delivery scan attempt
  Future<LocalAuditEntry> logDeliveryScan({
    required String deliveryId,
    required String qrCode,
    required bool success,
    String? errorCode,
    double? latitude,
    double? longitude,
  }) async {
    return log(
      action: success ? 'DELIVERY_SCAN_SUCCESS' : 'DELIVERY_SCAN_FAILED',
      entityType: 'DELIVERY',
      entityId: deliveryId,
      context: {
        'qr_code': qrCode,
        'success': success,
        'error_code': errorCode,
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Log invoice creation
  Future<LocalAuditEntry> logInvoiceCreated({
    required String invoiceId,
    required int clientId,
    required int totalTtc,
  }) async {
    return log(
      action: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: invoiceId,
      context: {
        'client_id': clientId,
        'total_ttc': totalTtc,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Log payment recorded
  Future<LocalAuditEntry> logPaymentRecorded({
    required String paymentId,
    required int invoiceId,
    required int amount,
    required String paymentMethod,
  }) async {
    return log(
      action: 'PAYMENT_RECORDED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      context: {
        'invoice_id': invoiceId,
        'amount': amount,
        'payment_method': paymentMethod,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  /// Log fraud attempt
  Future<void> logFraudAttempt({
    required String type,
    required String details,
  }) async {
    final db = await _db.database;

    await db.insert('fraud_attempts', {
      'id': _uuid.v4(),
      'type': type,
      'details': details,
      'occurred_at': DateTime.now().toUtc().toIso8601String(),
      'user_id': _currentUserId,
      'device_id': _currentDeviceId ?? 'UNKNOWN',
      'synced': 0,
    });

    // Also log to audit
    await log(
      action: 'FRAUD_ATTEMPT',
      entityType: 'SECURITY',
      entityId: type,
      context: {
        'type': type,
        'details': details,
      },
    );
  }

  /// Get unsynced audit entries
  Future<List<LocalAuditEntry>> getUnsyncedEntries({int limit = 100}) async {
    final db = await _db.database;
    final results = await db.query(
      'local_audit_log',
      where: 'synced = ?',
      whereArgs: [0],
      orderBy: 'occurred_at ASC',
      limit: limit,
    );

    return results.map((map) => LocalAuditEntry.fromMap(map)).toList();
  }

  /// Mark entries as synced
  Future<void> markAsSynced(List<String> entryIds) async {
    if (entryIds.isEmpty) return;

    final db = await _db.database;
    final placeholders = List.filled(entryIds.length, '?').join(',');

    await db.rawUpdate(
      '''
      UPDATE local_audit_log 
      SET synced = 1 
      WHERE id IN ($placeholders)
      ''',
      entryIds,
    );
  }

  /// Get audit entries for entity
  Future<List<LocalAuditEntry>> getEntriesForEntity({
    required String entityType,
    required String entityId,
    int? limit,
  }) async {
    final db = await _db.database;
    final results = await db.query(
      'local_audit_log',
      where: 'entity_type = ? AND entity_id = ?',
      whereArgs: [entityType, entityId],
      orderBy: 'occurred_at DESC',
      limit: limit,
    );

    return results.map((map) => LocalAuditEntry.fromMap(map)).toList();
  }

  /// Get recent audit entries
  Future<List<LocalAuditEntry>> getRecentEntries({
    int limit = 50,
    String? action,
  }) async {
    final db = await _db.database;

    String? where;
    List<dynamic>? whereArgs;

    if (action != null) {
      where = 'action = ?';
      whereArgs = [action];
    }

    final results = await db.query(
      'local_audit_log',
      where: where,
      whereArgs: whereArgs,
      orderBy: 'occurred_at DESC',
      limit: limit,
    );

    return results.map((map) => LocalAuditEntry.fromMap(map)).toList();
  }

  /// Get audit statistics
  Future<AuditStats> getStats() async {
    final db = await _db.database;

    final totalResult = await db.rawQuery(
      'SELECT COUNT(*) as count FROM local_audit_log',
    );
    final unsyncedResult = await db.rawQuery(
      "SELECT COUNT(*) as count FROM local_audit_log WHERE synced = 0",
    );
    final fraudResult = await db.rawQuery(
      'SELECT COUNT(*) as count FROM fraud_attempts',
    );

    return AuditStats(
      totalEntries: (totalResult.first['count'] as int?) ?? 0,
      unsyncedEntries: (unsyncedResult.first['count'] as int?) ?? 0,
      fraudAttempts: (fraudResult.first['count'] as int?) ?? 0,
    );
  }

  /// Get unsynced fraud attempts
  Future<List<Map<String, dynamic>>> getUnsyncedFraudAttempts() async {
    final db = await _db.database;
    return await db.query(
      'fraud_attempts',
      where: 'synced = ?',
      whereArgs: [0],
      orderBy: 'occurred_at ASC',
    );
  }

  /// Mark fraud attempts as synced
  Future<void> markFraudAttemptsSynced(List<String> ids) async {
    if (ids.isEmpty) return;

    final db = await _db.database;
    final placeholders = List.filled(ids.length, '?').join(',');

    await db.rawUpdate(
      '''
      UPDATE fraud_attempts 
      SET synced = 1 
      WHERE id IN ($placeholders)
      ''',
      ids,
    );
  }
}

/// Audit statistics
class AuditStats {
  final int totalEntries;
  final int unsyncedEntries;
  final int fraudAttempts;

  AuditStats({
    required this.totalEntries,
    required this.unsyncedEntries,
    required this.fraudAttempts,
  });

  @override
  String toString() {
    return 'AuditStats(total: $totalEntries, unsynced: $unsyncedEntries, fraud: $fraudAttempts)';
  }
}
