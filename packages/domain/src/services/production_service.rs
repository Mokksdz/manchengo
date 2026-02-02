//! Production orchestration service

use chrono::NaiveDate;
use manchengo_core::{EntityId, Money, Result, UnitOfMeasure};
use crate::production::{ProductionOrder, Recipe};
use crate::stock::{LotMp, LotPf};
use super::StockService;

/// Production operations
pub struct ProductionService;

impl ProductionService {
    /// Check if recipe ingredients are available
    pub fn check_ingredients_available(
        recipe: &Recipe,
        planned_quantity: f64,
        available_lots: &[LotMp],
    ) -> Vec<(EntityId, f64, f64)> {
        // Returns: (product_id, required, available)
        let scaled = recipe.scale_ingredients(planned_quantity);
        let mut availability = Vec::new();

        for (product_id, required, _unit) in scaled {
            let (available, _) = StockService::check_availability(available_lots, product_id);
            availability.push((product_id, required, available));
        }

        availability
    }

    /// Check if production order can start
    pub fn can_start_production(
        recipe: &Recipe,
        order: &ProductionOrder,
        available_lots: &[LotMp],
    ) -> Result<bool> {
        let availability = Self::check_ingredients_available(
            recipe,
            order.planned_quantity,
            available_lots,
        );

        // All ingredients must be available
        Ok(availability.iter().all(|(_, req, avail)| avail >= req))
    }

    /// Calculate cost per unit for finished product
    pub fn calculate_unit_cost(
        total_mp_cost: Money,
        additional_costs: Money,
        output_quantity: f64,
    ) -> Money {
        let total = total_mp_cost + additional_costs;
        Money::from_centimes((total.centimes() as f64 / output_quantity) as i64)
    }

    /// Generate lot number for production output
    pub fn generate_pf_lot_number(
        order_number: &str,
        production_date: NaiveDate,
        sequence: u32,
    ) -> String {
        format!(
            "PF-{}-{}{:02}{:02}-{:02}",
            order_number,
            production_date.format("%y"),
            production_date.format("%m"),
            production_date.format("%d"),
            sequence
        )
    }
}
