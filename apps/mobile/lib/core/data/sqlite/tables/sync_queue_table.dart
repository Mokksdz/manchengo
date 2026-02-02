/// Sync queue table definition
/// Tracks pending items to sync with central server
abstract class SyncQueueTable {
  static const String tableName = 'sync_queue';
  
  static const String createSql = '''
    CREATE TABLE sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'DELETE')),
      payload TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SYNCED', 'ERROR')),
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      synced_at TEXT
    )
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colEntityType = 'entity_type';
  static const String colEntityId = 'entity_id';
  static const String colAction = 'action';
  static const String colPayload = 'payload';
  static const String colStatus = 'status';
  static const String colErrorMessage = 'error_message';
  static const String colRetryCount = 'retry_count';
  static const String colCreatedAt = 'created_at';
  static const String colSyncedAt = 'synced_at';
}
