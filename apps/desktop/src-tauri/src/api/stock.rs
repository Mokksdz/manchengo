//! Stock API Commands
//!
//! Tauri commands for stock management.
//! All business logic is in StockService - commands just delegate.

use tauri::State;

use crate::dto::*;
use crate::state::AppState;

// ============================================================================
// PRODUCT COMMANDS
// ============================================================================

/// List MP products
#[tauri::command]
pub fn list_products_mp(
    state: State<AppState>,
    filter: Option<ProductFilter>,
) -> Result<Vec<ProductMpDto>, String> {
    state.product_repo
        .list_mp(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Get single MP product
#[tauri::command]
pub fn get_product_mp(
    state: State<AppState>,
    id: String,
) -> Result<Option<ProductMpDto>, String> {
    state.product_repo
        .get_mp(&id)
        .map_err(|e| e.to_string())
}

/// List PF products
#[tauri::command]
pub fn list_products_pf(
    state: State<AppState>,
    filter: Option<ProductFilter>,
) -> Result<Vec<ProductPfDto>, String> {
    state.product_repo
        .list_pf(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Get single PF product
#[tauri::command]
pub fn get_product_pf(
    state: State<AppState>,
    id: String,
) -> Result<Option<ProductPfDto>, String> {
    state.product_repo
        .get_pf(&id)
        .map_err(|e| e.to_string())
}

// ============================================================================
// LOT COMMANDS
// ============================================================================

/// List MP lots
#[tauri::command]
pub fn list_lots_mp(
    state: State<AppState>,
    filter: Option<LotFilter>,
) -> Result<Vec<LotMpDto>, String> {
    state.lot_repo
        .list_mp(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Get single MP lot
#[tauri::command]
pub fn get_lot_mp(
    state: State<AppState>,
    id: String,
) -> Result<Option<LotMpDto>, String> {
    state.lot_repo
        .get_mp(&id)
        .map_err(|e| e.to_string())
}

/// List PF lots
#[tauri::command]
pub fn list_lots_pf(
    state: State<AppState>,
    filter: Option<LotFilter>,
) -> Result<Vec<LotPfDto>, String> {
    state.lot_repo
        .list_pf(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Get single PF lot
#[tauri::command]
pub fn get_lot_pf(
    state: State<AppState>,
    id: String,
) -> Result<Option<LotPfDto>, String> {
    state.lot_repo
        .get_pf(&id)
        .map_err(|e| e.to_string())
}

/// Block lot
#[tauri::command]
pub fn block_lot(
    state: State<AppState>,
    lot_id: String,
    product_type: String,
    reason: String,
) -> Result<(), String> {
    state.stock_service
        .block_lot(&lot_id, &product_type, &reason)
        .map_err(|e| e.to_string())
}

/// Unblock lot
#[tauri::command]
pub fn unblock_lot(
    state: State<AppState>,
    lot_id: String,
    product_type: String,
) -> Result<(), String> {
    state.stock_service
        .unblock_lot(&lot_id, &product_type)
        .map_err(|e| e.to_string())
}

// ============================================================================
// STOCK LEVEL COMMANDS
// ============================================================================

/// Get MP stock levels
#[tauri::command]
pub fn get_stock_mp(state: State<AppState>) -> Result<Vec<StockLevelDto>, String> {
    state.stock_service
        .get_stock_mp()
        .map_err(|e| e.to_string())
}

/// Get PF stock levels
#[tauri::command]
pub fn get_stock_pf(state: State<AppState>) -> Result<Vec<StockLevelDto>, String> {
    state.stock_service
        .get_stock_pf()
        .map_err(|e| e.to_string())
}

/// Get stock alerts
#[tauri::command]
pub fn get_stock_alerts(state: State<AppState>) -> Result<StockAlertsDto, String> {
    state.stock_service
        .get_stock_alerts()
        .map_err(|e| e.to_string())
}

/// Get expiring lots
#[tauri::command]
pub fn get_expiring_lots(
    state: State<AppState>,
    days: Option<i32>,
) -> Result<Vec<ExpiringLotDto>, String> {
    state.stock_service
        .get_expiring_lots(days.unwrap_or(30))
        .map_err(|e| e.to_string())
}

// ============================================================================
// FIFO COMMANDS
// ============================================================================

/// Preview FIFO consumption
#[tauri::command]
pub fn preview_fifo_consumption(
    state: State<AppState>,
    product_id: String,
    quantity: f64,
) -> Result<FifoPreviewDto, String> {
    state.stock_service
        .preview_fifo(&product_id, quantity)
        .map_err(|e| e.to_string())
}

/// Execute FIFO consumption
#[tauri::command]
pub fn consume_fifo(
    state: State<AppState>,
    product_id: String,
    quantity: f64,
    origin: String,
    reference_type: Option<String>,
    reference_id: Option<String>,
) -> Result<FifoResultDto, String> {
    let user_id = state.session
        .require_user()
        .map_err(|e| e.to_string())?
        .id
        .to_string();

    state.stock_service
        .consume_fifo(
            &product_id,
            quantity,
            &origin,
            reference_type.as_deref(),
            reference_id.as_deref(),
            &user_id,
        )
        .map_err(|e| e.to_string())
}

// ============================================================================
// RECEPTION COMMANDS
// ============================================================================

/// Create reception
#[tauri::command]
pub fn create_reception(
    state: State<AppState>,
    data: CreateReceptionDto,
) -> Result<ReceptionDto, String> {
    let user_id = state.session
        .require_user()
        .map_err(|e| e.to_string())?
        .id
        .to_string();

    state.stock_service
        .create_reception(data, &user_id)
        .map_err(|e| e.to_string())
}

// ============================================================================
// INVENTORY COMMANDS
// ============================================================================

/// Adjust inventory
#[tauri::command]
pub fn adjust_inventory(
    state: State<AppState>,
    data: AdjustInventoryDto,
) -> Result<InventoryAdjustmentDto, String> {
    let user_id = state.session
        .require_user()
        .map_err(|e| e.to_string())?
        .id
        .to_string();

    state.stock_service
        .adjust_inventory(data, &user_id)
        .map_err(|e| e.to_string())
}

/// Declare loss
#[tauri::command]
pub fn declare_loss(
    state: State<AppState>,
    data: DeclareLossDto,
) -> Result<LossDeclarationDto, String> {
    let user_id = state.session
        .require_user()
        .map_err(|e| e.to_string())?
        .id
        .to_string();

    state.stock_service
        .declare_loss(data, &user_id)
        .map_err(|e| e.to_string())
}

// ============================================================================
// MOVEMENT COMMANDS
// ============================================================================

/// List movements
#[tauri::command]
pub fn list_movements(
    state: State<AppState>,
    filter: Option<MovementFilter>,
) -> Result<Vec<MovementDto>, String> {
    state.movement_repo
        .list(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Get movement history for product
#[tauri::command]
pub fn get_movement_history(
    state: State<AppState>,
    product_type: String,
    product_id: String,
    limit: Option<u32>,
) -> Result<Vec<MovementDto>, String> {
    state.movement_repo
        .get_product_history(&product_type, &product_id, limit.unwrap_or(50))
        .map_err(|e| e.to_string())
}

// ============================================================================
// SUPPLIER COMMANDS
// ============================================================================

/// List suppliers
#[tauri::command]
pub fn list_suppliers(
    state: State<AppState>,
    active_only: Option<bool>,
) -> Result<Vec<crate::repositories::supplier_repo::SupplierDto>, String> {
    state.supplier_repo
        .list(active_only.unwrap_or(true))
        .map_err(|e| e.to_string())
}

/// Get supplier
#[tauri::command]
pub fn get_supplier(
    state: State<AppState>,
    id: String,
) -> Result<Option<crate::repositories::supplier_repo::SupplierDto>, String> {
    state.supplier_repo
        .get(&id)
        .map_err(|e| e.to_string())
}

/// Create supplier
#[tauri::command]
pub fn create_supplier(
    state: State<AppState>,
    data: crate::repositories::supplier_repo::CreateSupplierDto,
) -> Result<crate::repositories::supplier_repo::SupplierDto, String> {
    let id = manchengo_core::EntityId::new().to_string();
    let code = state.supplier_repo.generate_code().map_err(|e| e.to_string())?;

    state.supplier_repo.create(&id, &code, &data).map_err(|e| e.to_string())?;

    state.supplier_repo
        .get(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Fournisseur non trouve apres creation".to_string())
}
