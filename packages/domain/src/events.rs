//! Domain events for event sourcing and sync

use chrono::{DateTime, Utc};
use manchengo_core::EntityId;
use serde::{Deserialize, Serialize};

/// Base trait for all domain events
pub trait DomainEvent: Serialize + for<'de> Deserialize<'de> {
    /// Event type name (e.g., "LotMpCreated")
    fn event_type(&self) -> &'static str;

    /// Aggregate type (e.g., "LotMp")
    fn aggregate_type(&self) -> &'static str;

    /// Aggregate ID
    fn aggregate_id(&self) -> EntityId;
}

/// Wrapper for storing events with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope {
    pub id: EntityId,
    pub aggregate_type: String,
    pub aggregate_id: EntityId,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub occurred_at: DateTime<Utc>,
    pub user_id: EntityId,
    pub device_id: EntityId,
    pub version: i64,
    pub synced: bool,
}

impl EventEnvelope {
    pub fn new<E: DomainEvent>(
        event: &E,
        user_id: EntityId,
        device_id: EntityId,
        version: i64,
    ) -> Result<Self, serde_json::Error> {
        Ok(Self {
            id: EntityId::new(),
            aggregate_type: event.aggregate_type().to_string(),
            aggregate_id: event.aggregate_id(),
            event_type: event.event_type().to_string(),
            payload: serde_json::to_value(event)?,
            occurred_at: Utc::now(),
            user_id,
            device_id,
            version,
            synced: false,
        })
    }
}

// ============================================================================
// STOCK EVENTS
// ============================================================================

pub mod stock {
    use super::*;
    use crate::stock::{LotMp, LotPf, LotStatus};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct LotMpCreated {
        pub lot_id: EntityId,
        pub lot_number: String,
        pub product_id: EntityId,
        pub supplier_id: Option<EntityId>,
        pub quantity: f64,
        pub unit_cost_centimes: i64,
        pub reception_date: String,
        pub expiry_date: Option<String>,
    }

