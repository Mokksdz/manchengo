//! Manchengo Smart ERP Desktop Application
//!
//! Tauri-based native desktop app for Windows and macOS.
//! Provides offline-first capabilities with SQLite local storage,
//! file system access for exports, and sync with central server.

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod database;
mod device;
mod sync;

use tauri::{Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, CustomMenuItem};

fn main() {
    // System tray menu
    let quit = CustomMenuItem::new("quit".to_string(), "Quitter");
    let show = CustomMenuItem::new("show".to_string(), "Afficher");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(tauri::SystemTrayMenuItem::Separator)
        .add_item(quit);
    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(window) = app.get_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    std::process::exit(0);
                }
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                _ => {}
            },
            _ => {}
        })
        .setup(|app| {
            // Initialize database on startup
            let app_dir = app.path_resolver().app_data_dir().unwrap();
            std::fs::create_dir_all(&app_dir).ok();
            
            let db_path = app_dir.join("manchengo.db");
            database::init_database(&db_path)?;
            
            // Store paths in app state
            app.manage(AppState {
                db_path: db_path.to_string_lossy().to_string(),
                app_dir: app_dir.to_string_lossy().to_string(),
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Device commands
            commands::get_device_id,
            commands::get_device_info,
            // Database commands
            commands::db_query,
            commands::db_execute,
            // Sync commands
            commands::sync_push,
            commands::sync_pull,
            // File commands
            commands::export_pdf,
            commands::export_excel,
            commands::print_document,
            // License commands
            commands::check_license,
            commands::register_device,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Application state shared across commands
pub struct AppState {
    pub db_path: String,
    pub app_dir: String,
}
