//! Delivery note management

use chrono::{DateTime, NaiveDate, Utc};
use manchengo_core::{AuditInfo, EntityId, Error, Money, QrCodeData, QrEntityType, Result, UnitOfMeasure};
use serde::{Deserialize, Serialize};

/// Delivery status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DeliveryStatus {
    Draft,
    Prepared,
    Loaded,
    InTransit,
    Delivered,
    Partial,
    Returned,
}

impl DeliveryStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "DRAFT",
            Self::Prepared => "PREPARED",
            Self::Loaded => "LOADED",
            Self::InTransit => "IN_TRANSIT",
            Self::Delivered => "DELIVERED",
            Self::Partial => "PARTIAL",
            Self::Returned => "RETURNED",
        }
    }
}

/// Client delivery status within a delivery
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DeliveryLineStatus {
    Pending,
    Delivered,
    Partial,
    Refused,
}

/// Payment method for cash collection
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PaymentMethod {
    Cash,
    Check,
    Transfer,
    Other,
}

/// Delivery note (Bon de livraison)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Delivery {
    pub id: EntityId,
    pub delivery_number: String,

    // Vehicle and driver
    pub vehicle_id: Option<EntityId>,
    pub driver_name: Option<String>,
    pub driver_phone: Option<String>,

    // Dates
    pub planned_date: NaiveDate,
    pub departure_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,

    // Status
    pub status: DeliveryStatus,

    // Lines (one per client)
    pub lines: Vec<DeliveryLine>,

    // Totals
    pub total_ht: Money,
    pub total_tva: Money,
    pub total_ttc: Money,
    pub total_weight_kg: f64,

    // QR
    pub qr_code: String,

    // Metadata
    pub notes: Option<String>,
    pub audit: AuditInfo,
}

/// Delivery line (for one client)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryLine {
    pub id: EntityId,
    pub delivery_id: EntityId,
    pub client_id: EntityId,
    pub sales_order_id: Option<EntityId>,

    // Sequence in route
    pub sequence_number: i32,

    // Status
    pub status: DeliveryLineStatus,
    pub delivered_at: Option<DateTime<Utc>>,

    // Amounts
    pub total_ht: Money,
    pub total_ttc: Money,

    // Items
    pub items: Vec<DeliveryLineItem>,

    // Proof of delivery
    pub signature_path: Option<String>,
    pub photo_path: Option<String>,

    // Payment collected
    pub payment_collected: Money,
    pub payment_method: Option<PaymentMethod>,

    // Metadata
    pub notes: Option<String>,
    pub refusal_reason: Option<String>,
}

/// Individual item in a delivery line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryLineItem {
    pub id: EntityId,
    pub delivery_line_id: EntityId,
    pub product_pf_id: EntityId,
    pub lot_pf_id: EntityId,
    pub quantity_planned: f64,
    pub quantity_delivered: f64,
    pub unit: UnitOfMeasure,
    pub unit_price_ht: Money,
    pub total_ht: Money,

    // QR verification
    pub qr_scanned_at: Option<DateTime<Utc>>,
    pub qr_scanned_by: Option<EntityId>,
}

impl Delivery {
    pub fn new(
        delivery_number: String,
        planned_date: NaiveDate,
        user_id: EntityId,
    ) -> Self {
        let id = EntityId::new();

        let qr_data = QrCodeData {
            entity_type: QrEntityType::Delivery,
            entity_id: id,
            reference: delivery_number.clone(),
            expiry_date: None,
            checksum: String::new(),
        };

        Self {
            id,
            delivery_number,
            vehicle_id: None,
            driver_name: None,
            driver_phone: None,
            planned_date,
            departure_at: None,
            completed_at: None,
            status: DeliveryStatus::Draft,
            lines: Vec::new(),
            total_ht: Money::zero(),
            total_tva: Money::zero(),
            total_ttc: Money::zero(),
            total_weight_kg: 0.0,
            qr_code: qr_data.encode(),
            notes: None,
            audit: AuditInfo::new(user_id),
        }
    }

    /// Add a client line to the delivery
    pub fn add_line(
        &mut self,
        client_id: EntityId,
        sales_order_id: Option<EntityId>,
        sequence: i32,
        user_id: EntityId,
    ) -> Result<EntityId> {
        if self.status != DeliveryStatus::Draft {
            return Err(Error::BusinessRule(
                "Can only add lines to draft deliveries".to_string(),
            ));
        }

        let line = DeliveryLine {
            id: EntityId::new(),
            delivery_id: self.id,
            client_id,
            sales_order_id,
            sequence_number: sequence,
            status: DeliveryLineStatus::Pending,
            delivered_at: None,
            total_ht: Money::zero(),
            total_ttc: Money::zero(),
            items: Vec::new(),
            signature_path: None,
            photo_path: None,
            payment_collected: Money::zero(),
            payment_method: None,
            notes: None,
            refusal_reason: None,
        };

        let line_id = line.id;
        self.lines.push(line);
        self.audit.update(user_id);
        Ok(line_id)
    }

    /// Mark as prepared (ready for loading)
    pub fn mark_prepared(&mut self, user_id: EntityId) -> Result<()> {
        if self.status != DeliveryStatus::Draft {
            return Err(Error::InvalidStateTransition {
                entity: "Delivery".to_string(),
                from: self.status.as_str().to_string(),
                to: "PREPARED".to_string(),
            });
        }

        if self.lines.is_empty() {
            return Err(Error::Validation {
                field: "lines".to_string(),
                message: "Delivery must have at least one client".to_string(),
            });
        }

        self.status = DeliveryStatus::Prepared;
        self.audit.update(user_id);
        Ok(())
    }

