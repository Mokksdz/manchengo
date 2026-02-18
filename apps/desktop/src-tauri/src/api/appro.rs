//! Appro API Commands
//!
//! Tauri commands for procurement management.

use tauri::State;

use crate::dto::appro::*;
use crate::state::AppState;

// ============================================================================
// PURCHASE ORDER COMMANDS
// ============================================================================

/// List purchase orders
#[tauri::command]
pub fn list_purchase_orders(
    state: State<AppState>,
    filter: Option<PurchaseOrderFilter>,
) -> Result<Vec<PurchaseOrderDto>, String> {
    state
        .appro_service
        .list_orders(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Get single purchase order
#[tauri::command]
pub fn get_purchase_order(
    state: State<AppState>,
    id: String,
) -> Result<Option<PurchaseOrderDto>, String> {
    state
        .appro_service
        .get_order(&id)
        .map_err(|e| e.to_string())
}

/// Create new purchase order
#[tauri::command]
pub fn create_purchase_order(
    state: State<AppState>,
    data: CreatePurchaseOrderDto,
) -> Result<PurchaseOrderDto, String> {
    state
        .appro_service
        .create_order(data)
        .map_err(|e| e.to_string())
}

/// Confirm purchase order (DRAFT -> CONFIRMED)
#[tauri::command]
pub fn confirm_purchase_order(
    state: State<AppState>,
    id: String,
) -> Result<PurchaseOrderDto, String> {
    state
        .appro_service
        .confirm_order(&id)
        .map_err(|e| e.to_string())
}

/// Send purchase order (CONFIRMED -> SENT)
#[tauri::command]
pub fn send_purchase_order(
    state: State<AppState>,
    id: String,
) -> Result<PurchaseOrderDto, String> {
    state
        .appro_service
        .send_order(&id)
        .map_err(|e| e.to_string())
}

/// Receive purchase order (SENT -> RECEIVED)
#[tauri::command]
pub fn receive_purchase_order(
    state: State<AppState>,
    id: String,
    data: ReceivePurchaseOrderDto,
) -> Result<PurchaseOrderDto, String> {
    let user_id = state
        .session
        .require_user()
        .map_err(|e| e.to_string())?
        .id
        .to_string();

    state
        .appro_service
        .receive_order(&id, data, &user_id)
        .map_err(|e| e.to_string())
}

/// Cancel purchase order
#[tauri::command]
pub fn cancel_purchase_order(state: State<AppState>, id: String) -> Result<(), String> {
    state
        .appro_service
        .cancel_order(&id)
        .map_err(|e| e.to_string())
}

// ============================================================================
// SUPPLIER COMMANDS
// ============================================================================

/// Update supplier
#[tauri::command]
pub fn update_supplier(
    state: State<AppState>,
    id: String,
    data: crate::repositories::supplier_repo::CreateSupplierDto,
) -> Result<crate::repositories::supplier_repo::SupplierDto, String> {
    state
        .supplier_repo
        .update(&id, &data)
        .map_err(|e| e.to_string())?;

    state
        .supplier_repo
        .get(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Supplier not found after update".to_string())
}

/// Get supplier performance
#[tauri::command]
pub fn get_supplier_performance(
    state: State<AppState>,
    supplier_id: String,
) -> Result<SupplierPerformanceDto, String> {
    state
        .appro_service
        .get_supplier_performance(&supplier_id)
        .map_err(|e| e.to_string())
}

// ============================================================================
// DASHBOARD COMMANDS
// ============================================================================

/// Get appro dashboard
#[tauri::command]
pub fn get_appro_dashboard(state: State<AppState>) -> Result<ApproDashboardDto, String> {
    state.appro_service.get_dashboard().map_err(|e| e.to_string())
}
