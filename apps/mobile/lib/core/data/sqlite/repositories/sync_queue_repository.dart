import '../tables/sync_queue_table.dart';
import 'base_repository.dart';

/// Sync queue item data model for SQLite
class SyncQueueEntity {
  final int? id;
  final String entityType;
  final int entityId;
  final String action;
  final String? payload;
  final String status;
  final String? errorMessage;
  final int retryCount;
  final DateTime? createdAt;
  final DateTime? syncedAt;

  SyncQueueEntity({
    this.id,
    required this.entityType,
    required this.entityId,
    required this.action,
    this.payload,
    this.status = 'PENDING',
    this.errorMessage,
    this.retryCount = 0,
    this.createdAt,
    this.syncedAt,
  });
}

/// Sync queue repository
class SyncQueueRepository extends BaseRepository<SyncQueueEntity> {
  SyncQueueRepository() : super(SyncQueueTable.tableName);
  
  @override
  SyncQueueEntity fromMap(Map<String, dynamic> map) {
    return SyncQueueEntity(
      id: map[SyncQueueTable.colId] as int?,
      entityType: map[SyncQueueTable.colEntityType] as String,
      entityId: map[SyncQueueTable.colEntityId] as int,
      action: map[SyncQueueTable.colAction] as String,
      payload: map[SyncQueueTable.colPayload] as String?,
      status: map[SyncQueueTable.colStatus] as String,
      errorMessage: map[SyncQueueTable.colErrorMessage] as String?,
      retryCount: map[SyncQueueTable.colRetryCount] as int? ?? 0,
      createdAt: map[SyncQueueTable.colCreatedAt] != null 
          ? DateTime.parse(map[SyncQueueTable.colCreatedAt] as String) 
          : null,
      syncedAt: map[SyncQueueTable.colSyncedAt] != null 
          ? DateTime.parse(map[SyncQueueTable.colSyncedAt] as String) 
          : null,
    );
  }
  
  @override
  Map<String, dynamic> toMap(SyncQueueEntity item) {
    return {
      SyncQueueTable.colEntityType: item.entityType,
      SyncQueueTable.colEntityId: item.entityId,
      SyncQueueTable.colAction: item.action,
      SyncQueueTable.colPayload: item.payload,
      SyncQueueTable.colStatus: item.status,
      SyncQueueTable.colErrorMessage: item.errorMessage,
      SyncQueueTable.colRetryCount: item.retryCount,
    };
  }
  
  /// Get pending items
  Future<List<SyncQueueEntity>> getPending() async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${SyncQueueTable.colStatus} = ?',
      whereArgs: ['PENDING'],
      orderBy: '${SyncQueueTable.colCreatedAt} ASC',
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Get error items
  Future<List<SyncQueueEntity>> getErrors() async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${SyncQueueTable.colStatus} = ?',
      whereArgs: ['ERROR'],
      orderBy: '${SyncQueueTable.colCreatedAt} DESC',
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Mark item as synced
  Future<void> markSynced(int id) async {
    final database = await db;
    await database.update(
      tableName,
      {
        SyncQueueTable.colStatus: 'SYNCED',
        SyncQueueTable.colSyncedAt: DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }
  
  /// Mark item as error
  Future<void> markError(int id, String errorMessage) async {
    final database = await db;
    await database.rawUpdate(
      '''UPDATE $tableName SET 
        ${SyncQueueTable.colStatus} = 'ERROR',
        ${SyncQueueTable.colErrorMessage} = ?,
        ${SyncQueueTable.colRetryCount} = ${SyncQueueTable.colRetryCount} + 1
        WHERE id = ?''',
      [errorMessage, id],
    );
  }
  
  /// Clear synced items
  Future<int> clearSynced() async {
    final database = await db;
    return await database.delete(
      tableName,
      where: '${SyncQueueTable.colStatus} = ?',
      whereArgs: ['SYNCED'],
    );
  }
  
  /// Count pending items
  Future<int> countPending() async {
    final database = await db;
    final result = await database.rawQuery(
      'SELECT COUNT(*) as count FROM $tableName WHERE ${SyncQueueTable.colStatus} = ?',
      ['PENDING'],
    );
    return (result.first['count'] as int?) ?? 0;
  }
}