    /// Record item QR scan during loading
    pub fn scan_item(
        &mut self,
        line_id: EntityId,
        lot_pf_id: EntityId,
        quantity: f64,
        user_id: EntityId,
    ) -> Result<()> {
        if self.status != DeliveryStatus::Prepared && self.status != DeliveryStatus::Loaded {
            return Err(Error::BusinessRule(
                "Can only scan items when delivery is prepared or loading".to_string(),
            ));
        }

        let line = self
            .lines
            .iter_mut()
            .find(|l| l.id == line_id)
            .ok_or_else(|| Error::NotFound {
                entity_type: "DeliveryLine".to_string(),
                id: line_id.to_string(),
            })?;

        // Find the item for this lot
        let item = line
            .items
            .iter_mut()
            .find(|i| i.lot_pf_id == lot_pf_id)
            .ok_or_else(|| Error::BusinessRule(
                format!("Lot {} not expected in this delivery line", lot_pf_id),
            ))?;

        item.qr_scanned_at = Some(Utc::now());
        item.qr_scanned_by = Some(user_id);

        self.status = DeliveryStatus::Loaded;
        self.audit.update(user_id);
        Ok(())
    }

    /// Start delivery (depart)
    pub fn depart(&mut self, user_id: EntityId) -> Result<()> {
        if self.status != DeliveryStatus::Loaded {
            return Err(Error::InvalidStateTransition {
                entity: "Delivery".to_string(),
                from: self.status.as_str().to_string(),
                to: "IN_TRANSIT".to_string(),
            });
        }

        // Verify all items scanned
        let all_scanned = self.lines.iter().all(|line| {
            line.items.iter().all(|item| item.qr_scanned_at.is_some())
        });

        if !all_scanned {
            return Err(Error::BusinessRule(
                "All items must be scanned before departure".to_string(),
            ));
        }

        self.status = DeliveryStatus::InTransit;
        self.departure_at = Some(Utc::now());
        self.audit.update(user_id);
        Ok(())
    }

    /// Complete delivery for a specific client
    pub fn deliver_to_client(
        &mut self,
        line_id: EntityId,
        quantities: Vec<(EntityId, f64)>, // (item_id, quantity_delivered)
        payment: Option<(Money, PaymentMethod)>,
        signature_path: Option<String>,
        user_id: EntityId,
    ) -> Result<()> {
        if self.status != DeliveryStatus::InTransit {
            return Err(Error::BusinessRule(
                "Delivery must be in transit".to_string(),
            ));
        }

        let line = self
            .lines
            .iter_mut()
            .find(|l| l.id == line_id)
            .ok_or_else(|| Error::NotFound {
                entity_type: "DeliveryLine".to_string(),
                id: line_id.to_string(),
            })?;

        // Update quantities
        for (item_id, qty) in quantities {
            if let Some(item) = line.items.iter_mut().find(|i| i.id == item_id) {
                item.quantity_delivered = qty;
            }
        }

        // Determine status
        let all_delivered = line
            .items
            .iter()
            .all(|i| i.quantity_delivered >= i.quantity_planned);
        let any_delivered = line.items.iter().any(|i| i.quantity_delivered > 0.0);

        line.status = if all_delivered {
            DeliveryLineStatus::Delivered
        } else if any_delivered {
            DeliveryLineStatus::Partial
        } else {
            DeliveryLineStatus::Refused
        };

        line.delivered_at = Some(Utc::now());
        line.signature_path = signature_path;

        if let Some((amount, method)) = payment {
            line.payment_collected = amount;
            line.payment_method = Some(method);
        }

        // Check if all clients done
        self.update_overall_status(user_id);
        Ok(())
    }

    /// Refuse delivery for a client
    pub fn refuse_delivery(
        &mut self,
        line_id: EntityId,
        reason: String,
        user_id: EntityId,
    ) -> Result<()> {
        let line = self
            .lines
            .iter_mut()
            .find(|l| l.id == line_id)
            .ok_or_else(|| Error::NotFound {
                entity_type: "DeliveryLine".to_string(),
                id: line_id.to_string(),
            })?;

        line.status = DeliveryLineStatus::Refused;
        line.refusal_reason = Some(reason);
        line.delivered_at = Some(Utc::now());

        self.update_overall_status(user_id);
        Ok(())
    }

    fn update_overall_status(&mut self, user_id: EntityId) {
        let all_done = self
            .lines
            .iter()
            .all(|l| l.status != DeliveryLineStatus::Pending);

        if all_done {
            let all_delivered = self
                .lines
                .iter()
                .all(|l| l.status == DeliveryLineStatus::Delivered);

            let any_delivered = self
                .lines
                .iter()
                .any(|l| matches!(l.status, DeliveryLineStatus::Delivered | DeliveryLineStatus::Partial));

            self.status = if all_delivered {
                DeliveryStatus::Delivered
            } else if any_delivered {
                DeliveryStatus::Partial
            } else {
                DeliveryStatus::Returned
            };

            self.completed_at = Some(Utc::now());
        }

        self.audit.update(user_id);
    }

    /// Get total payment collected
    pub fn total_payment_collected(&self) -> Money {
        self.lines
            .iter()
            .fold(Money::zero(), |acc, l| acc + l.payment_collected)
    }
}
