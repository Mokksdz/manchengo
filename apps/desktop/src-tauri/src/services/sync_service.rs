//! Sync Service
//!
//! Handles offline-first synchronization with the backend.
//! Push local events, pull remote changes, resolve conflicts.

use anyhow::Result;
use chrono::{DateTime, Utc};
use manchengo_core::EntityId;
use manchengo_database::Database;
use manchengo_sync::{EventStore, SyncQueue};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::core::AppConfig;
use crate::dto::{PullResultDto, PushResultDto, SyncResultDto, SyncStatusDto};

/// Sync service for offline-first operation
pub struct SyncService {
    db: Arc<Database>,
    event_store: Arc<EventStore>,
    sync_queue: Arc<SyncQueue>,
    http_client: Client,
    config: Arc<RwLock<AppConfig>>,
    device_id: EntityId,
    is_online: Arc<AtomicBool>,
    last_push: Arc<RwLock<Option<DateTime<Utc>>>>,
    last_pull: Arc<RwLock<Option<DateTime<Utc>>>>,
}

impl SyncService {
    pub fn new(
        db: Arc<Database>,
        event_store: Arc<EventStore>,
        sync_queue: Arc<SyncQueue>,
        config: Arc<RwLock<AppConfig>>,
        device_id: EntityId,
    ) -> Self {
        Self {
            db,
            event_store,
            sync_queue,
            http_client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            config,
            device_id,
            is_online: Arc::new(AtomicBool::new(false)),
            last_push: Arc::new(RwLock::new(None)),
            last_pull: Arc::new(RwLock::new(None)),
        }
    }

