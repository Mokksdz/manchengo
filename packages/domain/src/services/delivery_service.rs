//! Delivery orchestration service

use manchengo_core::{EntityId, Money, Result};
use crate::delivery::Delivery;
use crate::stock::{FifoLotSelectorPf, LotPf};

/// Delivery operations
pub struct DeliveryService;

impl DeliveryService {
    /// Select lots for delivery using FIFO
    pub fn select_lots_for_delivery(
        available_lots: &[LotPf],
        product_id: EntityId,
        required_quantity: f64,
    ) -> Result<Vec<(EntityId, f64)>> {
        let product_lots: Vec<_> = available_lots
            .iter()
            .filter(|l| l.product_id == product_id)
            .cloned()
            .collect();

        FifoLotSelectorPf::select_lots(&product_lots, required_quantity)
    }

    /// Calculate total weight for delivery
    pub fn calculate_total_weight(
        delivery: &Delivery,
        product_weights: &[(EntityId, f64)], // (product_id, weight_kg)
    ) -> f64 {
        delivery
            .lines
            .iter()
            .flat_map(|line| &line.items)
            .map(|item| {
                let weight = product_weights
                    .iter()
                    .find(|(id, _)| *id == item.product_pf_id)
                    .map(|(_, w)| *w)
                    .unwrap_or(0.0);
                item.quantity_planned * weight
            })
            .sum()
    }

    /// Validate all items are QR scanned
    pub fn validate_loading_complete(delivery: &Delivery) -> Vec<EntityId> {
        // Returns list of unscanned item IDs
        delivery
            .lines
            .iter()
            .flat_map(|line| &line.items)
            .filter(|item| item.qr_scanned_at.is_none())
            .map(|item| item.id)
            .collect()
    }

    /// Calculate delivery summary
    pub fn calculate_summary(delivery: &Delivery) -> DeliverySummary {
        let total_clients = delivery.lines.len();
        let delivered_clients = delivery
            .lines
            .iter()
            .filter(|l| matches!(l.status, crate::delivery::DeliveryLineStatus::Delivered))
            .count();

        let total_items: usize = delivery
            .lines
            .iter()
            .map(|l| l.items.len())
            .sum();

        let total_delivered_qty: f64 = delivery
            .lines
            .iter()
            .flat_map(|l| &l.items)
            .map(|i| i.quantity_delivered)
            .sum();

        let total_payment = delivery.total_payment_collected();

        DeliverySummary {
            total_clients,
            delivered_clients,
            total_items,
            total_delivered_qty,
            total_payment,
            total_expected: delivery.total_ttc,
        }
    }
}

/// Delivery summary statistics
#[derive(Debug, Clone)]
pub struct DeliverySummary {
    pub total_clients: usize,
    pub delivered_clients: usize,
    pub total_items: usize,
    pub total_delivered_qty: f64,
    pub total_payment: Money,
    pub total_expected: Money,
}

impl DeliverySummary {
    pub fn delivery_rate(&self) -> f64 {
        if self.total_clients == 0 {
            0.0
        } else {
            (self.delivered_clients as f64 / self.total_clients as f64) * 100.0
        }
    }

    pub fn collection_rate(&self) -> f64 {
        if self.total_expected.is_zero() {
            0.0
        } else {
            (self.total_payment.centimes() as f64 / self.total_expected.centimes() as f64) * 100.0
        }
    }
}
