/// Sync events table definition
/// Records all business mutations as events for offline-first sync
abstract class SyncEventsTable {
  static const String tableName = 'sync_events';
  
  static const String createSql = '''
    CREATE TABLE IF NOT EXISTS sync_events (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT,
      created_at TEXT NOT NULL
    )
  ''';

  static const String indexSql = '''
    CREATE INDEX IF NOT EXISTS idx_sync_events_synced 
    ON sync_events (synced, occurred_at)
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colEntityType = 'entity_type';
  static const String colEntityId = 'entity_id';
  static const String colAction = 'action';
  static const String colPayload = 'payload';
  static const String colOccurredAt = 'occurred_at';
  static const String colDeviceId = 'device_id';
  static const String colUserId = 'user_id';
  static const String colSynced = 'synced';
  static const String colSyncedAt = 'synced_at';
  static const String colCreatedAt = 'created_at';
}
