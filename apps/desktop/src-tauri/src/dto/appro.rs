//! Appro-related DTOs (Purchase Orders, Suppliers)

use serde::{Deserialize, Serialize};

// ============================================================================
// PURCHASE ORDER DTOs
// ============================================================================

/// Purchase order status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PurchaseOrderStatus {
    Draft,
    Confirmed,
    Sent,
    Received,
    Cancelled,
}

impl From<&str> for PurchaseOrderStatus {
    fn from(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "DRAFT" => PurchaseOrderStatus::Draft,
            "CONFIRMED" => PurchaseOrderStatus::Confirmed,
            "SENT" => PurchaseOrderStatus::Sent,
            "RECEIVED" => PurchaseOrderStatus::Received,
            "CANCELLED" => PurchaseOrderStatus::Cancelled,
            _ => PurchaseOrderStatus::Draft,
        }
    }
}

/// Purchase order DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrderDto {
    pub id: String,
    pub reference: String,
    pub supplier_id: String,
    pub supplier_name: String,
    pub supplier_code: String,
    pub status: PurchaseOrderStatus,
    pub expected_delivery: Option<String>,
    pub received_date: Option<String>,
    pub total_amount: i64,
    pub notes: Option<String>,
    pub lines: Vec<PurchaseOrderLineDto>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

/// Purchase order line DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrderLineDto {
    pub id: String,
    pub product_mp_id: String,
    pub product_mp_name: String,
    pub product_mp_code: String,
    pub quantity: i32,
    pub quantity_received: Option<i32>,
    pub unit_price: f64,
    pub line_total: i64,
}

/// Create purchase order request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePurchaseOrderDto {
    pub supplier_id: String,
    pub expected_delivery: Option<String>,
    pub notes: Option<String>,
    pub lines: Vec<CreatePurchaseOrderLineDto>,
}

/// Create purchase order line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePurchaseOrderLineDto {
    pub product_mp_id: String,
    pub quantity: i32,
    pub unit_price: f64,
}

/// Purchase order filter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PurchaseOrderFilter {
    pub status: Option<String>,
    pub supplier_id: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub limit: Option<u32>,
}

/// Receive purchase order request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceivePurchaseOrderDto {
    pub lines: Vec<ReceiveLineDto>,
}

/// Receive line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiveLineDto {
    pub line_id: String,
    pub quantity_received: i32,
    pub lot_number: Option<String>,
    pub expiry_date: Option<String>,
    pub unit_cost: Option<i64>,
}

// ============================================================================
// SUPPLIER PERFORMANCE DTOs
// ============================================================================

/// Supplier performance DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierPerformanceDto {
    pub supplier_id: String,
    pub supplier_name: String,
    pub total_orders: i32,
    pub total_amount: i64,
    pub on_time_deliveries: i32,
    pub late_deliveries: i32,
    pub on_time_rate: f64,
    pub avg_delivery_days: f64,
    pub quality_issues: i32,
}

// ============================================================================
// APPRO DASHBOARD DTOs
// ============================================================================

/// Appro dashboard DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApproDashboardDto {
    pub pending_orders: i32,
    pub orders_this_month: i32,
    pub total_spent_this_month: i64,
    pub recent_orders: Vec<PurchaseOrderDto>,
    pub low_stock_alerts: Vec<LowStockAlertDto>,
}

/// Low stock alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LowStockAlertDto {
    pub product_mp_id: String,
    pub product_mp_name: String,
    pub current_stock: f64,
    pub min_stock: f64,
    pub unit: String,
    pub suggested_quantity: f64,
}