    /// Check connectivity to backend
    pub async fn check_connectivity(&self) -> bool {
        let config = self.config.read().await;

        match self.http_client
            .get(format!("{}/api/health", config.sync_url))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            Ok(response) => {
                let online = response.status().is_success();
                self.is_online.store(online, Ordering::SeqCst);
                online
            }
            Err(e) => {
                warn!("Connectivity check failed: {}", e);
                self.is_online.store(false, Ordering::SeqCst);
                false
            }
        }
    }

    /// Is currently online
    pub fn is_online(&self) -> bool {
        self.is_online.load(Ordering::SeqCst)
    }

    /// Push local events to server
    pub async fn push(&self, auth_token: &str) -> Result<PushResultDto> {
        // Get unsynced events
        let events = self.event_store.get_unsynced(100)?;

        if events.is_empty() {
            return Ok(PushResultDto {
                pushed: 0,
                failed: 0,
                conflicts: 0,
            });
        }

        let config = self.config.read().await;

        // Prepare payload
        let payload = SyncPushPayload {
            device_id: self.device_id.to_string(),
            events: events
                .iter()
                .map(|e| SyncEventDto {
                    id: e.id.to_string(),
                    event_type: e.event_type.clone(),
                    aggregate_type: e.aggregate_type.clone(),
                    aggregate_id: e.aggregate_id.to_string(),
                    payload: e.payload.to_string(),
                    occurred_at: e.occurred_at.to_rfc3339(),
                })
                .collect(),
        };

        // Send to server
        let response = self.http_client
            .post(format!("{}/api/sync/events", config.sync_url))
            .header("Authorization", format!("Bearer {}", auth_token))
            .header("X-Device-Id", self.device_id.to_string())
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            error!("Push failed: {} - {}", status, body);
            return Ok(PushResultDto {
                pushed: 0,
                failed: events.len() as u64,
                conflicts: 0,
            });
        }

        let result: SyncPushResponse = response.json().await?;

        // Mark events as synced
        if !result.accepted_ids.is_empty() {
            let ids: Vec<EntityId> = result.accepted_ids
                .iter()
                .filter_map(|s| s.parse().ok())
                .collect();
            self.event_store.mark_synced(&ids)?;
        }

        // Update last push time
        *self.last_push.write().await = Some(Utc::now());

        info!(
            "Push complete: {} accepted, {} failed, {} conflicts",
            result.accepted_ids.len(),
            result.failed_ids.len(),
            result.conflicts.len()
        );

        Ok(PushResultDto {
            pushed: result.accepted_ids.len() as u64,
            failed: result.failed_ids.len() as u64,
            conflicts: result.conflicts.len() as u64,
        })
    }

    /// Pull events from server
    pub async fn pull(&self, auth_token: &str) -> Result<PullResultDto> {
        let config = self.config.read().await;
        let last_pull = self.last_pull.read().await;

        // Build query params
        let mut url = format!("{}/api/sync/events", config.sync_url);
        if let Some(since) = &*last_pull {
            url = format!("{}?since={}&device_id={}", url, since.to_rfc3339(), self.device_id);
        } else {
            url = format!("{}?device_id={}", url, self.device_id);
        }

        let response = self.http_client
            .get(&url)
            .header("Authorization", format!("Bearer {}", auth_token))
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            error!("Pull failed: {}", status);
            return Ok(PullResultDto {
                received: 0,
                applied: 0,
                conflicts: 0,
            });
        }

        let result: SyncPullResponse = response.json().await?;

        // Apply events locally
        let mut applied = 0;
        let mut conflicts = 0;

        for event in &result.events {
            match self.apply_event(event) {
                Ok(_) => applied += 1,
                Err(e) => {
                    warn!("Failed to apply event {}: {}", event.id, e);
                    conflicts += 1;
                }
            }
        }

        // Update last pull time
        *self.last_pull.write().await = Some(Utc::now());

        info!(
            "Pull complete: {} received, {} applied, {} conflicts",
            result.events.len(),
            applied,
            conflicts
        );

        Ok(PullResultDto {
            received: result.events.len() as u64,
            applied,
            conflicts,
        })
    }

    /// Full sync (push then pull)
    pub async fn sync(&self, auth_token: &str) -> Result<SyncResultDto> {
        let start = std::time::Instant::now();

        // First push local changes
        let push_result = self.push(auth_token).await?;

        // Then pull remote changes
        let pull_result = self.pull(auth_token).await?;

        Ok(SyncResultDto {
            push: push_result,
            pull: pull_result,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    /// Get sync status
    pub async fn get_status(&self) -> Result<SyncStatusDto> {
        let pending = self.event_store.unsynced_count()? as u64;
        let failed = self.sync_queue.failed_count()? as u64;
        let last_push = self.last_push.read().await;
        let last_pull = self.last_pull.read().await;

        Ok(SyncStatusDto {
            is_online: self.is_online(),
            pending_events: pending,
            failed_events: failed,
            last_push: last_push.map(|d| d.to_rfc3339()),
            last_pull: last_pull.map(|d| d.to_rfc3339()),
            conflicts_count: 0, // TODO: implement conflict tracking
        })
    }

    /// Apply a single event from server
    fn apply_event(&self, _event: &SyncEventDto) -> Result<()> {
        // TODO: Implement event application based on aggregate_type
        // This should update local database based on event type
        Ok(())
    }
}

// ============================================================================
// SYNC PROTOCOL DTOs
// ============================================================================

#[derive(Debug, Serialize)]
struct SyncPushPayload {
    device_id: String,
    events: Vec<SyncEventDto>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SyncEventDto {
    id: String,
    event_type: String,
    aggregate_type: String,
    aggregate_id: String,
    payload: String, // JSON string
    occurred_at: String,
}

#[derive(Debug, Deserialize)]
struct SyncPushResponse {
    accepted_ids: Vec<String>,
    failed_ids: Vec<String>,
    conflicts: Vec<SyncConflict>,
}

#[derive(Debug, Deserialize)]
struct SyncConflict {
    event_id: String,
    conflict_type: String,
    server_version: i64,
    client_version: i64,
}

#[derive(Debug, Deserialize)]
struct SyncPullResponse {
    events: Vec<SyncEventDto>,
    server_timestamp: String,
}
