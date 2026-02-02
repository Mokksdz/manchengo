//! Finished product lot management

use chrono::{DateTime, NaiveDate, Utc};
use manchengo_core::{AuditInfo, EntityId, Error, Money, QrCodeData, QrEntityType, Result, UnitOfMeasure};
use serde::{Deserialize, Serialize};

use super::LotStatus;

/// Finished product lot (Lot Produit Fini)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LotPf {
    pub id: EntityId,
    pub lot_number: String,
    pub product_id: EntityId,
    pub production_order_id: Option<EntityId>,

    // Quantities
    pub quantity_initial: f64,
    pub quantity_remaining: f64,
    pub unit: UnitOfMeasure,

    // Dates
    pub production_date: NaiveDate,
    pub expiry_date: Option<NaiveDate>,

    // Cost (calculated from production)
    pub unit_cost: Money,
    pub total_cost: Money,

    // Status
    pub status: LotStatus,
    pub blocked_reason: Option<String>,

    // QR Code
    pub qr_code: String,

    // Metadata
    pub notes: Option<String>,
    pub audit: AuditInfo,
}

impl LotPf {
    /// Create a new finished product lot
    pub fn new(
        lot_number: String,
        product_id: EntityId,
        production_order_id: Option<EntityId>,
        quantity: f64,
        unit: UnitOfMeasure,
        unit_cost: Money,
        production_date: NaiveDate,
        user_id: EntityId,
    ) -> Self {
        let id = EntityId::new();
        let total_cost = Money::from_centimes((quantity * unit_cost.centimes() as f64) as i64);

        let qr_data = QrCodeData {
            entity_type: QrEntityType::LotPf,
            entity_id: id,
            reference: lot_number.clone(),
            expiry_date: None,
            checksum: String::new(),
        };

        Self {
            id,
            lot_number,
            product_id,
            production_order_id,
            quantity_initial: quantity,
            quantity_remaining: quantity,
            unit,
            production_date,
            expiry_date: None,
            unit_cost,
            total_cost,
            status: LotStatus::Available,
            blocked_reason: None,
            qr_code: qr_data.encode(),
            notes: None,
            audit: AuditInfo::new(user_id),
        }
    }

    /// Check if lot is expired
    pub fn is_expired(&self) -> bool {
        if let Some(expiry) = self.expiry_date {
            expiry < chrono::Utc::now().date_naive()
        } else {
            false
        }
    }

    /// Check if lot can be delivered
    pub fn can_deliver(&self, quantity: f64) -> bool {
        self.status.is_consumable()
            && !self.is_expired()
            && self.quantity_remaining >= quantity
    }

    /// Reserve quantity for delivery
    pub fn reserve(&mut self, quantity: f64, user_id: EntityId) -> Result<()> {
        if !self.can_deliver(quantity) {
            return Err(Error::InsufficientStock {
                product: self.lot_number.clone(),
                required: quantity,
                available: self.quantity_remaining,
            });
        }

        // Note: In a full implementation, we'd track reserved vs available separately
        self.status = LotStatus::Reserved;
        self.audit.update(user_id);
        Ok(())
    }

    /// Deliver quantity from lot
    pub fn deliver(&mut self, quantity: f64, user_id: EntityId) -> Result<f64> {
        if quantity > self.quantity_remaining {
            return Err(Error::InsufficientStock {
                product: self.lot_number.clone(),
                required: quantity,
                available: self.quantity_remaining,
            });
        }

        self.quantity_remaining -= quantity;
        self.audit.update(user_id);

        if self.quantity_remaining <= 0.0 {
            self.status = LotStatus::Consumed;
        } else {
            self.status = LotStatus::Available;
        }

        Ok(self.quantity_remaining)
    }

    /// Block lot
    pub fn block(&mut self, reason: String, user_id: EntityId) -> Result<()> {
        if self.status == LotStatus::Consumed {
            return Err(Error::InvalidStateTransition {
                entity: "LotPf".to_string(),
                from: "CONSUMED".to_string(),
                to: "BLOCKED".to_string(),
            });
        }

        self.status = LotStatus::Blocked;
        self.blocked_reason = Some(reason);
        self.audit.update(user_id);
        Ok(())
    }

    /// Calculate remaining value
    pub fn remaining_value(&self) -> Money {
        Money::from_centimes((self.quantity_remaining * self.unit_cost.centimes() as f64) as i64)
    }

    /// Calculate selling value at given price
    pub fn selling_value(&self, unit_price: Money) -> Money {
        Money::from_centimes((self.quantity_remaining * unit_price.centimes() as f64) as i64)
    }
}

/// FIFO lot selector for finished products (delivery)
pub struct FifoLotSelectorPf;

impl FifoLotSelectorPf {
    /// Select lots to deliver in FIFO order
    pub fn select_lots(
        available_lots: &[LotPf],
        required_quantity: f64,
    ) -> Result<Vec<(EntityId, f64)>> {
        let mut remaining = required_quantity;
        let mut selections = Vec::new();

        // Sort by production date (FIFO), then by expiry date
        let mut sorted_lots: Vec<_> = available_lots
            .iter()
            .filter(|lot| lot.can_deliver(0.01))
            .collect();

        sorted_lots.sort_by(|a, b| {
            a.production_date
                .cmp(&b.production_date)
                .then_with(|| a.expiry_date.cmp(&b.expiry_date))
        });

        for lot in sorted_lots {
            if remaining <= 0.0 {
                break;
            }

            let deliver = lot.quantity_remaining.min(remaining);
            selections.push((lot.id, deliver));
            remaining -= deliver;
        }

        if remaining > 0.001 {
            return Err(Error::InsufficientStock {
                product: "Multiple PF lots".to_string(),
                required: required_quantity,
                available: required_quantity - remaining,
            });
        }

        Ok(selections)
    }
}
