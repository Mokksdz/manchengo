//! Sync module for server communication
//!
//! Handles push/pull synchronization with the central server.
//! Uses same protocol as mobile app.

use crate::commands::SyncResult;
use crate::database;
use crate::device;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
struct SyncEvent {
    id: String,
    entity_type: String,
    entity_id: String,
    action: String,
    payload: serde_json::Value,
    occurred_at: String,
}

#[derive(Serialize, Debug)]
struct PushRequest {
    device_id: String,
    events: Vec<SyncEvent>,
}

#[derive(Deserialize, Debug)]
struct PushResponse {
    success: bool,
    processed: usize,
    #[serde(default)]
    errors: Vec<String>,
}

#[derive(Deserialize, Debug)]
struct PullResponse {
    events: Vec<SyncEvent>,
    server_time: String,
}

/// Push local events to server
pub async fn push_events(
    db_path: &str,
    server_url: &str,
    token: &str,
) -> Result<SyncResult, String> {
    let device_info = device::get_device_info();
    
    // Get pending events from local DB
    let events_json = database::get_pending_events(db_path)?;
    let events: Vec<SyncEvent> = serde_json::from_str(&events_json)
        .map_err(|e| e.to_string())?;
    
    if events.is_empty() {
        return Ok(SyncResult {
            success: true,
            events_pushed: 0,
            events_pulled: 0,
            error: None,
        });
    }
    
    let event_ids: Vec<String> = events.iter().map(|e| e.id.clone()).collect();
    
    // Send to server
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/sync/events", server_url))
        .header("Authorization", format!("Bearer {}", token))
        .header("X-Device-Id", &device_info.device_id)
        .json(&PushRequest {
            device_id: device_info.device_id,
            events,
        })
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Ok(SyncResult {
            success: false,
            events_pushed: 0,
            events_pulled: 0,
            error: Some(format!("Server error: {}", response.status())),
        });
    }
    
    let push_response: PushResponse = response.json().await.map_err(|e| e.to_string())?;
    
    if push_response.success {
        // Mark events as synced
        database::mark_events_synced(db_path, &event_ids)?;
    }
    
    Ok(SyncResult {
        success: push_response.success,
        events_pushed: push_response.processed,
        events_pulled: 0,
        error: if push_response.errors.is_empty() {
            None
        } else {
            Some(push_response.errors.join(", "))
        },
    })
}

/// Pull events from server
pub async fn pull_events(
    db_path: &str,
    server_url: &str,
    token: &str,
) -> Result<SyncResult, String> {
    let device_info = device::get_device_info();
    
    // Get last sync time from local DB
    let last_sync = database::query(
        db_path,
        "SELECT MAX(synced_at) as last_sync FROM sync_state",
        "[]",
    ).unwrap_or_else(|_| "[]".to_string());
    
    let since = serde_json::from_str::<Vec<serde_json::Value>>(&last_sync)
        .ok()
        .and_then(|v| v.first().cloned())
        .and_then(|v| v.get("last_sync").cloned())
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "2000-01-01T00:00:00Z".to_string());
    
    // Request events from server
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/sync/events", server_url))
        .header("Authorization", format!("Bearer {}", token))
        .header("X-Device-Id", &device_info.device_id)
        .query(&[
            ("since", since.as_str()),
            ("device_id", device_info.device_id.as_str()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Ok(SyncResult {
            success: false,
            events_pushed: 0,
            events_pulled: 0,
            error: Some(format!("Server error: {}", response.status())),
        });
    }
    
    let pull_response: PullResponse = response.json().await.map_err(|e| e.to_string())?;
    
    // Apply events to local DB
    for event in &pull_response.events {
        // Apply each event based on entity_type and action
        // This would be expanded to handle all event types
        apply_event(db_path, event)?;
    }
    
    // Update sync state
    database::execute(
        db_path,
        &format!(
            "INSERT OR REPLACE INTO sync_state (id, last_sync, synced_at) VALUES (1, '{}', datetime('now'))",
            pull_response.server_time
        ),
        "[]",
    )?;
    
    Ok(SyncResult {
        success: true,
        events_pushed: 0,
        events_pulled: pull_response.events.len(),
        error: None,
    })
}

/// Apply a sync event to local database
fn apply_event(db_path: &str, event: &SyncEvent) -> Result<(), String> {
    // Event application logic depends on entity_type and action
    // This is a simplified version - full implementation would match mobile app
    
    match event.entity_type.as_str() {
        "CLIENT" => apply_client_event(db_path, event),
        "INVOICE" => apply_invoice_event(db_path, event),
        "PRODUCT_PF" => apply_product_event(db_path, event),
        _ => Ok(()), // Ignore unknown event types
    }
}

fn apply_client_event(db_path: &str, event: &SyncEvent) -> Result<(), String> {
    // Apply client-related events
    // Implementation depends on action type
    Ok(())
}

fn apply_invoice_event(db_path: &str, event: &SyncEvent) -> Result<(), String> {
    // Apply invoice-related events
    Ok(())
}

fn apply_product_event(db_path: &str, event: &SyncEvent) -> Result<(), String> {
    // Apply product-related events
    Ok(())
}
