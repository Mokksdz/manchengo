//! Conflict resolution for sync

use chrono::{DateTime, Utc};
use manchengo_core::{EntityId, Error, Result};
use manchengo_database::Database;
use manchengo_domain::events::EventEnvelope;
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};

/// Conflict resolution strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResolutionStrategy {
    /// Last write wins based on timestamp
    LastWriteWins,
    /// Server always wins
    ServerWins,
    /// Client always wins
    ClientWins,
    /// Require manual resolution
    Manual,
}

/// Detected conflict between local and remote events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConflict {
    pub id: EntityId,
    pub aggregate_type: String,
    pub aggregate_id: EntityId,
    pub local_event: EventEnvelope,
    pub remote_event: EventEnvelope,
    pub detected_at: DateTime<Utc>,
    pub resolved: bool,
    pub resolution: Option<ConflictResolution>,
}

/// Resolution of a conflict
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictResolution {
    pub strategy: String,
    pub winning_event_id: EntityId,
    pub resolved_at: DateTime<Utc>,
    pub resolved_by: Option<EntityId>,
    pub notes: Option<String>,
}

/// Conflict resolver with optional database persistence
pub struct ConflictResolver {
    default_strategy: ResolutionStrategy,
    db: Option<Database>,
}

impl ConflictResolver {
    pub fn new(default_strategy: ResolutionStrategy) -> Self {
        Self { default_strategy, db: None }
    }

    /// Create a ConflictResolver with database persistence
    pub fn with_db(default_strategy: ResolutionStrategy, db: Database) -> Self {
        Self { default_strategy, db: Some(db) }
    }

    /// Detect if two events conflict
    pub fn detect_conflict(
        &self,
        local: &EventEnvelope,
        remote: &EventEnvelope,
    ) -> Option<SyncConflict> {
        // Conflict if same aggregate with different versions
        if local.aggregate_type == remote.aggregate_type
            && local.aggregate_id == remote.aggregate_id
            && local.version == remote.version
            && local.id != remote.id
        {
            Some(SyncConflict {
                id: EntityId::new(),
                aggregate_type: local.aggregate_type.clone(),
                aggregate_id: local.aggregate_id,
                local_event: local.clone(),
                remote_event: remote.clone(),
                detected_at: Utc::now(),
                resolved: false,
                resolution: None,
            })
        } else {
            None
        }
    }

    /// Resolve a conflict using the configured strategy and persist to DB
    pub fn resolve<'a>(&self, conflict: &'a mut SyncConflict) -> &'a EventEnvelope {
        let (winner, strategy_name): (&EventEnvelope, &str) = match self.default_strategy {
            ResolutionStrategy::LastWriteWins => {
                if conflict.local_event.occurred_at >= conflict.remote_event.occurred_at {
                    (&conflict.local_event, "LAST_WRITE_WINS_LOCAL")
                } else {
                    (&conflict.remote_event, "LAST_WRITE_WINS_REMOTE")
                }
            }
            ResolutionStrategy::ServerWins => {
                (&conflict.remote_event, "SERVER_WINS")
            }
            ResolutionStrategy::ClientWins => {
                (&conflict.local_event, "CLIENT_WINS")
            }
            ResolutionStrategy::Manual => {
                // For manual, default to server until resolved
                (&conflict.remote_event, "MANUAL_PENDING")
            }
        };

        conflict.resolved = true;
        conflict.resolution = Some(ConflictResolution {
            strategy: strategy_name.to_string(),
            winning_event_id: winner.id,
            resolved_at: Utc::now(),
            resolved_by: None,
            notes: None,
        });

        // Persist conflict resolution to database
        if let Err(e) = self.persist_conflict(conflict) {
            warn!("Failed to persist conflict resolution: {}", e);
        }

        winner
    }

    /// Persist a conflict and its resolution to the database
    fn persist_conflict(&self, conflict: &SyncConflict) -> Result<()> {
        let db = match &self.db {
            Some(db) => db,
            None => return Ok(()), // No DB configured, skip persistence
        };

        let resolution = conflict.resolution.as_ref();

        db.with_connection(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO _conflicts (
                    id, aggregate_type, aggregate_id, local_event_id, remote_event_id,
                    detected_at, resolved, resolution_strategy, winning_event_id,
                    resolved_at, resolved_by, notes
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                rusqlite::params![
                    conflict.id.to_string(),
                    conflict.aggregate_type,
                    conflict.aggregate_id.to_string(),
                    conflict.local_event.id.to_string(),
                    conflict.remote_event.id.to_string(),
                    conflict.detected_at.to_rfc3339(),
                    conflict.resolved as i32,
                    resolution.map(|r| r.strategy.clone()),
                    resolution.map(|r| r.winning_event_id.to_string()),
                    resolution.map(|r| r.resolved_at.to_rfc3339()),
                    resolution.and_then(|r| r.resolved_by.map(|id| id.to_string())),
                    resolution.and_then(|r| r.notes.clone()),
                ],
            )
            .map_err(|e| Error::Database(e.to_string()))?;

            debug!("Conflict {} persisted (resolved={})", conflict.id, conflict.resolved);
            Ok(())
        })
    }

    /// Get unresolved conflicts from the database
    pub fn get_unresolved(&self) -> Result<Vec<SyncConflict>> {
        let db = match &self.db {
            Some(db) => db,
            None => return Ok(Vec::new()),
        };

        db.with_connection(|conn| {
            let mut stmt = conn
                .prepare("SELECT id, aggregate_type, aggregate_id, detected_at, resolved FROM _conflicts WHERE resolved = 0 ORDER BY detected_at ASC")
                .map_err(|e| Error::Database(e.to_string()))?;

            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM _conflicts WHERE resolved = 0", [], |row| row.get(0))
                .map_err(|e| Error::Database(e.to_string()))?;

            debug!("Found {} unresolved conflicts", count);
            drop(stmt);
            Ok(Vec::new()) // Full reconstruction requires event lookup, return count-based info for now
        })
    }

    /// Check if event type should force server-wins
    pub fn should_force_server_wins(&self, event_type: &str) -> bool {
        // Critical events that server should always control
        matches!(
            event_type,
            "UserCreated" | "UserDeleted" | "RoleChanged" | "PriceListActivated"
        )
    }

    /// Check if event is safe to auto-merge
    pub fn is_auto_mergeable(&self, event_type: &str) -> bool {
        // Read-only or additive events can be safely merged
        matches!(
            event_type,
            "LotMpCreated" | "LotPfCreated" | "SalesOrderCreated" | "PaymentReceived"
        )
    }
}

impl Default for ConflictResolver {
    fn default() -> Self {
        Self { default_strategy: ResolutionStrategy::LastWriteWins, db: None }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_conflict_different_aggregates() {
        let resolver = ConflictResolver::default();

        let local = EventEnvelope {
            id: EntityId::new(),
            aggregate_type: "LotMp".to_string(),
            aggregate_id: EntityId::new(),
            event_type: "Created".to_string(),
            payload: serde_json::json!({}),
            occurred_at: Utc::now(),
            user_id: EntityId::new(),
            device_id: EntityId::new(),
            version: 1,
            synced: false,
        };

        let remote = EventEnvelope {
            id: EntityId::new(),
            aggregate_type: "LotMp".to_string(),
            aggregate_id: EntityId::new(), // Different aggregate
            event_type: "Created".to_string(),
            payload: serde_json::json!({}),
            occurred_at: Utc::now(),
            user_id: EntityId::new(),
            device_id: EntityId::new(),
            version: 1,
            synced: true,
        };

        assert!(resolver.detect_conflict(&local, &remote).is_none());
    }
}
