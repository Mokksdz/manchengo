//! Manchengo ERP Desktop Application
//!
//! Tauri-based desktop application for full ERP functionality.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;

use manchengo_database::{Database, DatabaseConfig};
use manchengo_database::migrations::initialize_database;
use state::AppState;
use std::sync::Arc;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

fn main() {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::DEBUG)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set tracing subscriber");

    info!("Starting Manchengo ERP Desktop...");

    // Initialize database
    let db_path = get_database_path();
    let db_config = DatabaseConfig {
        path: db_path.clone(),
        ..Default::default()
    };

    let db = Database::open(db_config).expect("Failed to open database");

    // Run migrations
    db.with_connection(|conn| {
        initialize_database(conn)
    }).expect("Failed to run migrations");

    info!("Database initialized at: {}", db_path);

    // Create app state
    let app_state = AppState::new(db);

    // Build and run Tauri app
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Arc::new(app_state))
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::get_sync_status,
            // Stock commands
            commands::stock::list_products_mp,
            commands::stock::get_product_mp,
            commands::stock::list_lots_mp,
            commands::stock::get_lot_mp,
            // Production commands
            commands::production::list_production_orders,
            commands::production::get_production_order,
            // Commercial commands
            commands::commercial::list_clients,
            commands::commercial::get_client,
            commands::commercial::list_sales_orders,
            // Delivery commands
            commands::delivery::list_deliveries,
            commands::delivery::get_delivery,
        ])
        .run(tauri::generate_context!())
        .expect("Error running Manchengo ERP");
}

fn get_database_path() -> String {
    // In production, use app data directory
    // For now, use current directory
    if cfg!(debug_assertions) {
        "manchengo_dev.db".to_string()
    } else {
        dirs::data_dir()
            .map(|p: std::path::PathBuf| p.join("manchengo-erp").join("manchengo.db"))
            .map(|p: std::path::PathBuf| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "manchengo.db".to_string())
    }
}
