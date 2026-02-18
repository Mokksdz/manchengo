//! Production Service
//!
//! Business logic for production orders and recipes.
//! Handles the full production workflow including FIFO MP consumption.

use manchengo_core::{EntityId, Error, Result};
use manchengo_database::Database;
use manchengo_sync::EventStore;
use rusqlite::OptionalExtension;
use std::sync::Arc;
use tracing::{info, warn};

use crate::dto::{
    AvailabilityDto, AvailabilityItemDto, CompleteProductionDto, CreateProductionOrderDto,
    CreateRecipeDto, ProductionCalendarEntry, ProductionCompletionDto, ProductionCostDto,
    ProductionDashboardDto, ProductionKpisDto, ProductionOrderDto, ProductionOrderFilter,
    ProductionStatus, RecipeDto, RecipeFilter, ScaledRecipeDto, ScaledRecipeItemDto,
};
use crate::repositories::{LotRepository, ProductionRepository, ProductRepository, RecipeRepository};
use crate::services::StockService;

/// Production service for managing production orders and recipes
pub struct ProductionService {
    db: Arc<Database>,
    event_store: Arc<EventStore>,
    recipe_repo: Arc<RecipeRepository>,
    production_repo: Arc<ProductionRepository>,
    product_repo: Arc<ProductRepository>,
    lot_repo: Arc<LotRepository>,
    stock_service: Arc<StockService>,
}

impl ProductionService {
    pub fn new(
        db: Arc<Database>,
        event_store: Arc<EventStore>,
        recipe_repo: Arc<RecipeRepository>,
        production_repo: Arc<ProductionRepository>,
        product_repo: Arc<ProductRepository>,
        lot_repo: Arc<LotRepository>,
        stock_service: Arc<StockService>,
    ) -> Self {
        Self {
            db,
            event_store,
            recipe_repo,
            production_repo,
            product_repo,
            lot_repo,
            stock_service,
        }
    }

    // =========================================================================
    // RECIPE OPERATIONS
    // =========================================================================

    /// List recipes
    pub fn list_recipes(&self, filter: RecipeFilter) -> Result<Vec<RecipeDto>> {
        self.recipe_repo.list(filter)
    }

    /// Get single recipe
    pub fn get_recipe(&self, id: &str) -> Result<Option<RecipeDto>> {
        self.recipe_repo.get(id)
    }

