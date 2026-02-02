//! Sync protocol definitions

use chrono::{DateTime, Utc};
use manchengo_core::EntityId;
use manchengo_domain::events::EventEnvelope;
use serde::{Deserialize, Serialize};

/// Sync request from client to server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPushRequest {
    pub device_id: EntityId,
    pub user_id: EntityId,
    pub last_sync_version: i64,
    pub events: Vec<EventEnvelope>,
    pub timestamp: DateTime<Utc>,
}

/// Sync response from server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPushResponse {
    pub success: bool,
    pub synced_event_ids: Vec<EntityId>,
    pub rejected_events: Vec<RejectedEvent>,
    pub new_events: Vec<EventEnvelope>,
    pub server_version: i64,
    pub timestamp: DateTime<Utc>,
}

/// Event rejected during sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectedEvent {
    pub event_id: EntityId,
    pub reason: String,
    pub conflict_id: Option<EntityId>,
}

/// Pull request for getting updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPullRequest {
    pub device_id: EntityId,
    pub user_id: EntityId,
    pub last_sync_version: i64,
    pub aggregate_types: Option<Vec<String>>,
    pub limit: Option<i32>,
}

/// Pull response with new events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPullResponse {
    pub events: Vec<EventEnvelope>,
    pub has_more: bool,
    pub server_version: i64,
    pub timestamp: DateTime<Utc>,
}

/// Sync status for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub is_syncing: bool,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub pending_events: i64,
    pub failed_events: i64,
    pub last_error: Option<String>,
    pub server_reachable: bool,
}

impl Default for SyncStatus {
    fn default() -> Self {
        Self {
            is_syncing: false,
            last_sync_at: None,
            pending_events: 0,
            failed_events: 0,
            last_error: None,
            server_reachable: false,
        }
    }
}

/// Sync configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    /// Server URL for sync
    pub server_url: Option<String>,
    /// Sync interval in seconds
    pub sync_interval_secs: u64,
    /// Batch size for push/pull
    pub batch_size: i32,
    /// Maximum retry attempts
    pub max_retries: i32,
    /// Enable automatic sync
    pub auto_sync: bool,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            server_url: None,
            sync_interval_secs: 300, // 5 minutes
            batch_size: 100,
            max_retries: 5,
            auto_sync: true,
        }
    }
}
