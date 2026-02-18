//! Stock-related DTOs

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

// ============================================================================
// PRODUCT DTOs
// ============================================================================

/// Product MP (Matiere Premiere) DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductMpDto {
    pub id: String,
    pub code: String,
    pub name: String,
    pub unit: String,
    pub category: Option<String>,
    pub min_stock: f64,
    pub reorder_point: f64,
    pub is_perishable: bool,
    pub shelf_life_days: Option<i32>,
    pub is_active: bool,
    pub current_stock: f64,
    pub stock_status: StockStatus,
}

/// Product PF (Produit Fini) DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductPfDto {
    pub id: String,
    pub code: String,
    pub name: String,
    pub unit: String,
    pub category: Option<String>,
    pub min_stock: f64,
    pub weight_kg: Option<f64>,
    pub price_ht: i64, // In centimes
    pub tva_rate: f64,
    pub is_active: bool,
    pub current_stock: f64,
    pub stock_status: StockStatus,
}

/// Stock status enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StockStatus {
    Ok,
    Low,
    Critical,
    Rupture,
}

impl StockStatus {
    pub fn from_levels(current: f64, min_stock: f64, reorder_point: f64) -> Self {
        if current <= 0.0 {
            StockStatus::Rupture
        } else if current < min_stock {
            StockStatus::Critical
        } else if current < reorder_point {
            StockStatus::Low
        } else {
            StockStatus::Ok
        }
    }
}

// ============================================================================
// LOT DTOs
// ============================================================================

/// Lot MP DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LotMpDto {
    pub id: String,
    pub lot_number: String,
    pub product_id: String,
    pub product_code: String,
    pub product_name: String,
    pub quantity_initial: f64,
    pub quantity_remaining: f64,
    pub unit: String,
    pub unit_cost: i64, // In centimes
    pub total_cost: i64,
    pub status: LotStatus,
    pub supplier_id: Option<String>,
    pub supplier_name: Option<String>,
    pub reception_date: String,
    pub expiry_date: Option<String>,
    pub is_expired: bool,
    pub days_until_expiry: Option<i32>,
    pub qr_code: Option<String>,
}

/// Lot PF DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LotPfDto {
    pub id: String,
    pub lot_number: String,
    pub product_id: String,
    pub product_code: String,
    pub product_name: String,
    pub quantity_initial: f64,
    pub quantity_remaining: f64,
    pub unit: String,
    pub status: LotStatus,
    pub production_order_id: Option<String>,
    pub production_date: String,
    pub expiry_date: Option<String>,
    pub is_expired: bool,
    pub days_until_expiry: Option<i32>,
    pub qr_code: Option<String>,
}

/// Lot status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LotStatus {
    Available,
    Reserved,
    Consumed,
    Expired,
    Blocked,
}

impl From<&str> for LotStatus {
    fn from(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "AVAILABLE" => LotStatus::Available,
            "RESERVED" => LotStatus::Reserved,
            "CONSUMED" => LotStatus::Consumed,
            "EXPIRED" => LotStatus::Expired,
            "BLOCKED" => LotStatus::Blocked,
            _ => LotStatus::Available,
        }
    }
}

/// Expiring lot alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpiringLotDto {
    pub lot_id: String,
    pub lot_number: String,
    pub product_id: String,
    pub product_name: String,
    pub product_type: String, // "MP" or "PF"
    pub quantity_remaining: f64,
    pub unit: String,
    pub expiry_date: String,
    pub days_until_expiry: i32,
    pub is_critical: bool, // Less than 7 days
}

// ============================================================================
// STOCK LEVEL DTOs
// ============================================================================

/// Stock level summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockLevelDto {
    pub product_id: String,
    pub product_code: String,
    pub product_name: String,
    pub unit: String,
    pub current_stock: f64,
    pub min_stock: f64,
    pub reorder_point: f64,
    pub status: StockStatus,
    pub last_movement_date: Option<String>,
    pub lots_count: u32,
}

/// Stock alerts summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockAlertsDto {
    pub ruptures: Vec<StockAlertDto>,
    pub critical: Vec<StockAlertDto>,
    pub low: Vec<StockAlertDto>,
    pub expiring_soon: Vec<ExpiringLotDto>,
    pub total_ruptures: u32,
    pub total_critical: u32,
    pub total_low: u32,
    pub total_expiring: u32,
}

/// Individual stock alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockAlertDto {
    pub product_id: String,
    pub product_code: String,
    pub product_name: String,
    pub product_type: String, // "MP" or "PF"
    pub current_stock: f64,
    pub min_stock: f64,
    pub deficit: f64,
    pub status: StockStatus,
}

// ============================================================================
// MOVEMENT DTOs
// ============================================================================

/// Stock movement DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MovementDto {
    pub id: String,
    pub movement_type: MovementType,
    pub product_type: String, // "MP" or "PF"
    pub product_id: String,
    pub product_code: String,
    pub product_name: String,
    pub lot_id: Option<String>,
    pub lot_number: Option<String>,
    pub quantity: f64,
    pub unit: String,
    pub unit_cost: Option<i64>,
    pub origin: MovementOrigin,
    pub reference_type: Option<String>,
    pub reference_id: Option<String>,
    pub user_id: String,
    pub user_name: Option<String>,
    pub created_at: String,
    pub note: Option<String>,
}

