//! Invoice API Commands
//!
//! Tauri commands for invoice and payment management.

use tauri::State;
use uuid::Uuid;

use crate::dto::invoice::*;
use crate::state::AppState;

/// Validate that a string is a valid UUID
fn validate_uuid(id: &str) -> Result<(), String> {
    Uuid::parse_str(id).map_err(|_| format!("Invalid UUID: {}", id))?;
    Ok(())
}

// ============================================================================
// INVOICE COMMANDS
// ============================================================================

/// List invoices
#[tauri::command]
pub fn list_invoices(
    state: State<AppState>,
    filter: Option<InvoiceFilter>,
) -> Result<Vec<InvoiceDto>, String> {
    state
        .invoice_service
        .list_invoices(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Get single invoice
#[tauri::command]
pub fn get_invoice(state: State<AppState>, id: String) -> Result<Option<InvoiceDto>, String> {
    validate_uuid(&id)?;
    state
        .invoice_service
        .get_invoice(&id)
        .map_err(|e| e.to_string())
}

/// Create new invoice
#[tauri::command]
pub fn create_invoice(state: State<AppState>, data: CreateInvoiceDto) -> Result<InvoiceDto, String> {
    state
        .invoice_service
        .create_invoice(data)
        .map_err(|e| e.to_string())
}

/// Validate invoice (DRAFT -> VALIDATED)
#[tauri::command]
pub fn validate_invoice(state: State<AppState>, id: String) -> Result<InvoiceDto, String> {
    validate_uuid(&id)?;
    state
        .invoice_service
        .validate_invoice(&id)
        .map_err(|e| e.to_string())
}

/// Void invoice (annulation)
#[tauri::command]
pub fn void_invoice(
    state: State<AppState>,
    id: String,
    reason: Option<String>,
) -> Result<(), String> {
    validate_uuid(&id)?;
    state
        .invoice_service
        .void_invoice(&id, reason.as_deref())
        .map_err(|e| e.to_string())
}

/// Calculate invoice totals
#[tauri::command]
pub fn calculate_invoice_totals(
    state: State<AppState>,
    lines: Vec<CreateInvoiceLineDto>,
) -> Result<InvoiceTotalsDto, String> {
    state
        .invoice_service
        .calculate_totals(&lines)
        .map_err(|e| e.to_string())
}

/// Calculate timbre fiscal
#[tauri::command]
pub fn calculate_timbre_fiscal(
    state: State<AppState>,
    total_ttc: i64,
) -> Result<TimbreFiscalDto, String> {
    Ok(state.invoice_service.get_timbre_fiscal(total_ttc))
}

// ============================================================================
// PAYMENT COMMANDS
// ============================================================================

/// List payments
#[tauri::command]
pub fn list_payments(
    state: State<AppState>,
    filter: Option<PaymentFilter>,
) -> Result<Vec<PaymentDto>, String> {
    state
        .invoice_service
        .list_payments(filter.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Create payment
#[tauri::command]
pub fn create_payment(state: State<AppState>, data: CreatePaymentDto) -> Result<PaymentDto, String> {
    state
        .invoice_service
        .create_payment(data)
        .map_err(|e| e.to_string())
}

/// Get outstanding invoices for client
#[tauri::command]
pub fn get_outstanding_invoices(
    state: State<AppState>,
    client_id: String,
) -> Result<Vec<InvoiceDto>, String> {
    validate_uuid(&client_id)?;
    state
        .invoice_service
        .get_outstanding_invoices(&client_id)
        .map_err(|e| e.to_string())
}
