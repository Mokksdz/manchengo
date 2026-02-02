//! Raw material lot management with FIFO support

use chrono::{DateTime, NaiveDate, Utc};
use manchengo_core::{AuditInfo, EntityId, Error, Money, QrCodeData, QrEntityType, Result, UnitOfMeasure};
use serde::{Deserialize, Serialize};

/// Status of a raw material lot
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LotStatus {
    Available,
    Reserved,
    Consumed,
    Expired,
    Blocked,
}

impl LotStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Available => "AVAILABLE",
            Self::Reserved => "RESERVED",
            Self::Consumed => "CONSUMED",
            Self::Expired => "EXPIRED",
            Self::Blocked => "BLOCKED",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "AVAILABLE" => Some(Self::Available),
            "RESERVED" => Some(Self::Reserved),
            "CONSUMED" => Some(Self::Consumed),
            "EXPIRED" => Some(Self::Expired),
            "BLOCKED" => Some(Self::Blocked),
            _ => None,
        }
    }

    /// Check if lot can be consumed
    pub fn is_consumable(&self) -> bool {
        matches!(self, Self::Available | Self::Reserved)
    }
}

/// Raw material lot (Lot Matière Première)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LotMp {
    pub id: EntityId,
    pub lot_number: String,
    pub product_id: EntityId,
    pub supplier_id: Option<EntityId>,

    // Quantities
    pub quantity_initial: f64,
    pub quantity_remaining: f64,
    pub unit: UnitOfMeasure,

    // Dates
    pub reception_date: NaiveDate,
    pub production_date: Option<NaiveDate>,
    pub expiry_date: Option<NaiveDate>,

    // Cost
    pub unit_cost: Money,
    pub total_cost: Money,

    // Traceability
    pub supplier_lot_number: Option<String>,
    pub supplier_bl_number: Option<String>,
    pub bl_photo_path: Option<String>,

    // Status
    pub status: LotStatus,
    pub blocked_reason: Option<String>,

    // QR Code
    pub qr_code: String,

    // Metadata
    pub notes: Option<String>,
    pub audit: AuditInfo,
}