    impl DomainEvent for LotMpCreated {
        fn event_type(&self) -> &'static str { "LotMpCreated" }
        fn aggregate_type(&self) -> &'static str { "LotMp" }
        fn aggregate_id(&self) -> EntityId { self.lot_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct LotMpQuantityReduced {
        pub lot_id: EntityId,
        pub quantity_before: f64,
        pub quantity_after: f64,
        pub reason: String,
        pub reference_type: Option<String>,
        pub reference_id: Option<EntityId>,
    }

    impl DomainEvent for LotMpQuantityReduced {
        fn event_type(&self) -> &'static str { "LotMpQuantityReduced" }
        fn aggregate_type(&self) -> &'static str { "LotMp" }
        fn aggregate_id(&self) -> EntityId { self.lot_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct LotMpStatusChanged {
        pub lot_id: EntityId,
        pub old_status: String,
        pub new_status: String,
        pub reason: Option<String>,
    }

    impl DomainEvent for LotMpStatusChanged {
        fn event_type(&self) -> &'static str { "LotMpStatusChanged" }
        fn aggregate_type(&self) -> &'static str { "LotMp" }
        fn aggregate_id(&self) -> EntityId { self.lot_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct LotPfCreated {
        pub lot_id: EntityId,
        pub lot_number: String,
        pub product_id: EntityId,
        pub production_order_id: Option<EntityId>,
        pub quantity: f64,
        pub unit_cost_centimes: i64,
        pub production_date: String,
        pub expiry_date: Option<String>,
    }

    impl DomainEvent for LotPfCreated {
        fn event_type(&self) -> &'static str { "LotPfCreated" }
        fn aggregate_type(&self) -> &'static str { "LotPf" }
        fn aggregate_id(&self) -> EntityId { self.lot_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct LotPfQuantityReduced {
        pub lot_id: EntityId,
        pub quantity_before: f64,
        pub quantity_after: f64,
        pub reason: String,
        pub reference_type: Option<String>,
        pub reference_id: Option<EntityId>,
    }

    impl DomainEvent for LotPfQuantityReduced {
        fn event_type(&self) -> &'static str { "LotPfQuantityReduced" }
        fn aggregate_type(&self) -> &'static str { "LotPf" }
        fn aggregate_id(&self) -> EntityId { self.lot_id }
    }
}

// ============================================================================
// PRODUCTION EVENTS
// ============================================================================

pub mod production {
    use super::*;

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ProductionOrderCreated {
        pub order_id: EntityId,
        pub order_number: String,
        pub recipe_id: EntityId,
        pub product_pf_id: EntityId,
        pub planned_quantity: f64,
        pub planned_date: String,
    }

    impl DomainEvent for ProductionOrderCreated {
        fn event_type(&self) -> &'static str { "ProductionOrderCreated" }
        fn aggregate_type(&self) -> &'static str { "ProductionOrder" }
        fn aggregate_id(&self) -> EntityId { self.order_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ProductionOrderConfirmed {
        pub order_id: EntityId,
    }

    impl DomainEvent for ProductionOrderConfirmed {
        fn event_type(&self) -> &'static str { "ProductionOrderConfirmed" }
        fn aggregate_type(&self) -> &'static str { "ProductionOrder" }
        fn aggregate_id(&self) -> EntityId { self.order_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ProductionOrderStarted {
        pub order_id: EntityId,
        pub started_at: String,
    }

    impl DomainEvent for ProductionOrderStarted {
        fn event_type(&self) -> &'static str { "ProductionOrderStarted" }
        fn aggregate_type(&self) -> &'static str { "ProductionOrder" }
        fn aggregate_id(&self) -> EntityId { self.order_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ProductionMpConsumed {
        pub order_id: EntityId,
        pub lot_mp_id: EntityId,
        pub product_mp_id: EntityId,
        pub quantity: f64,
        pub unit_cost_centimes: i64,
    }

    impl DomainEvent for ProductionMpConsumed {
        fn event_type(&self) -> &'static str { "ProductionMpConsumed" }
        fn aggregate_type(&self) -> &'static str { "ProductionOrder" }
        fn aggregate_id(&self) -> EntityId { self.order_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ProductionOrderCompleted {
        pub order_id: EntityId,
        pub actual_quantity: f64,
        pub lot_pf_id: EntityId,
        pub total_cost_centimes: i64,
        pub completed_at: String,
    }

    impl DomainEvent for ProductionOrderCompleted {
        fn event_type(&self) -> &'static str { "ProductionOrderCompleted" }
        fn aggregate_type(&self) -> &'static str { "ProductionOrder" }
        fn aggregate_id(&self) -> EntityId { self.order_id }
    }
}

// ============================================================================
// COMMERCIAL EVENTS
// ============================================================================

pub mod commercial {
    use super::*;

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct SalesOrderCreated {
        pub order_id: EntityId,
        pub order_number: String,
        pub client_id: EntityId,
        pub order_date: String,
        pub total_ht_centimes: i64,
        pub total_ttc_centimes: i64,
    }

    impl DomainEvent for SalesOrderCreated {
        fn event_type(&self) -> &'static str { "SalesOrderCreated" }
        fn aggregate_type(&self) -> &'static str { "SalesOrder" }
        fn aggregate_id(&self) -> EntityId { self.order_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct SalesOrderConfirmed {
        pub order_id: EntityId,
    }

    impl DomainEvent for SalesOrderConfirmed {
        fn event_type(&self) -> &'static str { "SalesOrderConfirmed" }
        fn aggregate_type(&self) -> &'static str { "SalesOrder" }
        fn aggregate_id(&self) -> EntityId { self.order_id }
    }
}

// ============================================================================
// DELIVERY EVENTS
// ============================================================================

pub mod delivery {
    use super::*;

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct DeliveryCreated {
        pub delivery_id: EntityId,
        pub delivery_number: String,
        pub planned_date: String,
    }

    impl DomainEvent for DeliveryCreated {
        fn event_type(&self) -> &'static str { "DeliveryCreated" }
        fn aggregate_type(&self) -> &'static str { "Delivery" }
        fn aggregate_id(&self) -> EntityId { self.delivery_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct DeliveryLoaded {
        pub delivery_id: EntityId,
        pub loaded_at: String,
    }

    impl DomainEvent for DeliveryLoaded {
        fn event_type(&self) -> &'static str { "DeliveryLoaded" }
        fn aggregate_type(&self) -> &'static str { "Delivery" }
        fn aggregate_id(&self) -> EntityId { self.delivery_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct DeliveryItemScanned {
        pub delivery_id: EntityId,
        pub lot_pf_id: EntityId,
        pub quantity: f64,
        pub scanned_at: String,
    }

    impl DomainEvent for DeliveryItemScanned {
        fn event_type(&self) -> &'static str { "DeliveryItemScanned" }
        fn aggregate_type(&self) -> &'static str { "Delivery" }
        fn aggregate_id(&self) -> EntityId { self.delivery_id }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct DeliveryCompleted {
        pub delivery_id: EntityId,
        pub client_id: EntityId,
        pub delivered_at: String,
        pub signature_path: Option<String>,
        pub photo_path: Option<String>,
    }

    impl DomainEvent for DeliveryCompleted {
        fn event_type(&self) -> &'static str { "DeliveryCompleted" }
        fn aggregate_type(&self) -> &'static str { "Delivery" }
        fn aggregate_id(&self) -> EntityId { self.delivery_id }
    }
}

// ============================================================================
// FINANCE EVENTS
// ============================================================================

pub mod finance {
    use super::*;

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct PaymentReceived {
        pub payment_id: EntityId,
        pub client_id: EntityId,
        pub invoice_id: Option<EntityId>,
        pub amount_centimes: i64,
        pub payment_method: String,
        pub payment_date: String,
    }

    impl DomainEvent for PaymentReceived {
        fn event_type(&self) -> &'static str { "PaymentReceived" }
        fn aggregate_type(&self) -> &'static str { "Payment" }
        fn aggregate_id(&self) -> EntityId { self.payment_id }
    }
}
