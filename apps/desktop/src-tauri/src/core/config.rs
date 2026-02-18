//! Application Configuration
//!
//! Manages app settings including database paths, sync URLs, and runtime options.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Path to SQLite database
    pub database_path: PathBuf,
    /// Backend API URL for sync
    pub sync_url: String,
    /// Sync interval in seconds (default: 30)
    pub sync_interval_secs: u64,
    /// Expiry check interval in seconds (default: 3600)
    pub expiry_check_interval_secs: u64,
    /// Device name for identification
    pub device_name: String,
    /// Offline mode flag
    pub offline_mode: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            database_path: Self::default_database_path(),
            sync_url: "https://manchengo-backend-production.up.railway.app".to_string(),
            sync_interval_secs: 30,
            expiry_check_interval_secs: 3600,
            device_name: hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_else(|_| "Desktop".to_string()),
            offline_mode: false,
        }
    }
}

impl AppConfig {
    /// Get platform-specific data directory
    pub fn data_dir() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("dz.manchengo.smart.erp")
    }

    /// Get default database path (sandbox-safe)
    pub fn default_database_path() -> PathBuf {
        Self::data_dir().join("manchengo.db")
    }

    /// Get cache directory path
    pub fn cache_dir() -> PathBuf {
        dirs::cache_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("dz.manchengo.smart.erp")
    }

    /// Get exports/downloads directory
    pub fn export_dir() -> PathBuf {
        dirs::download_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Downloads"))
    }

    /// Load configuration from file or create default
    pub fn load() -> anyhow::Result<Self> {
        let config_path = Self::data_dir().join("config.json");

        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            let config: AppConfig = serde_json::from_str(&content)?;
            Ok(config)
        } else {
            let config = Self::default();
            config.save()?;
            Ok(config)
        }
    }

    /// Save configuration to file
    pub fn save(&self) -> anyhow::Result<()> {
        let config_dir = Self::data_dir();
        std::fs::create_dir_all(&config_dir)?;

        let config_path = config_dir.join("config.json");
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(config_path, content)?;

        Ok(())
    }

    /// Ensure all required directories exist
    pub fn ensure_directories(&self) -> anyhow::Result<()> {
        std::fs::create_dir_all(Self::data_dir())?;
        std::fs::create_dir_all(Self::cache_dir())?;

        if let Some(parent) = self.database_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();
        assert!(!config.sync_url.is_empty());
        assert_eq!(config.sync_interval_secs, 30);
    }
}
