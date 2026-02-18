//! Sync API Commands
//!
//! Commands for offline-first synchronization.

use tauri::State;

use crate::dto::*;
use crate::state::AppState;

/// Push local events to server
#[tauri::command]
pub async fn sync_push(state: State<'_, AppState>) -> Result<PushResultDto, String> {
    let token = state.session
        .get_auth_token()
        .ok_or("Non authentifie")?;

    state.sync_service
        .push(&token)
        .await
        .map_err(|e| e.to_string())
}

/// Pull events from server
#[tauri::command]
pub async fn sync_pull(state: State<'_, AppState>) -> Result<PullResultDto, String> {
    let token = state.session
        .get_auth_token()
        .ok_or("Non authentifie")?;

    state.sync_service
        .pull(&token)
        .await
        .map_err(|e| e.to_string())
}

/// Full sync (push then pull)
#[tauri::command]
pub async fn sync_full(state: State<'_, AppState>) -> Result<SyncResultDto, String> {
    let token = state.session
        .get_auth_token()
        .ok_or("Non authentifie")?;

    state.sync_service
        .sync(&token)
        .await
        .map_err(|e| e.to_string())
}

/// Get sync status
#[tauri::command]
pub async fn get_sync_status(state: State<'_, AppState>) -> Result<SyncStatusDto, String> {
    state.sync_service
        .get_status()
        .await
        .map_err(|e| e.to_string())
}
