//! Stock management service

use manchengo_core::{EntityId, Money, Result, UnitOfMeasure};
use crate::stock::{FifoLotSelector, LotMp, LotStatus, MovementType, ProductType, StockMovement};

/// Stock management operations
pub struct StockService;

impl StockService {
    /// Consume raw materials using FIFO
    ///
    /// Returns list of consumptions: (lot_id, quantity, cost)
    pub fn consume_mp_fifo(
        available_lots: &mut [LotMp],
        product_id: EntityId,
        required_quantity: f64,
        user_id: EntityId,
    ) -> Result<Vec<(EntityId, f64, Money)>> {
        // Filter lots for this product
        let product_lots: Vec<_> = available_lots
            .iter()
            .filter(|l| l.product_id == product_id)
            .cloned()
            .collect();

        // Get FIFO selection
        let selections = FifoLotSelector::select_lots(&product_lots, required_quantity)?;

        let mut consumptions = Vec::new();

        for (lot_id, quantity) in selections {
            // Find and update the actual lot
            let lot = available_lots
                .iter_mut()
                .find(|l| l.id == lot_id)
                .expect("Lot should exist");

            let cost = Money::from_centimes((quantity * lot.unit_cost.centimes() as f64) as i64);
            lot.consume(quantity, user_id)?;

            consumptions.push((lot_id, quantity, cost));
        }

        Ok(consumptions)
    }

    /// Create stock movement for lot consumption
    pub fn create_consumption_movement(
        lot: &LotMp,
        quantity: f64,
        movement_type: MovementType,
        user_id: EntityId,
    ) -> StockMovement {
        StockMovement::exit(
            ProductType::Mp,
            lot.product_id,
            lot.id,
            movement_type,
            quantity,
            lot.unit,
            lot.quantity_remaining + quantity, // Before consumption
            user_id,
        )
    }

    /// Check stock availability for a product
    pub fn check_availability(
        lots: &[LotMp],
        product_id: EntityId,
    ) -> (f64, i32) {
        let available: Vec<_> = lots
            .iter()
            .filter(|l| l.product_id == product_id && l.status == LotStatus::Available)
            .collect();

        let total_qty: f64 = available.iter().map(|l| l.quantity_remaining).sum();
        let lot_count = available.len() as i32;

        (total_qty, lot_count)
    }

    /// Get lots expiring within days
    pub fn get_expiring_lots(
        lots: &[LotMp],
        days: i32,
    ) -> Vec<&LotMp> {
        let threshold = chrono::Utc::now().date_naive()
            + chrono::Duration::days(days as i64);

        lots.iter()
            .filter(|l| {
                l.status == LotStatus::Available
                    && l.expiry_date.map(|d| d <= threshold).unwrap_or(false)
            })
            .collect()
    }
}
