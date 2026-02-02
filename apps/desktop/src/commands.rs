//! Tauri commands exposed to the frontend
//!
//! These commands bridge the Rust backend with the web frontend,
//! providing access to native capabilities.

use crate::{database, device, sync, AppState};
use serde::{Deserialize, Serialize};
use tauri::State;

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

/// Get unique device ID for this machine
#[tauri::command]
pub fn get_device_id() -> String {
    device::get_machine_id()
}

/// Get full device information
#[tauri::command]
pub fn get_device_info() -> device::DeviceInfo {
    device::get_device_info()
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

/// Execute a read query on local SQLite
#[tauri::command]
pub fn db_query(
    state: State<AppState>,
    sql: String,
    params: String,
) -> Result<String, String> {
    database::query(&state.db_path, &sql, &params)
}

/// Execute a write statement on local SQLite
#[tauri::command]
pub fn db_execute(
    state: State<AppState>,
    sql: String,
    params: String,
) -> Result<i64, String> {
    database::execute(&state.db_path, &sql, &params)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Serialize, Deserialize)]
pub struct SyncResult {
    pub success: bool,
    pub events_pushed: usize,
    pub events_pulled: usize,
    pub error: Option<String>,
}

/// Push local events to server
#[tauri::command]
pub async fn sync_push(
    state: State<'_, AppState>,
    server_url: String,
    token: String,
) -> Result<SyncResult, String> {
    sync::push_events(&state.db_path, &server_url, &token).await
}

/// Pull events from server
#[tauri::command]
pub async fn sync_pull(
    state: State<'_, AppState>,
    server_url: String,
    token: String,
) -> Result<SyncResult, String> {
    sync::pull_events(&state.db_path, &server_url, &token).await
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

/// Export data as PDF file
#[tauri::command]
pub async fn export_pdf(
    state: State<'_, AppState>,
    filename: String,
    content: String,
) -> Result<String, String> {
    let exports_dir = std::path::Path::new(&state.app_dir).join("exports");
    std::fs::create_dir_all(&exports_dir).map_err(|e| e.to_string())?;
    
    let file_path = exports_dir.join(&filename);
    
    // For now, write raw content - in production use printpdf crate
    std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;
    
    Ok(file_path.to_string_lossy().to_string())
}

/// Export data as Excel file
#[tauri::command]
pub async fn export_excel(
    state: State<'_, AppState>,
    filename: String,
    content: String,
) -> Result<String, String> {
    let exports_dir = std::path::Path::new(&state.app_dir).join("exports");
    std::fs::create_dir_all(&exports_dir).map_err(|e| e.to_string())?;
    
    let file_path = exports_dir.join(&filename);
    
    // Write content as CSV for now - frontend can use xlsx library
    std::fs::write(&file_path, &content).map_err(|e| e.to_string())?;
    
    Ok(file_path.to_string_lossy().to_string())
}

/// Print a document
#[tauri::command]
pub async fn print_document(content: String) -> Result<bool, String> {
    // Platform-specific printing
    // On Windows: use windows-printing crate
    // On macOS: use system print dialog
    
    #[cfg(target_os = "macos")]
    {
        // Use lpr command on macOS
        let temp_file = std::env::temp_dir().join("manchengo_print.txt");
        std::fs::write(&temp_file, &content).map_err(|e| e.to_string())?;
        
        std::process::Command::new("lpr")
            .arg(&temp_file)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "windows")]
    {
        // Use notepad /p on Windows as simple solution
        let temp_file = std::env::temp_dir().join("manchengo_print.txt");
        std::fs::write(&temp_file, &content).map_err(|e| e.to_string())?;
        
        std::process::Command::new("notepad")
            .args(["/p", &temp_file.to_string_lossy()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    Ok(true)
}

// ═══════════════════════════════════════════════════════════════════════════════
// LICENSE COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Serialize, Deserialize)]
pub struct LicenseStatus {
    pub valid: bool,
    pub read_only: bool,
    pub reason: Option<String>,
    pub expires_at: Option<String>,
    pub license_type: Option<String>,
}

/// Check license status with server
#[tauri::command]
pub async fn check_license(
    server_url: String,
    token: String,
) -> Result<LicenseStatus, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .get(format!("{}/api/licensing/status", server_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Ok(LicenseStatus {
            valid: false,
            read_only: true,
            reason: Some("Failed to check license".to_string()),
            expires_at: None,
            license_type: None,
        });
    }
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    
    Ok(LicenseStatus {
        valid: data["valid"].as_bool().unwrap_or(false),
        read_only: data["readOnly"].as_bool().unwrap_or(true),
        reason: data["reason"].as_str().map(String::from),
        expires_at: data["license"]["expiresAt"].as_str().map(String::from),
        license_type: data["license"]["type"].as_str().map(String::from),
    })
}

/// Register this device with server
#[tauri::command]
pub async fn register_device(
    server_url: String,
    token: String,
) -> Result<bool, String> {
    let device_info = device::get_device_info();
    let client = reqwest::Client::new();
    
    let response = client
        .post(format!("{}/api/licensing/register-device", server_url))
        .header("Authorization", format!("Bearer {}", token))
        .header("X-Device-Id", &device_info.device_id)
        .json(&serde_json::json!({
            "deviceId": device_info.device_id,
            "platform": device_info.platform,
            "deviceName": device_info.device_name,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(response.status().is_success())
}
