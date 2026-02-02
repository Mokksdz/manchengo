//! Stock movement tracking

use chrono::{DateTime, Utc};
use manchengo_core::{EntityId, UnitOfMeasure};
use serde::{Deserialize, Serialize};

/// Type of stock movement
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MovementType {
    // Entries
    Reception,
    ProductionOutput,
    ReturnFromClient,
    AdjustmentPlus,
    TransferIn,

    // Exits
    ProductionConsumption,
    Delivery,
    Loss,
    AdjustmentMinus,
    TransferOut,
    Expiry,
}

impl MovementType {
    pub fn is_entry(&self) -> bool {
        matches!(
            self,
            Self::Reception
                | Self::ProductionOutput
                | Self::ReturnFromClient
                | Self::AdjustmentPlus
                | Self::TransferIn
        )
    }

    pub fn is_exit(&self) -> bool {
        !self.is_entry()
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Reception => "RECEPTION",
            Self::ProductionOutput => "PRODUCTION_OUTPUT",
            Self::ReturnFromClient => "RETURN_FROM_CLIENT",
            Self::AdjustmentPlus => "ADJUSTMENT_PLUS",
            Self::TransferIn => "TRANSFER_IN",
            Self::ProductionConsumption => "PRODUCTION_CONSUMPTION",
            Self::Delivery => "DELIVERY",
            Self::Loss => "LOSS",
            Self::AdjustmentMinus => "ADJUSTMENT_MINUS",
            Self::TransferOut => "TRANSFER_OUT",
            Self::Expiry => "EXPIRY",
        }
    }
}

/// Product type for movements
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProductType {
    Mp, // Raw material
    Pf, // Finished product
}

/// Reference type for movement source
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReferenceType {
    Reception,
    ProductionOrder,
    SalesOrder,
    Delivery,
    Adjustment,
    Transfer,
}

/// Stock movement record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMovement {
    pub id: EntityId,
    pub product_type: ProductType,
    pub product_id: EntityId,
    pub lot_id: EntityId,
    pub movement_type: MovementType,
    pub quantity: f64, // Positive for entries, negative for exits
    pub unit: UnitOfMeasure,
    pub reference_type: Option<ReferenceType>,
    pub reference_id: Option<EntityId>,
    pub quantity_before: f64,
    pub quantity_after: f64,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub created_by: EntityId,
}

impl StockMovement {
    /// Create a new stock entry movement
    pub fn entry(
        product_type: ProductType,
        product_id: EntityId,
        lot_id: EntityId,
        movement_type: MovementType,
        quantity: f64,
        unit: UnitOfMeasure,
        quantity_before: f64,
        user_id: EntityId,
    ) -> Self {
        debug_assert!(movement_type.is_entry());
        debug_assert!(quantity > 0.0);

        Self {
            id: EntityId::new(),
            product_type,
            product_id,
            lot_id,
            movement_type,
            quantity,
            unit,
            reference_type: None,
            reference_id: None,
            quantity_before,
            quantity_after: quantity_before + quantity,
            notes: None,
            created_at: Utc::now(),
            created_by: user_id,
        }
    }

    /// Create a new stock exit movement
    pub fn exit(
        product_type: ProductType,
        product_id: EntityId,
        lot_id: EntityId,
        movement_type: MovementType,
        quantity: f64,
        unit: UnitOfMeasure,
        quantity_before: f64,
        user_id: EntityId,
    ) -> Self {
        debug_assert!(movement_type.is_exit());
        debug_assert!(quantity > 0.0);

        Self {
            id: EntityId::new(),
            product_type,
            product_id,
            lot_id,
            movement_type,
            quantity: -quantity, // Negative for exits
            unit,
            reference_type: None,
            reference_id: None,
            quantity_before,
            quantity_after: quantity_before - quantity,
            notes: None,
            created_at: Utc::now(),
            created_by: user_id,
        }
    }

    /// Set reference document
    pub fn with_reference(mut self, ref_type: ReferenceType, ref_id: EntityId) -> Self {
        self.reference_type = Some(ref_type);
        self.reference_id = Some(ref_id);
        self
    }

    /// Set notes
    pub fn with_notes(mut self, notes: String) -> Self {
        self.notes = Some(notes);
        self
    }
}

/// Stock summary for a product
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockSummary {
    pub product_id: EntityId,
    pub product_type: ProductType,
    pub total_quantity: f64,
    pub available_quantity: f64,
    pub reserved_quantity: f64,
    pub blocked_quantity: f64,
    pub lot_count: i32,
    pub unit: UnitOfMeasure,
}

/// Stock alert levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StockAlertLevel {
    Normal,
    Low,       // Below reorder point
    Critical,  // Below minimum
    OutOfStock,
    Overstock,
}
