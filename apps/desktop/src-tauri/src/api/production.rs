//! Production API Commands
//!
//! Tauri commands for production management (recipes and orders).
//! All business logic is in ProductionService - commands just delegate.

use tauri::State;

use crate::dto::*;
use crate::state::AppState;

// ============================================================================
// RECIPE COMMANDS
// ============================================================================

/// List recipes
#[tauri::command]
pub fn list_recipes(
    state: State<AppState>,
    filter: Option<RecipeFilter>,
) -> Result<Vec<RecipeDto>, String> {
    state
        .production_service
        .list_recipes(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Get single recipe
#[tauri::command]
pub fn get_recipe(state: State<AppState>, id: String) -> Result<Option<RecipeDto>, String> {
    state
        .production_service
        .get_recipe(&id)
        .map_err(|e| e.to_string())
}

/// Create new recipe
#[tauri::command]
pub fn create_recipe(state: State<AppState>, data: CreateRecipeDto) -> Result<RecipeDto, String> {
    state
        .production_service
        .create_recipe(data)
        .map_err(|e| e.to_string())
}

/// Update recipe
#[tauri::command]
pub fn update_recipe(
    state: State<AppState>,
    id: String,
    data: CreateRecipeDto,
) -> Result<RecipeDto, String> {
    state
        .production_service
        .update_recipe(&id, data)
        .map_err(|e| e.to_string())
}

/// Delete recipe
#[tauri::command]
pub fn delete_recipe(state: State<AppState>, id: String) -> Result<(), String> {
    state
        .production_service
        .delete_recipe(&id)
        .map_err(|e| e.to_string())
}

/// Get scaled recipe for production planning
#[tauri::command]
pub fn get_scaled_recipe(
    state: State<AppState>,
    product_pf_id: String,
    batch_count: i32,
) -> Result<ScaledRecipeDto, String> {
    state
        .production_service
        .get_scaled_recipe(&product_pf_id, batch_count)
        .map_err(|e| e.to_string())
}

/// Check recipe availability (can production start?)
#[tauri::command]
pub fn check_recipe_availability(
    state: State<AppState>,
    product_pf_id: String,
    batch_count: i32,
) -> Result<AvailabilityDto, String> {
    state
        .production_service
        .check_availability(&product_pf_id, batch_count)
        .map_err(|e| e.to_string())
}

// ============================================================================
// PRODUCTION ORDER COMMANDS
// ============================================================================

/// List production orders
#[tauri::command]
pub fn list_production_orders(
    state: State<AppState>,
    filter: Option<ProductionOrderFilter>,
) -> Result<Vec<ProductionOrderDto>, String> {
    state
        .production_service
        .list_orders(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Get single production order
#[tauri::command]
pub fn get_production_order(
    state: State<AppState>,
    id: String,
) -> Result<Option<ProductionOrderDto>, String> {
    state
        .production_service
        .get_order(&id)
        .map_err(|e| e.to_string())
}

/// Create new production order
#[tauri::command]
pub fn create_production_order(
    state: State<AppState>,
    data: CreateProductionOrderDto,
) -> Result<ProductionOrderDto, String> {
    let user_id = state
        .session
        .require_user()
        .map_err(|e| e.to_string())?
        .id
        .to_string();

    state
        .production_service
        .create_order(data, &user_id)
        .map_err(|e| e.to_string())
}

/// Start production (consume MP via FIFO)
#[tauri::command]
pub fn start_production(
    state: State<AppState>,
    order_id: String,
) -> Result<ProductionOrderDto, String> {
    let user_id = state
        .session
        .require_user()
        .map_err(|e| e.to_string())?
        .id
        .to_string();

    state
        .production_service
        .start_production(&order_id, &user_id)
        .map_err(|e| e.to_string())
}

/// Complete production (create PF lot)
#[tauri::command]
pub fn complete_production(
    state: State<AppState>,
    order_id: String,
    data: CompleteProductionDto,
) -> Result<ProductionCompletionDto, String> {
    let user_id = state
        .session
        .require_user()
        .map_err(|e| e.to_string())?
        .id
        .to_string();

    state
        .production_service
        .complete_production(&order_id, data, &user_id)
        .map_err(|e| e.to_string())
}

/// Cancel production order
#[tauri::command]
pub fn cancel_production(
    state: State<AppState>,
    order_id: String,
    reason: Option<String>,
) -> Result<(), String> {
    state
        .production_service
        .cancel_production(&order_id, reason.as_deref())
        .map_err(|e| e.to_string())
}

// ============================================================================
// DASHBOARD & ANALYTICS COMMANDS
// ============================================================================

/// Get production dashboard
#[tauri::command]
pub fn get_production_dashboard(state: State<AppState>) -> Result<ProductionDashboardDto, String> {
    state
        .production_service
        .get_dashboard()
        .map_err(|e| e.to_string())
}

/// Get production calendar
#[tauri::command]
pub fn get_production_calendar(
    state: State<AppState>,
    from_date: String,
    to_date: String,
) -> Result<Vec<ProductionCalendarEntry>, String> {
    state
        .production_service
        .get_calendar(&from_date, &to_date)
        .map_err(|e| e.to_string())
}

/// Calculate production cost
#[tauri::command]
pub fn calculate_production_cost(
    state: State<AppState>,
    order_id: String,
) -> Result<ProductionCostDto, String> {
    state
        .production_service
        .calculate_cost(&order_id)
        .map_err(|e| e.to_string())
}