impl LotMp {
    /// Create a new raw material lot
    pub fn new(
        lot_number: String,
        product_id: EntityId,
        quantity: f64,
        unit: UnitOfMeasure,
        unit_cost: Money,
        reception_date: NaiveDate,
        user_id: EntityId,
    ) -> Self {
        let id = EntityId::new();
        let total_cost = Money::from_centimes((quantity * unit_cost.centimes() as f64) as i64);

        // Generate QR code data
        let qr_data = QrCodeData {
            entity_type: QrEntityType::LotMp,
            entity_id: id,
            reference: lot_number.clone(),
            expiry_date: None,
            checksum: String::new(), // Will be calculated
        };

        Self {
            id,
            lot_number,
            product_id,
            supplier_id: None,
            quantity_initial: quantity,
            quantity_remaining: quantity,
            unit,
            reception_date,
            production_date: None,
            expiry_date: None,
            unit_cost,
            total_cost,
            supplier_lot_number: None,
            supplier_bl_number: None,
            bl_photo_path: None,
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

    /// Check if lot can be consumed
    pub fn can_consume(&self, quantity: f64) -> bool {
        self.status.is_consumable()
            && !self.is_expired()
            && self.quantity_remaining >= quantity
    }

    /// Consume quantity from lot (FIFO)
    pub fn consume(&mut self, quantity: f64, user_id: EntityId) -> Result<f64> {
        if !self.status.is_consumable() {
            return Err(Error::BusinessRule(format!(
                "Lot {} cannot be consumed (status: {:?})",
                self.lot_number, self.status
            )));
        }

        if self.is_expired() {
            return Err(Error::LotExpired {
                lot_id: self.id.to_string(),
                expiry_date: self.expiry_date.map(|d| d.to_string()).unwrap_or_default(),
            });
        }

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
        }

        Ok(self.quantity_remaining)
    }

    /// Block lot (quality issue, etc.)
    pub fn block(&mut self, reason: String, user_id: EntityId) -> Result<()> {
        if self.status == LotStatus::Consumed {
            return Err(Error::InvalidStateTransition {
                entity: "LotMp".to_string(),
                from: "CONSUMED".to_string(),
                to: "BLOCKED".to_string(),
            });
        }

        self.status = LotStatus::Blocked;
        self.blocked_reason = Some(reason);
        self.audit.update(user_id);
        Ok(())
    }

    /// Unblock lot
    pub fn unblock(&mut self, user_id: EntityId) -> Result<()> {
        if self.status != LotStatus::Blocked {
            return Err(Error::BusinessRule(
                "Only blocked lots can be unblocked".to_string(),
            ));
        }

        self.status = if self.quantity_remaining > 0.0 {
            LotStatus::Available
        } else {
            LotStatus::Consumed
        };
        self.blocked_reason = None;
        self.audit.update(user_id);
        Ok(())
    }

    /// Calculate remaining value
    pub fn remaining_value(&self) -> Money {
        Money::from_centimes((self.quantity_remaining * self.unit_cost.centimes() as f64) as i64)
    }
}

/// FIFO lot selector for consuming raw materials
pub struct FifoLotSelector;

impl FifoLotSelector {
    /// Select lots to consume in FIFO order
    /// Returns list of (lot_id, quantity_to_consume)
    pub fn select_lots(
        available_lots: &[LotMp],
        required_quantity: f64,
    ) -> Result<Vec<(EntityId, f64)>> {
        let mut remaining = required_quantity;
        let mut selections = Vec::new();

        // Sort by reception date (FIFO), then by expiry date
        let mut sorted_lots: Vec<_> = available_lots
            .iter()
            .filter(|lot| lot.can_consume(0.01)) // Any consumable amount
            .collect();

        sorted_lots.sort_by(|a, b| {
            a.reception_date
                .cmp(&b.reception_date)
                .then_with(|| a.expiry_date.cmp(&b.expiry_date))
        });

        for lot in sorted_lots {
            if remaining <= 0.0 {
                break;
            }

            let consume = lot.quantity_remaining.min(remaining);
            selections.push((lot.id, consume));
            remaining -= consume;
        }

        if remaining > 0.001 {
            // Small tolerance for floating point
            return Err(Error::InsufficientStock {
                product: "Multiple lots".to_string(),
                required: required_quantity,
                available: required_quantity - remaining,
            });
        }

        Ok(selections)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_lot(quantity: f64, reception_date: NaiveDate) -> LotMp {
        LotMp::new(
            format!("LOT-{}", reception_date),
            EntityId::new(),
            quantity,
            UnitOfMeasure::Kilogram,
            Money::from_dzd(100.0),
            reception_date,
            EntityId::new(),
        )
    }

    #[test]
    fn test_lot_creation() {
        let lot = create_test_lot(100.0, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());
        assert_eq!(lot.quantity_remaining, 100.0);
        assert_eq!(lot.status, LotStatus::Available);
    }

    #[test]
    fn test_lot_consume() {
        let mut lot = create_test_lot(100.0, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());
        let user = EntityId::new();

        let remaining = lot.consume(30.0, user).unwrap();
        assert_eq!(remaining, 70.0);
        assert_eq!(lot.status, LotStatus::Available);

        let remaining = lot.consume(70.0, user).unwrap();
        assert_eq!(remaining, 0.0);
        assert_eq!(lot.status, LotStatus::Consumed);
    }

    #[test]
    fn test_lot_consume_insufficient() {
        let mut lot = create_test_lot(50.0, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());
        let result = lot.consume(100.0, EntityId::new());
        assert!(result.is_err());
    }

    #[test]
    fn test_fifo_selection() {
        let lots = vec![
            create_test_lot(50.0, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()),
            create_test_lot(30.0, NaiveDate::from_ymd_opt(2024, 1, 10).unwrap()), // Older
            create_test_lot(40.0, NaiveDate::from_ymd_opt(2024, 1, 20).unwrap()),
        ];

        let selections = FifoLotSelector::select_lots(&lots, 70.0).unwrap();

        // Should select from oldest first (Jan 10: 30kg, then Jan 15: 40kg)
        assert_eq!(selections.len(), 2);
        assert_eq!(selections[0].0, lots[1].id); // Jan 10 lot
        assert_eq!(selections[0].1, 30.0);
        assert_eq!(selections[1].0, lots[0].id); // Jan 15 lot
        assert_eq!(selections[1].1, 40.0);
    }
}
