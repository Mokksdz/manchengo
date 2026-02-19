//! System API Commands
//!
//! System information, health checks, and configuration commands.

use tauri::State;

use crate::dto::*;
use crate::state::AppState;

/// Get application info
#[tauri::command]
pub fn get_app_info(state: State<AppState>) -> AppInfo {
    let config = state.config.blocking_read();

    AppInfo {
        name: "Manchengo Smart ERP".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        database_path: config.database_path.to_string_lossy().to_string(),
        device_id: state.device_id.to_string(),
        device_name: config.device_name.clone(),
        is_online: state.is_online.load(std::sync::atomic::Ordering::SeqCst),
    }
}

/// Get health status
#[tauri::command]
pub fn get_health_status(state: State<AppState>) -> Result<HealthStatus, String> {
    let db_ok = state.db.with_connection(|conn| {
        match conn.query_row("SELECT 1", [], |_| Ok(true)) {
            Ok(v) => Ok(v),
            Err(e) => Err(manchengo_core::Error::Database(e.to_string())),
        }
    }).unwrap_or(false);

    let pending = state.event_store.unsynced_count().unwrap_or(0) as u64;

    Ok(HealthStatus {
        database: db_ok,
        sync_service: true, // TODO: check sync service health
        is_online: state.is_online.load(std::sync::atomic::Ordering::SeqCst),
        pending_events: pending,
        last_sync: None, // TODO: get from sync service
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Get database statistics
#[tauri::command]
pub fn get_database_stats(state: State<AppState>) -> Result<DatabaseStats, String> {
    let _user_id = state.session
        .require_user()
        .map_err(|e| e.to_string())?;

    let config = state.config.blocking_read();

    let size = std::fs::metadata(&config.database_path)
        .map(|m| m.len())
        .unwrap_or(0);

    let products_mp = state.product_repo.count_mp().unwrap_or(0);
    let products_pf = state.product_repo.count_pf().unwrap_or(0);
    let lots_mp = state.lot_repo.count_mp().unwrap_or(0);
    let lots_pf = state.lot_repo.count_pf().unwrap_or(0);
    let movements = state.movement_repo.count().unwrap_or(0);
    let pending_sync = state.event_store.unsynced_count().unwrap_or(0) as u64;

    Ok(DatabaseStats {
        size_bytes: size,
        tables_count: 20, // Approximate
        products_mp_count: products_mp,
        products_pf_count: products_pf,
        lots_mp_count: lots_mp,
        lots_pf_count: lots_pf,
        movements_count: movements,
        pending_sync_events: pending_sync,
    })
}

/// Check connectivity
#[tauri::command]
pub async fn check_connectivity(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.sync_service.check_connectivity().await)
}

/// Get device info
#[tauri::command]
pub fn get_device_info(state: State<AppState>) -> Result<serde_json::Value, String> {
    let config = state.config.blocking_read();

    Ok(serde_json::json!({
        "device_id": state.device_id.to_string(),
        "device_name": config.device_name,
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    }))
}

/// Clear local cache
#[tauri::command]
pub fn clear_local_cache(_state: State<AppState>) -> Result<(), String> {
    use crate::core::AppConfig;

    let cache_dir = AppConfig::cache_dir();
    if cache_dir.exists() {
        std::fs::remove_dir_all(&cache_dir).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}
