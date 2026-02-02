//! Production order management

use chrono::{DateTime, NaiveDate, Utc};
use manchengo_core::{AuditInfo, EntityId, Error, Money, QrCodeData, QrEntityType, Result, UnitOfMeasure};
use serde::{Deserialize, Serialize};

/// Production order status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProductionOrderStatus {
    Draft,
    Confirmed,
    InProgress,
    Completed,
    Cancelled,
}

impl ProductionOrderStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "DRAFT",
            Self::Confirmed => "CONFIRMED",
            Self::InProgress => "IN_PROGRESS",
            Self::Completed => "COMPLETED",
            Self::Cancelled => "CANCELLED",
        }
    }

    pub fn can_transition_to(&self, target: Self) -> bool {
        match (self, target) {
            (Self::Draft, Self::Confirmed) => true,
            (Self::Draft, Self::Cancelled) => true,
            (Self::Confirmed, Self::InProgress) => true,
            (Self::Confirmed, Self::Cancelled) => true,
            (Self::InProgress, Self::Completed) => true,
            _ => false,
        }
    }
}

/// Production order (Ordre de fabrication)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionOrder {
    pub id: EntityId,
    pub order_number: String,
    pub recipe_id: EntityId,
    pub product_pf_id: EntityId,

    // Quantities
    pub planned_quantity: f64,
    pub actual_quantity: Option<f64>,
    pub unit: UnitOfMeasure,

    // Dates
    pub planned_date: NaiveDate,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,

    // Status
    pub status: ProductionOrderStatus,

    // Cost tracking
    pub total_mp_cost: Money,
    pub additional_costs: Money,
    pub total_cost: Money,

    // Consumptions
    pub consumptions: Vec<ProductionConsumption>,

    // QR
    pub qr_code: String,

    // Metadata
    pub notes: Option<String>,
    pub audit: AuditInfo,
}

/// MP consumption in a production order
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionConsumption {
    pub id: EntityId,
    pub production_order_id: EntityId,
    pub lot_mp_id: EntityId,
    pub product_mp_id: EntityId,
    pub quantity: f64,
    pub unit: UnitOfMeasure,
    pub unit_cost: Money,
    pub total_cost: Money,
    pub consumed_at: DateTime<Utc>,
    pub consumed_by: EntityId,
}

impl ProductionOrder {
    pub fn new(
        order_number: String,
        recipe_id: EntityId,
        product_pf_id: EntityId,
        planned_quantity: f64,
        unit: UnitOfMeasure,
        planned_date: NaiveDate,
        user_id: EntityId,
    ) -> Self {
        let id = EntityId::new();

        let qr_data = QrCodeData {
            entity_type: QrEntityType::Order,
            entity_id: id,
            reference: order_number.clone(),
            expiry_date: None,
            checksum: String::new(),
        };

        Self {
            id,
            order_number,
            recipe_id,
            product_pf_id,
            planned_quantity,
            actual_quantity: None,
            unit,
            planned_date,
            started_at: None,
            completed_at: None,
            status: ProductionOrderStatus::Draft,
            total_mp_cost: Money::zero(),
            additional_costs: Money::zero(),
            total_cost: Money::zero(),
            consumptions: Vec::new(),
            qr_code: qr_data.encode(),
            notes: None,
            audit: AuditInfo::new(user_id),
        }
    }

    /// Confirm the production order
    pub fn confirm(&mut self, user_id: EntityId) -> Result<()> {
        if !self.status.can_transition_to(ProductionOrderStatus::Confirmed) {
            return Err(Error::InvalidStateTransition {
                entity: "ProductionOrder".to_string(),
                from: self.status.as_str().to_string(),
                to: "CONFIRMED".to_string(),
            });
        }

        self.status = ProductionOrderStatus::Confirmed;
        self.audit.update(user_id);
        Ok(())
    }

    /// Start production
    pub fn start(&mut self, user_id: EntityId) -> Result<()> {
        if !self.status.can_transition_to(ProductionOrderStatus::InProgress) {
            return Err(Error::InvalidStateTransition {
                entity: "ProductionOrder".to_string(),
                from: self.status.as_str().to_string(),
                to: "IN_PROGRESS".to_string(),
            });
        }

        self.status = ProductionOrderStatus::InProgress;
        self.started_at = Some(Utc::now());
        self.audit.update(user_id);
        Ok(())
    }

    /// Record MP consumption
    pub fn record_consumption(
        &mut self,
        lot_mp_id: EntityId,
        product_mp_id: EntityId,
        quantity: f64,
        unit: UnitOfMeasure,
        unit_cost: Money,
        user_id: EntityId,
    ) -> Result<()> {
        if self.status != ProductionOrderStatus::InProgress {
            return Err(Error::BusinessRule(
                "Can only consume MP when production is in progress".to_string(),
            ));
        }

        let total_cost = Money::from_centimes((quantity * unit_cost.centimes() as f64) as i64);

        self.consumptions.push(ProductionConsumption {
            id: EntityId::new(),
            production_order_id: self.id,
            lot_mp_id,
            product_mp_id,
            quantity,
            unit,
            unit_cost,
            total_cost,
            consumed_at: Utc::now(),
            consumed_by: user_id,
        });

        self.total_mp_cost = self.total_mp_cost + total_cost;
        self.recalculate_total_cost();
        self.audit.update(user_id);

        Ok(())
    }

    /// Complete production with output quantity
    pub fn complete(&mut self, actual_quantity: f64, user_id: EntityId) -> Result<()> {
        if !self.status.can_transition_to(ProductionOrderStatus::Completed) {
            return Err(Error::InvalidStateTransition {
                entity: "ProductionOrder".to_string(),
                from: self.status.as_str().to_string(),
                to: "COMPLETED".to_string(),
            });
        }

        if actual_quantity <= 0.0 {
            return Err(Error::Validation {
                field: "actual_quantity".to_string(),
                message: "Output quantity must be positive".to_string(),
            });
        }

        self.actual_quantity = Some(actual_quantity);
        self.status = ProductionOrderStatus::Completed;
        self.completed_at = Some(Utc::now());
        self.recalculate_total_cost();
        self.audit.update(user_id);

        Ok(())
    }

    /// Cancel order
    pub fn cancel(&mut self, user_id: EntityId) -> Result<()> {
        if !self.status.can_transition_to(ProductionOrderStatus::Cancelled) {
            return Err(Error::InvalidStateTransition {
                entity: "ProductionOrder".to_string(),
                from: self.status.as_str().to_string(),
                to: "CANCELLED".to_string(),
            });
        }

        if !self.consumptions.is_empty() {
            return Err(Error::BusinessRule(
                "Cannot cancel order with recorded consumptions".to_string(),
            ));
        }

        self.status = ProductionOrderStatus::Cancelled;
        self.audit.update(user_id);
        Ok(())
    }

    /// Calculate unit cost of finished product
    pub fn unit_cost(&self) -> Option<Money> {
        self.actual_quantity.map(|qty| {
            Money::from_centimes((self.total_cost.centimes() as f64 / qty) as i64)
        })
    }

    fn recalculate_total_cost(&mut self) {
        self.total_cost = self.total_mp_cost + self.additional_costs;
    }
}
