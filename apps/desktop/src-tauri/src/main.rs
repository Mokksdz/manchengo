//! Manchengo ERP Desktop Application
//!
//! Tauri-based desktop application with native Rust core.
//! ALL business logic lives in Rust services - UI is purely declarative.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// New modular architecture
mod core;
mod dto;
mod repositories;
mod services;
mod api;
mod state;

use manchengo_database::{Database, DatabaseConfig};
use manchengo_database::migrations::initialize_database;
use state::AppState;
use crate::core::AppConfig;
use tauri::http::Response;
use tracing::{info, error, Level};
use tracing_subscriber::FmtSubscriber;

// Embed the UI HTML directly into the binary
const INDEX_HTML: &str = include_str!("../ui/index.html");

fn main() {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::DEBUG)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set tracing subscriber");

    info!("Starting Manchengo ERP Desktop v{}...", env!("CARGO_PKG_VERSION"));

    // Load or create configuration
    let config = AppConfig::load().unwrap_or_else(|e| {
        error!("Failed to load config, using defaults: {}", e);
        AppConfig::default()
    });

    // Ensure directories exist
    if let Err(e) = config.ensure_directories() {
        error!("Failed to create directories: {}", e);
        eprintln!("Error: Could not create data directories: {}", e);
        std::process::exit(1);
    }

    let db_path = config.database_path.to_string_lossy().to_string();

    // Initialize database
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

    // Create app state with new architecture
    let app_state = match AppState::new(db, config) {
        Ok(state) => state,
        Err(e) => {
            error!("Failed to initialize app state: {}", e);
            eprintln!("Error: Failed to initialize app state: {}", e);
            std::process::exit(1);
        }
    };

    // Build and run Tauri app
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // ================================================================
            // SYSTEM COMMANDS (6)
            // ================================================================
            api::get_app_info,
            api::get_health_status,
            api::get_database_stats,
            api::check_connectivity,
            api::get_device_info,
            api::clear_local_cache,

            // ================================================================
            // STOCK COMMANDS (31) - FIFO, Receptions, etc.
            // ================================================================
            // Products
            api::list_products_mp,
            api::get_product_mp,
            api::list_products_pf,
            api::get_product_pf,

            // Lots
            api::list_lots_mp,
            api::get_lot_mp,
            api::list_lots_pf,
            api::get_lot_pf,
            api::block_lot,
            api::unblock_lot,

            // Stock levels & alerts
            api::get_stock_mp,
            api::get_stock_pf,
            api::get_stock_alerts,
            api::get_expiring_lots,

            // FIFO (CRITICAL)
            api::preview_fifo_consumption,
            api::consume_fifo,

            // Receptions
            api::create_reception,

            // Inventory adjustments
            api::adjust_inventory,
            api::declare_loss,

            // Movements
            api::list_movements,
            api::get_movement_history,

            // Suppliers (moved from appro)
            api::list_suppliers,
            api::get_supplier,
            api::create_supplier,

            // ================================================================
            // PRODUCTION COMMANDS (15) - NEW
            // ================================================================
            // Recipes
            api::list_recipes,
            api::get_recipe,
            api::create_recipe,
            api::update_recipe,
            api::delete_recipe,
            api::get_scaled_recipe,
            api::check_recipe_availability,

            // Production Orders
            api::list_production_orders,
            api::get_production_order,
            api::create_production_order,
            api::start_production,
            api::complete_production,
            api::cancel_production,

            // Dashboard & Analytics
            api::get_production_dashboard,
            api::get_production_calendar,
            api::calculate_production_cost,

            // ================================================================
            // APPRO COMMANDS (12) - NEW
            // ================================================================
            // Purchase Orders
            api::list_purchase_orders,
            api::get_purchase_order,
            api::create_purchase_order,
            api::confirm_purchase_order,
            api::send_purchase_order,
            api::receive_purchase_order,
            api::cancel_purchase_order,

            // Supplier Management
            api::update_supplier,
            api::get_supplier_performance,

            // Dashboard
            api::get_appro_dashboard,

            // ================================================================
            // COMMERCIAL COMMANDS (9) - NEW
            // ================================================================
            // Clients
            api::list_clients,
            api::get_client,
            api::create_client,
            api::update_client,
            api::delete_client,
            api::get_client_balance,
            api::get_client_history,

            // Price Lists
            api::list_price_lists,
            api::get_client_prices,

            // ================================================================
            // INVOICE COMMANDS (10) - NEW
            // ================================================================
            // Invoices
            api::list_invoices,
            api::get_invoice,
            api::create_invoice,
            api::validate_invoice,
            api::void_invoice,
            api::calculate_invoice_totals,
            api::calculate_timbre_fiscal,

            // Payments
            api::list_payments,
            api::create_payment,
            api::get_outstanding_invoices,

            // ================================================================
            // SYNC COMMANDS (4)
            // ================================================================
            api::sync_push,
            api::sync_pull,
            api::sync_full,
            api::get_sync_status,

        ])
        // Register custom protocol to serve embedded HTML
        .register_asynchronous_uri_scheme_protocol("tauri", |_ctx, request, responder| {
            let path = request.uri().path();
            info!("Custom protocol request: {}", path);

            let (content, content_type) = if path == "/" || path == "/index.html" || path.is_empty() {
                (INDEX_HTML.as_bytes().to_vec(), "text/html; charset=utf-8")
            } else {
                // Return empty for unknown paths
                (Vec::new(), "text/plain")
            };

            let response = Response::builder()
                .status(200)
                .header("Content-Type", content_type)
                .header("Access-Control-Allow-Origin", "*")
                .body(content)
                .unwrap();

            responder.respond(response);
        })
        .run(tauri::generate_context!())
        .expect("Error running Manchengo ERP");
}