    /// Create new recipe
    pub fn create_recipe(&self, data: CreateRecipeDto) -> Result<RecipeDto> {
        let id = EntityId::new().to_string();
        let code = self.recipe_repo.generate_code()?;

        self.recipe_repo.create(&id, &code, &data)?;

        // Emit event
        // self.event_store.append(...)?;

        info!("Created recipe {} for product {}", code, data.product_pf_id);

        self.recipe_repo
            .get(&id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Recipe".to_string(),
                id: id.clone(),
            })
    }

    /// Update recipe
    pub fn update_recipe(&self, id: &str, data: CreateRecipeDto) -> Result<RecipeDto> {
        self.recipe_repo.update(id, &data)?;

        info!("Updated recipe {}", id);

        self.recipe_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Recipe".to_string(),
                id: id.to_string(),
            })
    }

    /// Delete recipe (soft delete)
    pub fn delete_recipe(&self, id: &str) -> Result<()> {
        self.recipe_repo.delete(id)?;
        info!("Deleted recipe {}", id);
        Ok(())
    }

    /// Get scaled recipe for production
    pub fn get_scaled_recipe(&self, product_pf_id: &str, batch_count: i32) -> Result<ScaledRecipeDto> {
        let recipe = self
            .recipe_repo
            .get_by_product_pf(product_pf_id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Recipe".to_string(),
                id: product_pf_id.to_string(),
            })?;

        let target_output = recipe.output_quantity * (batch_count as f64);

        let mut scaled_items = Vec::new();
        for item in &recipe.items {
            let quantity_per_batch = item.quantity;
            let total_quantity = quantity_per_batch * (batch_count as f64);

            // Get current stock for this MP
            let current_stock = match &item.product_mp_id {
                Some(mp_id) => self.stock_service
                    .calculate_stock("MP", mp_id)
                    .unwrap_or(0.0),
                None => 0.0,
            };

            let is_available = current_stock >= total_quantity;
            let shortage = if is_available {
                0.0
            } else {
                total_quantity - current_stock
            };

            scaled_items.push(ScaledRecipeItemDto {
                product_mp_id: item.product_mp_id.clone(),
                product_mp_name: item.product_mp_name.clone(),
                quantity_per_batch,
                total_quantity,
                unit: item.unit.clone(),
                current_stock,
                is_available,
                shortage,
            });
        }

        Ok(ScaledRecipeDto {
            recipe_id: recipe.id,
            recipe_name: recipe.name,
            product_pf_id: recipe.product_pf_id,
            product_pf_name: recipe.product_pf_name,
            batch_count: batch_count as f64,
            target_output,
            items: scaled_items,
        })
    }

    /// Check recipe availability (can we start production?)
    pub fn check_availability(&self, product_pf_id: &str, batch_count: i32) -> Result<AvailabilityDto> {
        let scaled = self.get_scaled_recipe(product_pf_id, batch_count)?;

        let mut blockers = Vec::new();
        let mut items = Vec::new();

        for item in &scaled.items {
            if let Some(ref mp_id) = item.product_mp_id {
                let availability_item = AvailabilityItemDto {
                    product_mp_id: mp_id.clone(),
                    product_mp_name: item.product_mp_name.clone().unwrap_or_default(),
                    required: item.total_quantity,
                    available: item.current_stock,
                    unit: item.unit.clone(),
                    is_available: item.is_available,
                    shortage: item.shortage,
                };

                if !item.is_available {
                    blockers.push(format!(
                        "{}: manque {:.2} {} (dispo: {:.2})",
                        item.product_mp_name.as_deref().unwrap_or("MP"),
                        item.shortage,
                        item.unit,
                        item.current_stock
                    ));
                }

                items.push(availability_item);
            }
        }

        Ok(AvailabilityDto {
            can_start: blockers.is_empty(),
            items,
            blockers,
        })
    }

    // =========================================================================
    // PRODUCTION ORDER OPERATIONS
    // =========================================================================

    /// List production orders
    pub fn list_orders(&self, filter: ProductionOrderFilter) -> Result<Vec<ProductionOrderDto>> {
        self.production_repo.list(filter)
    }

    /// Get single production order
    pub fn get_order(&self, id: &str) -> Result<Option<ProductionOrderDto>> {
        self.production_repo.get(id)
    }

    /// Create new production order
    pub fn create_order(&self, data: CreateProductionOrderDto, user_id: &str) -> Result<ProductionOrderDto> {
        // Get recipe for this product
        let recipe = self
            .recipe_repo
            .get_by_product_pf(&data.product_pf_id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Recipe".to_string(),
                id: data.product_pf_id.clone(),
            })?;

        let id = EntityId::new().to_string();
        let reference = self.production_repo.generate_reference()?;
        let target_quantity = recipe.output_quantity * (data.batch_count as f64);

        self.production_repo
            .create(&id, &reference, &recipe.id, target_quantity, &data, user_id)?;

        info!("Created production order {} for {} batches", reference, data.batch_count);

        self.production_repo
            .get(&id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "ProductionOrder".to_string(),
                id: id.clone(),
            })
    }

    /// Start production (consume MP via FIFO)
    pub fn start_production(&self, order_id: &str, user_id: &str) -> Result<ProductionOrderDto> {
        // Get the order
        let order = self
            .production_repo
            .get(order_id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "ProductionOrder".to_string(),
                id: order_id.to_string(),
            })?;

        // Validate status
        if order.status != ProductionStatus::Pending {
            return Err(Error::InvalidStateTransition {
                entity: "ProductionOrder".to_string(),
                from: format!("{:?}", order.status),
                to: "IN_PROGRESS".to_string(),
            });
        }

        // Check availability
        let availability = self.check_availability(&order.product_pf_id, order.batch_count)?;
        if !availability.can_start {
            return Err(Error::BusinessRule(format!(
                "Cannot start production: {}",
                availability.blockers.join(", ")
            )));
        }

        // Get scaled recipe
        let scaled = self.get_scaled_recipe(&order.product_pf_id, order.batch_count)?;

        // Consume MP via FIFO
        for item in &scaled.items {
            if let Some(ref mp_id) = item.product_mp_id {
                let fifo_result = self.stock_service.consume_fifo(
                    mp_id,
                    item.total_quantity,
                    "PRODUCTION",
                    Some("PRODUCTION_ORDER"),
                    Some(&order.id),
                    user_id,
                ).map_err(|e| Error::Internal(e.to_string()))?;

                // Record each consumption
                for consumption in fifo_result.consumptions {
                    let consumption_id = EntityId::new().to_string();
                    self.production_repo.record_consumption(
                        &consumption_id,
                        order_id,
                        mp_id,
                        &consumption.lot_id,
                        consumption.quantity_consumed,
                        &item.unit,
                    )?;
                }

                info!(
                    "Production {}: consumed {:.2} {} of MP {}",
                    order.reference, item.total_quantity, item.unit, mp_id
                );
            }
        }

        // Update status
        self.production_repo.start(order_id)?;

        info!("Started production order {}", order.reference);

        self.production_repo
            .get(order_id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "ProductionOrder".to_string(),
                id: order_id.to_string(),
            })
    }

    /// Complete production (create PF lot)
    pub fn complete_production(
        &self,
        order_id: &str,
        data: CompleteProductionDto,
        user_id: &str,
    ) -> Result<ProductionCompletionDto> {
        // Get the order
        let order = self
            .production_repo
            .get(order_id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "ProductionOrder".to_string(),
                id: order_id.to_string(),
            })?;

        // Validate status
        if order.status != ProductionStatus::InProgress {
            return Err(Error::InvalidStateTransition {
                entity: "ProductionOrder".to_string(),
                from: format!("{:?}", order.status),
                to: "COMPLETED".to_string(),
            });
        }

        // Calculate yield
        let yield_percentage = if order.target_quantity > 0.0 {
            (data.quantity_produced / order.target_quantity) * 100.0
        } else {
            100.0
        };

        // Create PF lot
        let lot_pf_id = EntityId::new().to_string();
        let lot_number = self.generate_lot_pf_number()?;

        // Get recipe for shelf life
        let recipe = self.recipe_repo.get(&order.recipe_id)?;
        let shelf_life_days = recipe.map(|r| r.shelf_life_days).unwrap_or(90);

        // Insert lot_pf
        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO lots_pf (
                    id, product_pf_id, lot_number, production_order_id,
                    quantity_initial, quantity_remaining, production_date,
                    expiry_date, status, created_at, is_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'),
                         datetime('now', '+' || ? || ' days'), 'AVAILABLE', datetime('now'), 0)",
                rusqlite::params![
                    lot_pf_id,
                    order.product_pf_id,
                    lot_number,
                    order_id,
                    data.quantity_produced,
                    data.quantity_produced,
                    shelf_life_days,
                ],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })?;

        // Update production order
        self.production_repo
            .complete(order_id, &data, &lot_pf_id, yield_percentage)?;

        info!(
            "Completed production order {} with {:.2} units (yield: {:.1}%)",
            order.reference, data.quantity_produced, yield_percentage
        );

        Ok(ProductionCompletionDto {
            order_id: order_id.to_string(),
            lot_pf_id,
            lot_pf_number: lot_number,
            quantity_produced: data.quantity_produced,
            yield_percentage,
            consumptions_count: order.consumptions.len() as i32,
            completed_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    /// Cancel production order
    pub fn cancel_production(&self, order_id: &str, reason: Option<&str>) -> Result<()> {
        let order = self
            .production_repo
            .get(order_id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "ProductionOrder".to_string(),
                id: order_id.to_string(),
            })?;

        // Only PENDING orders can be cancelled without reversing stock
        if order.status == ProductionStatus::InProgress {
            warn!("Cancelling IN_PROGRESS order {} - stock already consumed", order.reference);
            // Note: In a real system, we might reverse the stock movements here
        }

        self.production_repo.cancel(order_id, reason)?;

        info!("Cancelled production order {}", order.reference);
        Ok(())
    }

    // =========================================================================
    // DASHBOARD & ANALYTICS
    // =========================================================================

    /// Get production dashboard
    pub fn get_dashboard(&self) -> Result<ProductionDashboardDto> {
        let active_count = self.production_repo.count_by_status("IN_PROGRESS")? as i32;
        let pending_count = self.production_repo.count_by_status("PENDING")? as i32;
        let today_completed = self.production_repo.count_completed_today()? as i32;

        // Get active orders
        let active_orders = self.production_repo.list(ProductionOrderFilter {
            status: Some("IN_PROGRESS".to_string()),
            limit: Some(10),
            ..Default::default()
        })?;

        // Get today's schedule
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let today_schedule = self.production_repo.get_scheduled_for_date(&today)?;

        // TODO: Calculate blocked orders, avg yield, etc.

        Ok(ProductionDashboardDto {
            kpis: ProductionKpisDto {
                today_completed,
                today_target: 10, // TODO: from config
                week_completed: 0,
                week_target: 50,
                month_completed: 0,
                avg_yield: 95.0,
                active_orders: active_count,
                pending_orders: pending_count,
            },
            active_orders,
            blocked_orders: Vec::new(),
            today_schedule,
            stock_pf_summary: Vec::new(),
        })
    }

    /// Get production calendar
    pub fn get_calendar(&self, from_date: &str, to_date: &str) -> Result<Vec<ProductionCalendarEntry>> {
        let orders = self.production_repo.list(ProductionOrderFilter {
            from_date: Some(from_date.to_string()),
            to_date: Some(to_date.to_string()),
            ..Default::default()
        })?;

        // Group by date
        use std::collections::HashMap;
        let mut by_date: HashMap<String, Vec<ProductionOrderDto>> = HashMap::new();

        for order in orders {
            let date = order
                .scheduled_date
                .as_ref()
                .or(Some(&order.created_at))
                .map(|d| d[..10].to_string())
                .unwrap_or_default();

            by_date.entry(date).or_default().push(order);
        }

        let mut calendar: Vec<ProductionCalendarEntry> = by_date
            .into_iter()
            .map(|(date, orders)| {
                let total_batches: i32 = orders.iter().map(|o| o.batch_count).sum();
                ProductionCalendarEntry {
                    date,
                    orders: orders
                        .into_iter()
                        .map(|o| crate::dto::CalendarOrderDto {
                            order_id: o.id,
                            reference: o.reference,
                            product_name: o.product_pf_name,
                            batch_count: o.batch_count,
                            status: o.status,
                        })
                        .collect(),
                    total_batches,
                }
            })
            .collect();

        calendar.sort_by(|a, b| a.date.cmp(&b.date));
        Ok(calendar)
    }

    /// Calculate production cost
    pub fn calculate_cost(&self, order_id: &str) -> Result<ProductionCostDto> {
        let order = self
            .production_repo
            .get(order_id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "ProductionOrder".to_string(),
                id: order_id.to_string(),
            })?;

        let mut mp_cost: i64 = 0;
        let mut mp_breakdown = Vec::new();

        for consumption in &order.consumptions {
            // Get unit cost from lot
            let lot_cost = self.db.with_connection(|conn| {
                let cost: Option<i64> = conn
                    .query_row(
                        "SELECT unit_cost FROM lots_mp WHERE id = ?",
                        [&consumption.lot_mp_id],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|e| Error::Database(e.to_string()))?;
                Ok(cost.unwrap_or(0))
            })?;

            let item_cost = (lot_cost as f64 * consumption.quantity) as i64;
            mp_cost += item_cost;

            mp_breakdown.push(crate::dto::MpCostItem {
                product_mp_id: consumption.product_mp_id.clone(),
                product_mp_name: consumption.product_mp_name.clone(),
                quantity: consumption.quantity,
                unit: consumption.unit.clone(),
                unit_cost: lot_cost,
                total_cost: item_cost,
            });
        }

        let overhead_cost = 0; // TODO: calculate overhead
        let total_cost = mp_cost + overhead_cost;
        let quantity = order.actual_quantity.unwrap_or(order.target_quantity);
        let cost_per_unit = if quantity > 0.0 {
            (total_cost as f64 / quantity) as i64
        } else {
            0
        };

        Ok(ProductionCostDto {
            order_id: order_id.to_string(),
            mp_cost,
            mp_breakdown,
            overhead_cost,
            total_cost,
            cost_per_unit,
            quantity_produced: quantity,
        })
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    fn generate_lot_pf_number(&self) -> Result<String> {
        self.db.with_connection(|conn| {
            let today = chrono::Utc::now().format("%Y%m%d").to_string();
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM lots_pf WHERE lot_number LIKE ?",
                    [format!("PF-{}-%%", today)],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(format!("PF-{}-{:03}", today, count + 1))
        })
    }
}
