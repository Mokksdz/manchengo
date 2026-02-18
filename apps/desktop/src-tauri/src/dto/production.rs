//! Production-related DTOs

use serde::{Deserialize, Serialize};

// ============================================================================
// RECIPE DTOs
// ============================================================================

/// Recipe DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeDto {
    pub id: String,
    pub name: String,
    pub code: String,
    pub product_pf_id: String,
    pub product_pf_name: String,
    pub product_pf_code: String,
    pub batch_weight: f64,
    pub output_quantity: f64,
    pub output_unit: String,
    pub loss_tolerance: f64,
    pub shelf_life_days: i32,
    pub is_active: bool,
    pub items: Vec<RecipeItemDto>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

/// Recipe item (ingredient)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeItemDto {
    pub id: String,
    pub item_type: RecipeItemType,
    pub product_mp_id: Option<String>,
    pub product_mp_name: Option<String>,
    pub product_mp_code: Option<String>,
    pub quantity: f64,
    pub unit: String,
    pub affects_stock: bool,
    pub is_mandatory: bool,
    pub sort_order: i32,
}

/// Recipe item type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RecipeItemType {
    Mp,
    Fluid,
    Packaging,
}

/// Create recipe request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRecipeDto {
    pub name: String,
    pub product_pf_id: String,
    pub batch_weight: f64,
    pub output_quantity: f64,
    pub loss_tolerance: Option<f64>,
    pub shelf_life_days: Option<i32>,
    pub items: Vec<CreateRecipeItemDto>,
}

/// Create recipe item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRecipeItemDto {
    #[serde(rename = "type")]
    pub item_type: String, // "MP", "FLUID", "PACKAGING"
    pub product_mp_id: Option<String>,
    pub quantity: f64,
    pub unit: String,
    pub affects_stock: Option<bool>,
    pub is_mandatory: Option<bool>,
    pub sort_order: Option<i32>,
}

/// Scaled recipe for production
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaledRecipeDto {
    pub recipe_id: String,
    pub recipe_name: String,
    pub product_pf_id: String,
    pub product_pf_name: String,
    pub batch_count: f64,
    pub target_output: f64,
    pub items: Vec<ScaledRecipeItemDto>,
}

/// Scaled recipe item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaledRecipeItemDto {
    pub product_mp_id: Option<String>,
    pub product_mp_name: Option<String>,
    pub quantity_per_batch: f64,
    pub total_quantity: f64,
    pub unit: String,
    pub current_stock: f64,
    pub is_available: bool,
    pub shortage: f64,
}

/// Check availability response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailabilityDto {
    pub can_start: bool,
    pub items: Vec<AvailabilityItemDto>,
    pub blockers: Vec<String>,
}

/// Availability item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailabilityItemDto {
    pub product_mp_id: String,
    pub product_mp_name: String,
    pub required: f64,
    pub available: f64,
    pub unit: String,
    pub is_available: bool,
    pub shortage: f64,
}

// ============================================================================
// PRODUCTION ORDER DTOs
// ============================================================================

/// Production order DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionOrderDto {
    pub id: String,
    pub reference: String,
    pub product_pf_id: String,
    pub product_pf_name: String,
    pub product_pf_code: String,
    pub recipe_id: String,
    pub recipe_name: String,
    pub batch_count: i32,
    pub target_quantity: f64,
    pub actual_quantity: Option<f64>,
    pub status: ProductionStatus,
    pub scheduled_date: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub notes: Option<String>,
    pub yield_percentage: Option<f64>,
    pub consumptions: Vec<ProductionConsumptionDto>,
    pub lot_pf_id: Option<String>,
    pub lot_pf_number: Option<String>,
    pub created_at: String,
    pub created_by: String,
    pub qr_code: Option<String>,
}

/// Production status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProductionStatus {
    Pending,
    InProgress,
    Completed,
    Cancelled,
}

impl From<&str> for ProductionStatus {
    fn from(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "PENDING" => ProductionStatus::Pending,
            "IN_PROGRESS" => ProductionStatus::InProgress,
            "COMPLETED" => ProductionStatus::Completed,
            "CANCELLED" => ProductionStatus::Cancelled,
            _ => ProductionStatus::Pending,
        }
    }
}

/// Production consumption (MP used)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionConsumptionDto {
    pub id: String,
    pub product_mp_id: String,
    pub product_mp_name: String,
    pub lot_mp_id: String,
    pub lot_mp_number: String,
    pub quantity: f64,
    pub unit: String,
    pub consumed_at: String,
}

/// Create production order request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProductionOrderDto {
    pub product_pf_id: String,
    pub batch_count: i32,
    pub scheduled_date: Option<String>,
    pub notes: Option<String>,
}

/// Complete production request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteProductionDto {
    pub quantity_produced: f64,
    pub batch_weight_real: Option<f64>,
    pub quality_notes: Option<String>,
    pub quality_status: Option<String>,
}

/// Production completion result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionCompletionDto {
    pub order_id: String,
    pub lot_pf_id: String,
    pub lot_pf_number: String,
    pub quantity_produced: f64,
    pub yield_percentage: f64,
    pub consumptions_count: i32,
    pub completed_at: String,
}

/// Production cost breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionCostDto {
    pub order_id: String,
    pub mp_cost: i64, // In centimes
    pub mp_breakdown: Vec<MpCostItem>,
    pub overhead_cost: i64,
    pub total_cost: i64,
    pub cost_per_unit: i64,
    pub quantity_produced: f64,
}

/// MP cost item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MpCostItem {
    pub product_mp_id: String,
    pub product_mp_name: String,
    pub quantity: f64,
    pub unit: String,
    pub unit_cost: i64,
    pub total_cost: i64,
}

// ============================================================================
// DASHBOARD DTOs
// ============================================================================

/// Production dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionDashboardDto {
    pub kpis: ProductionKpisDto,
    pub active_orders: Vec<ProductionOrderDto>,
    pub blocked_orders: Vec<BlockedOrderDto>,
    pub today_schedule: Vec<ProductionOrderDto>,
    pub stock_pf_summary: Vec<StockPfSummaryDto>,
}

/// Production KPIs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionKpisDto {
    pub today_completed: i32,
    pub today_target: i32,
    pub week_completed: i32,
    pub week_target: i32,
    pub month_completed: i32,
    pub avg_yield: f64,
    pub active_orders: i32,
    pub pending_orders: i32,
}

/// Blocked order (can't start due to stock)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockedOrderDto {
    pub order_id: String,
    pub reference: String,
    pub product_pf_name: String,
    pub blockers: Vec<String>,
}

/// Stock PF summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockPfSummaryDto {
    pub product_id: String,
    pub product_name: String,
    pub current_stock: f64,
    pub min_stock: f64,
    pub status: String,
}

/// Production calendar entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionCalendarEntry {
    pub date: String,
    pub orders: Vec<CalendarOrderDto>,
    pub total_batches: i32,
}

/// Calendar order summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarOrderDto {
    pub order_id: String,
    pub reference: String,
    pub product_name: String,
    pub batch_count: i32,
    pub status: ProductionStatus,
}

// ============================================================================
// FILTER DTOs
// ============================================================================

/// Production order filter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProductionOrderFilter {
    pub status: Option<String>,
    pub product_pf_id: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub limit: Option<u32>,
}

/// Recipe filter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RecipeFilter {
    pub product_pf_id: Option<String>,
    pub active_only: Option<bool>,
    pub search: Option<String>,
}
