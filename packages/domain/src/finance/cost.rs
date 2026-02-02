//! Cost tracking and calculation

use chrono::NaiveDate;
use manchengo_core::{EntityId, Money};
use serde::{Deserialize, Serialize};

/// Cost type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CostType {
    Mp,          // Raw material
    Production,  // Production overhead
    Transport,   // Delivery/logistics
    Other,
}

impl CostType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Mp => "MP",
            Self::Production => "PRODUCTION",
            Self::Transport => "TRANSPORT",
            Self::Other => "OTHER",
        }
    }
}

/// Reference type for cost association
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CostReferenceType {
    ProductionOrder,
    Delivery,
    Lot,
}

/// Cost entry for tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostEntry {
    pub id: EntityId,
    pub cost_type: CostType,
    pub reference_type: Option<CostReferenceType>,
    pub reference_id: Option<EntityId>,
    pub description: String,
    pub amount: Money,
    pub cost_date: NaiveDate,
    pub created_by: EntityId,
}

impl CostEntry {
    pub fn new(
        cost_type: CostType,
        description: String,
        amount: Money,
        cost_date: NaiveDate,
        user_id: EntityId,
    ) -> Self {
        Self {
            id: EntityId::new(),
            cost_type,
            reference_type: None,
            reference_id: None,
            description,
            amount,
            cost_date,
            created_by: user_id,
        }
    }

    pub fn with_reference(mut self, ref_type: CostReferenceType, ref_id: EntityId) -> Self {
        self.reference_type = Some(ref_type);
        self.reference_id = Some(ref_id);
        self
    }
}

/// Cost of goods calculation for finished products
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostOfGoods {
    pub product_pf_id: EntityId,
    pub lot_pf_id: EntityId,
    pub production_order_id: EntityId,

    // Cost breakdown
    pub mp_cost: Money,           // Raw materials
    pub production_cost: Money,   // Production overhead
    pub total_cost: Money,
    pub quantity: f64,
    pub unit_cost: Money,

    // For margin calculation
    pub selling_price: Option<Money>,
    pub margin: Option<f64>,
}

impl CostOfGoods {
    pub fn calculate(
        product_pf_id: EntityId,
        lot_pf_id: EntityId,
        production_order_id: EntityId,
        mp_cost: Money,
        production_cost: Money,
        quantity: f64,
    ) -> Self {
        let total_cost = mp_cost + production_cost;
        let unit_cost = Money::from_centimes((total_cost.centimes() as f64 / quantity) as i64);

        Self {
            product_pf_id,
            lot_pf_id,
            production_order_id,
            mp_cost,
            production_cost,
            total_cost,
            quantity,
            unit_cost,
            selling_price: None,
            margin: None,
        }
    }

    pub fn set_selling_price(&mut self, price: Money) {
        self.selling_price = Some(price);
        if price.centimes() > 0 {
            self.margin = Some(
                ((price.centimes() - self.unit_cost.centimes()) as f64)
                    / (price.centimes() as f64)
                    * 100.0,
            );
        }
    }
}
