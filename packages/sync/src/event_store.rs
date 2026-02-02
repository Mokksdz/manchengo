//! Event store for event sourcing

use chrono::{DateTime, Utc};
use manchengo_core::{EntityId, Error, Result};
use manchengo_database::Database;
use manchengo_domain::events::EventEnvelope;
use serde_json;
use tracing::{debug, info};

/// Event store for persisting domain events
pub struct EventStore {
    db: Database,
}

impl EventStore {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Append an event to the store
    pub fn append(&self, event: &EventEnvelope) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO _events (
                    id, aggregate_type, aggregate_id, event_type, payload,
                    occurred_at, user_id, device_id, version, synced
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                rusqlite::params![
                    event.id.to_string(),
                    event.aggregate_type,
                    event.aggregate_id.to_string(),
                    event.event_type,
                    serde_json::to_string(&event.payload)?,
                    event.occurred_at.to_rfc3339(),
                    event.user_id.to_string(),
                    event.device_id.to_string(),
                    event.version,
                    event.synced as i32,
                ],
            )
            .map_err(|e| Error::Database(e.to_string()))?;

            debug!("Event {} appended: {}", event.id, event.event_type);
            Ok(())
        })
    }

    /// Get all unsynced events
    pub fn get_unsynced(&self, limit: i32) -> Result<Vec<EventEnvelope>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT id, aggregate_type, aggregate_id, event_type, payload,
                            occurred_at, user_id, device_id, version, synced
                     FROM _events
                     WHERE synced = 0
                     ORDER BY occurred_at ASC
                     LIMIT ?1",
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            let events = stmt
                .query_map([limit], |row| {
                    Ok(EventEnvelope {
                        id: EntityId::from_uuid(
                            uuid::Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
                        ),
                        aggregate_type: row.get(1)?,
                        aggregate_id: EntityId::from_uuid(
                            uuid::Uuid::parse_str(&row.get::<_, String>(2)?).unwrap(),
                        ),
                        event_type: row.get(3)?,
                        payload: serde_json::from_str(&row.get::<_, String>(4)?).unwrap(),
                        occurred_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                            .unwrap()
                            .with_timezone(&Utc),
                        user_id: EntityId::from_uuid(
                            uuid::Uuid::parse_str(&row.get::<_, String>(6)?).unwrap(),
                        ),
                        device_id: EntityId::from_uuid(
                            uuid::Uuid::parse_str(&row.get::<_, String>(7)?).unwrap(),
                        ),
                        version: row.get(8)?,
                        synced: row.get::<_, i32>(9)? != 0,
                    })
                })
                .map_err(|e| Error::Database(e.to_string()))?;

            let mut result = Vec::new();
            for event in events {
                result.push(event.map_err(|e| Error::Database(e.to_string()))?);
            }

            Ok(result)
        })
    }

    /// Mark events as synced
    pub fn mark_synced(&self, event_ids: &[EntityId]) -> Result<()> {
        if event_ids.is_empty() {
            return Ok(());
        }

        self.db.transaction(|tx| {
            let now = Utc::now().to_rfc3339();

            for id in event_ids {
                tx.execute(
                    "UPDATE _events SET synced = 1, synced_at = ?1 WHERE id = ?2",
                    rusqlite::params![now, id.to_string()],
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            }

            info!("Marked {} events as synced", event_ids.len());
            Ok(())
        })
    }

    /// Get events for an aggregate
    pub fn get_aggregate_events(
        &self,
        aggregate_type: &str,
        aggregate_id: EntityId,
    ) -> Result<Vec<EventEnvelope>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT id, aggregate_type, aggregate_id, event_type, payload,
                            occurred_at, user_id, device_id, version, synced
                     FROM _events
                     WHERE aggregate_type = ?1 AND aggregate_id = ?2
                     ORDER BY version ASC",
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            let events = stmt
                .query_map([aggregate_type, &aggregate_id.to_string()], |row| {
                    Ok(EventEnvelope {
                        id: EntityId::from_uuid(
                            uuid::Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
                        ),
                        aggregate_type: row.get(1)?,
                        aggregate_id: EntityId::from_uuid(
                            uuid::Uuid::parse_str(&row.get::<_, String>(2)?).unwrap(),
                        ),
                        event_type: row.get(3)?,
                        payload: serde_json::from_str(&row.get::<_, String>(4)?).unwrap(),
                        occurred_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                            .unwrap()
                            .with_timezone(&Utc),
                        user_id: EntityId::from_uuid(
                            uuid::Uuid::parse_str(&row.get::<_, String>(6)?).unwrap(),
                        ),
                        device_id: EntityId::from_uuid(
                            uuid::Uuid::parse_str(&row.get::<_, String>(7)?).unwrap(),
                        ),
                        version: row.get(8)?,
                        synced: row.get::<_, i32>(9)? != 0,
                    })
                })
                .map_err(|e| Error::Database(e.to_string()))?;

            let mut result = Vec::new();
            for event in events {
                result.push(event.map_err(|e| Error::Database(e.to_string()))?);
            }

            Ok(result)
        })
    }

    /// Get next version number for an aggregate
    pub fn get_next_version(&self, aggregate_type: &str, aggregate_id: EntityId) -> Result<i64> {
        self.db.with_connection(|conn| {
            let version: i64 = conn
                .query_row(
                    "SELECT COALESCE(MAX(version), 0) + 1
                     FROM _events
                     WHERE aggregate_type = ?1 AND aggregate_id = ?2",
                    [aggregate_type, &aggregate_id.to_string()],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            Ok(version)
        })
    }

    /// Count unsynced events
    pub fn unsynced_count(&self) -> Result<i64> {
        self.db.with_connection(|conn| {
            conn.query_row("SELECT COUNT(*) FROM _events WHERE synced = 0", [], |row| {
                row.get(0)
            })
            .map_err(|e| Error::Database(e.to_string()))
        })
    }
}
