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
use tracing::{info, error, Level};
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

    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(&db_path).parent() {
        if !parent.exists() {
            info!("Creating database directory: {}", parent.display());
            if let Err(e) = std::fs::create_dir_all(parent) {
                error!("Failed to create database directory: {}", e);
                eprintln!("Error: Could not create data directory at {}: {}", parent.display(), e);
                std::process::exit(1);
            }
        }
    }

    let db_config = DatabaseConfig {
        path: db_path.clone(),
        ..Default::default()
    };

    let db = match Database::open(db_config) {
        Ok(db) => db,
        Err(e) => {
            error!("Failed to open database at {}: {}", db_path, e);
            eprintln!("Error: Could not open database at {}: {}", db_path, e);
            std::process::exit(1);
        }
    };

    // Run migrations
    if let Err(e) = db.with_connection(|conn| initialize_database(conn)) {
        error!("Failed to run database migrations: {}", e);
        eprintln!("Error: Database migration failed: {}", e);
        std::process::exit(1);
    }

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
    if cfg!(debug_assertions) {
        "manchengo_dev.db".to_string()
    } else {
        dirs::data_dir()
            .map(|p: std::path::PathBuf| p.join("manchengo-erp").join("manchengo.db"))
            .map(|p: std::path::PathBuf| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "manchengo.db".to_string())
    }
}
