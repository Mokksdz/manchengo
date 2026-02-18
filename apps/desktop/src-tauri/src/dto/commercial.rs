//! Commercial-related DTOs (Clients, Price Lists)

use serde::{Deserialize, Serialize};

// ============================================================================
// CLIENT DTOs
// ============================================================================

/// Client DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientDto {
    pub id: String,
    pub code: String,
    pub name: String,
    pub company_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub wilaya: Option<String>,
    pub client_type: Option<String>,
    pub nif: Option<String>,
    pub rc: Option<String>,
    pub ai: Option<String>,
    pub is_active: bool,
    pub credit_limit: i64,
    pub current_balance: i64,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

/// Create client request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateClientDto {
    pub name: String,
    pub company_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub wilaya: Option<String>,
    pub client_type: Option<String>,
    pub nif: Option<String>,
    pub rc: Option<String>,
    pub ai: Option<String>,
    pub credit_limit: Option<i64>,
    pub notes: Option<String>,
}

/// Client filter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClientFilter {
    pub active_only: Option<bool>,
    pub client_type: Option<String>,
    pub wilaya: Option<String>,
    pub search: Option<String>,
    pub limit: Option<u32>,
}

/// Client balance DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientBalanceDto {
    pub client_id: String,
    pub client_name: String,
    pub current_balance: i64,
    pub credit_limit: i64,
    pub available_credit: i64,
    pub outstanding_invoices: i32,
    pub overdue_invoices: i32,
}

/// Client history item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientHistoryItemDto {
    pub date: String,
    pub item_type: String, // "INVOICE", "PAYMENT", "ORDER"
    pub reference: String,
    pub description: String,
    pub amount: i64,
    pub balance_after: i64,
}

// ============================================================================
// PRICE LIST DTOs
// ============================================================================

/// Price list DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceListDto {
    pub id: String,
    pub name: String,
    pub code: String,
    pub is_default: bool,
    pub discount_percentage: f64,
    pub is_active: bool,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub items: Vec<PriceListItemDto>,
    pub created_at: String,
}

/// Price list item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceListItemDto {
    pub id: String,
    pub product_pf_id: String,
    pub product_pf_name: String,
    pub product_pf_code: String,
    pub base_price: i64,
    pub list_price: i64,
}

/// Client price DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientPriceDto {
    pub product_pf_id: String,
    pub product_pf_name: String,
    pub product_pf_code: String,
    pub base_price: i64,
    pub client_price: i64,
    pub discount_percentage: f64,
    pub price_list_name: Option<String>,
}
