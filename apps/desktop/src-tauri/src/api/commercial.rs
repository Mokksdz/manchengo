//! Commercial API Commands
//!
//! Tauri commands for client and pricing management.

use tauri::State;

use crate::dto::commercial::*;
use crate::state::AppState;

// ============================================================================
// CLIENT COMMANDS
// ============================================================================

/// List clients
#[tauri::command]
pub fn list_clients(
    state: State<AppState>,
    filter: Option<ClientFilter>,
) -> Result<Vec<ClientDto>, String> {
    state
        .commercial_service
        .list_clients(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Get single client
#[tauri::command]
pub fn get_client(state: State<AppState>, id: String) -> Result<Option<ClientDto>, String> {
    state
        .commercial_service
        .get_client(&id)
        .map_err(|e| e.to_string())
}

/// Create new client
#[tauri::command]
pub fn create_client(state: State<AppState>, data: CreateClientDto) -> Result<ClientDto, String> {
    state
        .commercial_service
        .create_client(data)
        .map_err(|e| e.to_string())
}

/// Update client
#[tauri::command]
pub fn update_client(
    state: State<AppState>,
    id: String,
    data: CreateClientDto,
) -> Result<ClientDto, String> {
    state
        .commercial_service
        .update_client(&id, data)
        .map_err(|e| e.to_string())
}

/// Delete client
#[tauri::command]
pub fn delete_client(state: State<AppState>, id: String) -> Result<(), String> {
    state
        .commercial_service
        .delete_client(&id)
        .map_err(|e| e.to_string())
}

/// Get client balance
#[tauri::command]
pub fn get_client_balance(
    state: State<AppState>,
    id: String,
) -> Result<ClientBalanceDto, String> {
    state
        .commercial_service
        .get_client_balance(&id)
        .map_err(|e| e.to_string())
}

/// Get client history
#[tauri::command]
pub fn get_client_history(
    state: State<AppState>,
    id: String,
    limit: Option<u32>,
) -> Result<Vec<ClientHistoryItemDto>, String> {
    state
        .commercial_service
        .get_client_history(&id, limit)
        .map_err(|e| e.to_string())
}

// ============================================================================
// PRICE LIST COMMANDS
// ============================================================================

/// List price lists
#[tauri::command]
pub fn list_price_lists(
    state: State<AppState>,
    active_only: Option<bool>,
) -> Result<Vec<PriceListDto>, String> {
    state
        .commercial_service
        .list_price_lists(active_only.unwrap_or(true))
        .map_err(|e| e.to_string())
}

/// Get client prices
#[tauri::command]
pub fn get_client_prices(
    state: State<AppState>,
    client_id: String,
) -> Result<Vec<ClientPriceDto>, String> {
    state
        .commercial_service
        .get_client_prices(&client_id)
        .map_err(|e| e.to_string())
}
