//! Conflict resolution for sync

use chrono::{DateTime, Utc};
use manchengo_core::EntityId;
use manchengo_domain::events::EventEnvelope;
use serde::{Deserialize, Serialize};

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

/// Conflict resolver
pub struct ConflictResolver {
    default_strategy: ResolutionStrategy,
}

impl ConflictResolver {
    pub fn new(default_strategy: ResolutionStrategy) -> Self {
        Self { default_strategy }
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

    /// Resolve a conflict using the configured strategy
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

        winner
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
        Self::new(ResolutionStrategy::LastWriteWins)
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