/// Movement type (IN or OUT)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MovementType {
    In,
    Out,
}

/// Movement origin
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MovementOrigin {
    Reception,
    ProductionIn,
    ProductionOut,
    ProductionCancel,
    Vente,
    Inventaire,
    Perte,
    RetourClient,
    Transfert,
    Expiry,
}

impl From<&str> for MovementOrigin {
    fn from(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "RECEPTION" => MovementOrigin::Reception,
            "PRODUCTION_IN" => MovementOrigin::ProductionIn,
            "PRODUCTION_OUT" => MovementOrigin::ProductionOut,
            "PRODUCTION_CANCEL" => MovementOrigin::ProductionCancel,
            "VENTE" => MovementOrigin::Vente,
            "INVENTAIRE" => MovementOrigin::Inventaire,
            "PERTE" => MovementOrigin::Perte,
            "RETOUR_CLIENT" => MovementOrigin::RetourClient,
            "TRANSFERT" => MovementOrigin::Transfert,
            "EXPIRY" => MovementOrigin::Expiry,
            _ => MovementOrigin::Inventaire,
        }
    }
}

// ============================================================================
// FIFO DTOs
// ============================================================================

/// FIFO consumption preview
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FifoPreviewDto {
    pub product_id: String,
    pub requested_quantity: f64,
    pub available_quantity: f64,
    pub can_fulfill: bool,
    pub lots: Vec<FifoLotPreview>,
    pub shortage: f64,
}

/// Single lot in FIFO preview
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FifoLotPreview {
    pub lot_id: String,
    pub lot_number: String,
    pub quantity_available: f64,
    pub quantity_to_consume: f64,
    pub expiry_date: Option<String>,
    pub reception_date: String,
}

/// FIFO consumption result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FifoResultDto {
    pub total_consumed: f64,
    pub consumptions: Vec<FifoConsumption>,
    pub movements_created: Vec<String>,
}

/// Single consumption in FIFO result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FifoConsumption {
    pub lot_id: String,
    pub lot_number: String,
    pub quantity_consumed: f64,
    pub lot_depleted: bool,
}

// ============================================================================
// RECEPTION DTOs
// ============================================================================

/// Create reception request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateReceptionDto {
    pub supplier_id: String,
    pub date: String, // ISO date
    pub bl_number: Option<String>,
    pub note: Option<String>,
    pub lines: Vec<ReceptionLineDto>,
}

/// Reception line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceptionLineDto {
    pub product_mp_id: String,
    pub quantity: f64,
    pub unit_cost: i64, // In centimes
    pub lot_number: Option<String>,
    pub expiry_date: Option<String>,
    pub tva_rate: Option<f64>,
}

/// Reception response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceptionDto {
    pub id: String,
    pub reference: String,
    pub supplier_id: String,
    pub supplier_name: String,
    pub date: String,
    pub bl_number: Option<String>,
    pub note: Option<String>,
    pub lines: Vec<ReceptionLineResponseDto>,
    pub total_ht: i64,
    pub total_tva: i64,
    pub total_ttc: i64,
    pub created_at: String,
    pub created_by: String,
}

/// Reception line response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceptionLineResponseDto {
    pub id: String,
    pub product_mp_id: String,
    pub product_code: String,
    pub product_name: String,
    pub quantity: f64,
    pub unit: String,
    pub unit_cost: i64,
    pub line_total: i64,
    pub tva_rate: f64,
    pub lot_id: String,
    pub lot_number: String,
    pub expiry_date: Option<String>,
}

// ============================================================================
// INVENTORY ADJUSTMENT DTOs
// ============================================================================

/// Adjust inventory request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdjustInventoryDto {
    pub product_type: String, // "MP" or "PF"
    pub product_id: String,
    pub physical_quantity: f64,
    pub reason: String,
}

/// Inventory adjustment result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryAdjustmentDto {
    pub id: String,
    pub product_id: String,
    pub product_name: String,
    pub previous_stock: f64,
    pub physical_stock: f64,
    pub difference: f64,
    pub movement_type: MovementType,
    pub reason: String,
    pub adjusted_at: String,
    pub adjusted_by: String,
}

// ============================================================================
// LOSS DECLARATION DTOs
// ============================================================================

/// Declare loss request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeclareLossDto {
    pub product_type: String, // "MP" or "PF"
    pub product_id: String,
    pub lot_id: Option<String>,
    pub quantity: f64,
    pub reason: String,
    pub description: Option<String>,
}

/// Loss declaration result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LossDeclarationDto {
    pub id: String,
    pub product_id: String,
    pub product_name: String,
    pub lot_id: Option<String>,
    pub lot_number: Option<String>,
    pub quantity: f64,
    pub reason: String,
    pub description: Option<String>,
    pub declared_at: String,
    pub declared_by: String,
}

// ============================================================================
// FILTER DTOs
// ============================================================================

/// Product filter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProductFilter {
    pub active_only: Option<bool>,
    pub category: Option<String>,
    pub search: Option<String>,
}

/// Lot filter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LotFilter {
    pub product_id: Option<String>,
    pub status: Option<String>,
    pub expiring_within_days: Option<i32>,
}

/// Movement filter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MovementFilter {
    pub product_type: Option<String>,
    pub product_id: Option<String>,
    pub movement_type: Option<String>,
    pub origin: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub limit: Option<u32>,
}
