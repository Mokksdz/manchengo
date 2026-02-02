import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../data/sqlite/database.dart';
import '../data/sqlite/tables/sync_events_table.dart';
import 'sync_event.dart';
import 'device_identity.dart';

/// Service for recording and managing sync events
/// 
/// Responsibilities:
/// - Record events AFTER successful business operations
/// - Mark events as synced
/// - Get pending (unsynced) events for future push
/// 
/// Events are receipts, not state builders.
class SyncEventService {
  static final SyncEventService _instance = SyncEventService._();
  factory SyncEventService() => _instance;
  SyncEventService._();

  final _uuid = const Uuid();

  /// Initialize sync events table
  Future<void> initialize() async {
    final db = await AppDatabase.instance.database;
    await db.execute(SyncEventsTable.createSql);
    await db.execute(SyncEventsTable.indexSql);
  }

  /// Record a sync event after successful business operation
  /// 
  /// Called ONLY after transaction commits successfully.
  /// [entityType] - Type of entity (LOT_MP, INVOICE, etc.)
  /// [entityId] - ID of the entity
  /// [action] - Action performed (MP_RECEIVED, PF_SOLD, etc.)
  /// [payload] - Minimal delta (ids, quantities only)
  /// [userId] - User who performed the action
  Future<void> recordEvent({
    required String entityType,
    required String entityId,
    required String action,
    required Map<String, dynamic> payload,
    required int userId,
  }) async {
    final deviceId = await DeviceIdentity.getDeviceId();
    final now = DateTime.now().toUtc();

    final event = SyncEvent(
      id: _uuid.v4(),
      entityType: entityType,
      entityId: entityId,
      action: action,
      payload: payload,
      occurredAt: now,
      deviceId: deviceId,
      userId: userId,
      synced: false,
      createdAt: now,
    );

    final db = await AppDatabase.instance.database;
    await db.insert(SyncEventsTable.tableName, event.toMap());

    debugPrint('Sync event recorded: ${event.action} ${event.entityType}#${event.entityId}');
  }

  /// Mark event as synced (called after server confirms receipt)
  Future<void> markEventSynced(String eventId) async {
    final db = await AppDatabase.instance.database;
    await db.update(
      SyncEventsTable.tableName,
      {
        SyncEventsTable.colSynced: 1,
        SyncEventsTable.colSyncedAt: DateTime.now().toUtc().toIso8601String(),
      },
      where: '${SyncEventsTable.colId} = ?',
      whereArgs: [eventId],
    );
  }

  /// Mark multiple events as synced
  Future<void> markEventsSynced(List<String> eventIds) async {
    if (eventIds.isEmpty) return;

    final db = await AppDatabase.instance.database;
    final placeholders = eventIds.map((_) => '?').join(',');
    await db.rawUpdate(
      '''
      UPDATE ${SyncEventsTable.tableName} 
      SET ${SyncEventsTable.colSynced} = 1,
          ${SyncEventsTable.colSyncedAt} = ?
      WHERE ${SyncEventsTable.colId} IN ($placeholders)
      ''',
      [DateTime.now().toUtc().toIso8601String(), ...eventIds],
    );
  }

  /// Get pending (unsynced) events for server push
  Future<List<SyncEvent>> getPendingEvents({int limit = 100}) async {
    final db = await AppDatabase.instance.database;
    final maps = await db.query(
      SyncEventsTable.tableName,
      where: '${SyncEventsTable.colSynced} = 0',
      orderBy: '${SyncEventsTable.colOccurredAt} ASC',
      limit: limit,
    );
    return maps.map((m) => SyncEvent.fromMap(m)).toList();
  }

  /// Get count of pending events
  Future<int> getPendingCount() async {
    final db = await AppDatabase.instance.database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM ${SyncEventsTable.tableName} WHERE ${SyncEventsTable.colSynced} = 0',
    );
    return (result.first['count'] as int?) ?? 0;
  }

  /// Get all events for an entity
  Future<List<SyncEvent>> getEventsForEntity(String entityType, String entityId) async {
    final db = await AppDatabase.instance.database;
    final maps = await db.query(
      SyncEventsTable.tableName,
      where: '${SyncEventsTable.colEntityType} = ? AND ${SyncEventsTable.colEntityId} = ?',
      whereArgs: [entityType, entityId],
      orderBy: '${SyncEventsTable.colOccurredAt} ASC',
    );
    return maps.map((m) => SyncEvent.fromMap(m)).toList();
  }
}
