//! Invoice-related DTOs

use serde::{Deserialize, Serialize};

// ============================================================================
// INVOICE DTOs
// ============================================================================

/// Invoice status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InvoiceStatus {
    Draft,
    Validated,
    Paid,
    Voided,
}

impl From<&str> for InvoiceStatus {
    fn from(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "DRAFT" => InvoiceStatus::Draft,
            "VALIDATED" => InvoiceStatus::Validated,
            "PAID" => InvoiceStatus::Paid,
            "VOIDED" => InvoiceStatus::Voided,
            _ => InvoiceStatus::Draft,
        }
    }
}

/// Invoice DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceDto {
    pub id: String,
    pub invoice_number: String,
    pub client_id: String,
    pub client_name: String,
    pub client_code: String,
    pub status: InvoiceStatus,
    pub total_ht: i64,
    pub total_tva: i64,
    pub total_ttc: i64,
    pub timbre_fiscal: i64,
    pub payment_method: Option<String>,
    pub payment_due_date: Option<String>,
    pub notes: Option<String>,
    pub lines: Vec<InvoiceLineDto>,
    pub created_at: String,
    pub validated_at: Option<String>,
    pub voided_at: Option<String>,
}

/// Invoice line DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLineDto {
    pub id: String,
    pub product_pf_id: String,
    pub product_pf_name: String,
    pub product_pf_code: String,
    pub quantity: i32,
    pub unit_price_ht: i64,
    pub line_total_ht: i64,
    pub line_total_tva: i64,
    pub line_total_ttc: i64,
}

/// Create invoice request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvoiceDto {
    pub client_id: String,
    pub payment_method: Option<String>,
    pub payment_due_date: Option<String>,
    pub notes: Option<String>,
    pub lines: Vec<CreateInvoiceLineDto>,
}

/// Create invoice line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvoiceLineDto {
    pub product_pf_id: String,
    pub quantity: i32,
    pub unit_price_ht: i64,
}

/// Invoice totals (calculated)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceTotalsDto {
    pub total_ht: i64,
    pub total_tva: i64,
    pub timbre_fiscal: i64,
    pub total_ttc: i64,
    pub lines: Vec<InvoiceLineTotalsDto>,
}

/// Invoice line totals
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLineTotalsDto {
    pub product_pf_id: String,
    pub quantity: i32,
    pub unit_price_ht: i64,
    pub line_ht: i64,
    pub line_tva: i64,
    pub line_ttc: i64,
}

/// Invoice filter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InvoiceFilter {
    pub status: Option<String>,
    pub client_id: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub limit: Option<u32>,
}

// ============================================================================
// PAYMENT DTOs
// ============================================================================

/// Payment DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentDto {
    pub id: String,
    pub invoice_id: String,
    pub invoice_number: String,
    pub client_id: String,
    pub client_name: String,
    pub amount: i64,
    pub payment_method: String,
    pub payment_date: String,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

/// Create payment request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePaymentDto {
    pub invoice_id: String,
    pub amount: i64,
    pub payment_method: String,
    pub payment_date: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
}

/// Payment filter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PaymentFilter {
    pub client_id: Option<String>,
    pub invoice_id: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub limit: Option<u32>,
}

// ============================================================================
// FISCAL DTOs
// ============================================================================

/// Timbre fiscal calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimbreFiscalDto {
    pub total_ttc: i64,
    pub timbre_amount: i64,
    pub final_total: i64,
    pub timbre_rate: f64,
    pub threshold: i64,
}
