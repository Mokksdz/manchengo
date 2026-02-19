//! Sync queue management

use chrono::{DateTime, Utc};
use manchengo_core::{EntityId, Error, Result};
use manchengo_database::Database;
use tracing::{debug, warn};

/// Priority levels for sync queue
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyncPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

/// Sync queue item
#[derive(Debug, Clone)]
pub struct SyncQueueItem {
    pub id: EntityId,
    pub event_id: EntityId,
    pub priority: SyncPriority,
    pub attempts: i32,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Sync queue for managing pending uploads
pub struct SyncQueue {
    db: Database,
    max_attempts: i32,
}

impl SyncQueue {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            max_attempts: 5,
        }
    }

    pub fn with_max_attempts(mut self, max: i32) -> Self {
        self.max_attempts = max;
        self
    }

    /// Add event to sync queue
    pub fn enqueue(&self, event_id: EntityId, priority: SyncPriority) -> Result<EntityId> {
        let id = EntityId::new();

        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO _sync_queue (id, event_id, priority) VALUES (?1, ?2, ?3)",
                rusqlite::params![id.to_string(), event_id.to_string(), priority as i32],
            )
            .map_err(|e| Error::Database(e.to_string()))?;

            debug!("Event {} added to sync queue with priority {:?}", event_id, priority);
            Ok(id)
        })
    }

    /// Get next batch of items to sync
    pub fn get_pending(&self, limit: i32) -> Result<Vec<SyncQueueItem>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT sq.id, sq.event_id, sq.priority, sq.attempts,
                            sq.last_attempt_at, sq.error_message, sq.created_at
                     FROM _sync_queue sq
                     WHERE sq.attempts < ?1
                     ORDER BY sq.priority DESC, sq.created_at ASC
                     LIMIT ?2",
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            let items = stmt
                .query_map([self.max_attempts, limit], |row| {
                    let priority_val: i32 = row.get(2)?;
                    Ok(SyncQueueItem {
                        id: EntityId::from_uuid(
                            uuid::Uuid::parse_str(&row.get::<_, String>(0)?)
                                .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?,
                        ),
                        event_id: EntityId::from_uuid(
                            uuid::Uuid::parse_str(&row.get::<_, String>(1)?)
                                .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?,
                        ),
                        priority: match priority_val {
                            0 => SyncPriority::Low,
                            1 => SyncPriority::Normal,
                            2 => SyncPriority::High,
                            _ => SyncPriority::Critical,
                        },
                        attempts: row.get(3)?,
                        last_attempt_at: row
                            .get::<_, Option<String>>(4)?
                            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                            .map(|dt| dt.with_timezone(&Utc)),
                        error_message: row.get(5)?,
                        created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                            .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?
                            .with_timezone(&Utc),
                    })
                })
                .map_err(|e| Error::Database(e.to_string()))?;

            let mut result = Vec::new();
            for item in items {
                result.push(item.map_err(|e| Error::Database(e.to_string()))?);
            }

            Ok(result)
        })
    }

    /// Mark item as successfully synced (remove from queue)
    pub fn mark_complete(&self, queue_id: EntityId) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "DELETE FROM _sync_queue WHERE id = ?1",
                [queue_id.to_string()],
            )
            .map_err(|e| Error::Database(e.to_string()))?;

            debug!("Sync queue item {} completed", queue_id);
            Ok(())
        })
    }

    /// Mark item as failed (increment attempts)
    pub fn mark_failed(&self, queue_id: EntityId, error: &str) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE _sync_queue
                 SET attempts = attempts + 1,
                     last_attempt_at = ?1,
                     error_message = ?2
                 WHERE id = ?3",
                rusqlite::params![Utc::now().to_rfc3339(), error, queue_id.to_string()],
            )
            .map_err(|e| Error::Database(e.to_string()))?;

            warn!("Sync queue item {} failed: {}", queue_id, error);
            Ok(())
        })
    }

    /// Get count of pending items
    pub fn pending_count(&self) -> Result<i64> {
        self.db.with_connection(|conn| {
            conn.query_row(
                "SELECT COUNT(*) FROM _sync_queue WHERE attempts < ?1",
                [self.max_attempts],
                |row| row.get(0),
            )
            .map_err(|e| Error::Database(e.to_string()))
        })
    }

    /// Get count of failed items (exceeded max attempts)
    pub fn failed_count(&self) -> Result<i64> {
        self.db.with_connection(|conn| {
            conn.query_row(
                "SELECT COUNT(*) FROM _sync_queue WHERE attempts >= ?1",
                [self.max_attempts],
                |row| row.get(0),
            )
            .map_err(|e| Error::Database(e.to_string()))
        })
    }

    /// Clear all completed items older than given age
    pub fn cleanup_old_items(&self, days: i32) -> Result<i64> {
        self.db.with_connection(|conn| {
            let threshold = Utc::now() - chrono::Duration::days(days as i64);

            let deleted = conn
                .execute(
                    "DELETE FROM _sync_queue WHERE created_at < ?1 AND attempts >= ?2",
                    rusqlite::params![threshold.to_rfc3339(), self.max_attempts],
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            Ok(deleted as i64)
        })
    }
}
