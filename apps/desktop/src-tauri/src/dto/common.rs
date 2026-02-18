//! Common DTOs shared across modules

use serde::{Deserialize, Serialize};

/// Pagination parameters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PaginationParams {
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

impl PaginationParams {
    pub fn page(&self) -> u32 {
        self.page.unwrap_or(1)
    }

    pub fn limit(&self) -> u32 {
        self.limit.unwrap_or(50).min(100)
    }

    pub fn offset(&self) -> u32 {
        (self.page().saturating_sub(1)) * self.limit()
    }
}

/// Paginated response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
    pub total_pages: u32,
}

impl<T> PaginatedResponse<T> {
    pub fn new(items: Vec<T>, total: u64, page: u32, limit: u32) -> Self {
        let total_pages = ((total as f64) / (limit as f64)).ceil() as u32;
        Self {
            items,
            total,
            page,
            limit,
            total_pages,
        }
    }

    pub fn empty() -> Self {
        Self {
            items: vec![],
            total: 0,
            page: 1,
            limit: 50,
            total_pages: 0,
        }
    }
}

/// Generic API response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub database: bool,
    pub sync_service: bool,
    pub is_online: bool,
    pub pending_events: u64,
    pub last_sync: Option<String>,
    pub version: String,
}

/// App information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub database_path: String,
    pub device_id: String,
    pub device_name: String,
    pub is_online: bool,
}

/// Database statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseStats {
    pub size_bytes: u64,
    pub tables_count: u32,
    pub products_mp_count: u64,
    pub products_pf_count: u64,
    pub lots_mp_count: u64,
    pub lots_pf_count: u64,
    pub movements_count: u64,
    pub pending_sync_events: u64,
}

/// Sync status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatusDto {
    pub is_online: bool,
    pub pending_events: u64,
    pub failed_events: u64,
    pub last_push: Option<String>,
    pub last_pull: Option<String>,
    pub conflicts_count: u64,
}

/// Push result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushResultDto {
    pub pushed: u64,
    pub failed: u64,
    pub conflicts: u64,
}

/// Pull result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullResultDto {
    pub received: u64,
    pub applied: u64,
    pub conflicts: u64,
}

/// Full sync result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResultDto {
    pub push: PushResultDto,
    pub pull: PullResultDto,
    pub duration_ms: u64,
}

/// Error response for Tauri commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

impl CommandError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: None,
        }
    }

    pub fn with_details(code: &str, message: &str, details: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: Some(details.to_string()),
        }
    }

    pub fn not_found(entity: &str) -> Self {
        Self::new("NOT_FOUND", &format!("{} non trouve", entity))
    }

    pub fn validation(message: &str) -> Self {
        Self::new("VALIDATION_ERROR", message)
    }

    pub fn unauthorized() -> Self {
        Self::new("UNAUTHORIZED", "Non authentifie")
    }

    pub fn forbidden(message: &str) -> Self {
        Self::new("FORBIDDEN", message)
    }

    pub fn internal(message: &str) -> Self {
        Self::new("INTERNAL_ERROR", message)
    }
}

impl From<anyhow::Error> for CommandError {
    fn from(err: anyhow::Error) -> Self {
        Self::internal(&err.to_string())
    }
}

impl From<rusqlite::Error> for CommandError {
    fn from(err: rusqlite::Error) -> Self {
        Self::with_details("DATABASE_ERROR", "Erreur base de donnees", &err.to_string())
    }
}
