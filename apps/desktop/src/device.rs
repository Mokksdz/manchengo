//! Device identification and platform detection
//!
//! Generates unique device ID and collects platform information
//! for device registration with the server.

use serde::{Deserialize, Serialize};
use std::env;

/// Device information for registration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceInfo {
    pub device_id: String,
    pub platform: String,
    pub device_name: String,
    pub os_version: String,
    pub app_version: String,
}

/// Get unique machine ID
/// Uses machine-uid crate for hardware-based unique identifier
pub fn get_machine_id() -> String {
    machine_uid::get()
        .unwrap_or_else(|_| uuid::Uuid::new_v4().to_string())
}

/// Get platform string for server registration
pub fn get_platform() -> String {
    #[cfg(target_os = "windows")]
    return "WINDOWS".to_string();
    
    #[cfg(target_os = "macos")]
    return "MACOS".to_string();
    
    #[cfg(target_os = "linux")]
    return "LINUX".to_string();
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return "UNKNOWN".to_string();
}

/// Get device name (computer hostname)
pub fn get_device_name() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "Unknown Device".to_string())
}

/// Get OS version string
pub fn get_os_version() -> String {
    let os = env::consts::OS;
    let arch = env::consts::ARCH;
    format!("{} {}", os, arch)
}

/// Collect all device information
pub fn get_device_info() -> DeviceInfo {
    DeviceInfo {
        device_id: get_machine_id(),
        platform: get_platform(),
        device_name: get_device_name(),
        os_version: get_os_version(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}
