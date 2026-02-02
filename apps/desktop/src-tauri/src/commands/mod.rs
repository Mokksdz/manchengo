//! Tauri command handlers

pub mod stock;
pub mod production;
pub mod commercial;
pub mod delivery;

use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

/// Application info response
#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub database_path: String,
    pub device_id: String,
}

/// Get application information
#[tauri::command]
pub fn get_app_info(state: State<Arc<AppState>>) -> AppInfo {
    AppInfo {
        name: "Manchengo Smart ERP".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        database_path: state.db.path().to_string(),
        device_id: state.device_id.to_string(),
    }
}

/// Sync status response
#[derive(Debug, Serialize)]
pub struct SyncStatusResponse {
    pub pending_events: i64,
    pub failed_events: i64,
    pub last_sync: Option<String>,
    pub is_online: bool,
}

/// Get sync status
#[tauri::command]
pub fn get_sync_status(state: State<Arc<AppState>>) -> Result<SyncStatusResponse, String> {
    let pending = state
        .event_store
        .unsynced_count()
        .map_err(|e| e.to_string())?;

    let failed = state
        .sync_queue
        .failed_count()
        .map_err(|e| e.to_string())?;

    Ok(SyncStatusResponse {
        pending_events: pending,
        failed_events: failed,
        last_sync: None, // TODO: Track last sync time
        is_online: false, // TODO: Check connectivity
    })
}
