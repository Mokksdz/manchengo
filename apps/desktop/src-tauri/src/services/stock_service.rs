//! Stock Service
//!
//! Core business logic for stock management including FIFO consumption.
//! This is the CRITICAL service that handles:
//! - Stock calculations (SUM(IN) - SUM(OUT))
//! - FIFO consumption for production
//! - Receptions (MP entry)
//! - Inventory adjustments
//! - Loss declarations

use anyhow::{anyhow, Result};
use chrono::{NaiveDate, Utc};
use manchengo_core::EntityId;
use manchengo_database::Database;
use manchengo_sync::EventStore;
use std::sync::Arc;
use tracing::{info, warn};

use crate::dto::*;
use crate::repositories::{LotRepository, MovementRepository, ProductRepository, SupplierRepository};

/// Stock service implementation
pub struct StockService {
    db: Arc<Database>,
    event_store: Arc<EventStore>,
    product_repo: Arc<ProductRepository>,
    lot_repo: Arc<LotRepository>,
    movement_repo: Arc<MovementRepository>,
    supplier_repo: Arc<SupplierRepository>,
}

impl StockService {
    pub fn new(
        db: Arc<Database>,
        event_store: Arc<EventStore>,
        product_repo: Arc<ProductRepository>,
        lot_repo: Arc<LotRepository>,
        movement_repo: Arc<MovementRepository>,
        supplier_repo: Arc<SupplierRepository>,
    ) -> Self {
        Self {
            db,
            event_store,
            product_repo,
            lot_repo,
            movement_repo,
            supplier_repo,
        }
    }

    // =========================================================================
    // STOCK CALCULATIONS
    // =========================================================================

    /// Calculate current stock for a product
    pub fn calculate_stock(&self, product_type: &str, product_id: &str) -> Result<f64> {
        self.movement_repo.calculate_stock(product_type, product_id)
            .map_err(|e| anyhow!("{}", e))
    }

    /// Get stock status based on thresholds
    pub fn get_stock_status(current: f64, min_stock: f64, reorder_point: f64) -> StockStatus {
        StockStatus::from_levels(current, min_stock, reorder_point)
    }

    /// Get all MP stock levels
    pub fn get_stock_mp(&self) -> Result<Vec<StockLevelDto>> {
        let products = self.product_repo.list_mp(ProductFilter {
            active_only: Some(true),
            ..Default::default()
        })?;

        Ok(products.into_iter().map(|p| StockLevelDto {
            product_id: p.id,
            product_code: p.code,
            product_name: p.name,
            unit: p.unit,
            current_stock: p.current_stock,
            min_stock: p.min_stock,
            reorder_point: p.reorder_point,
            status: p.stock_status,
            last_movement_date: None, // TODO: compute from movements
            lots_count: 0,            // TODO: count lots
        }).collect())
    }

    /// Get all PF stock levels
    pub fn get_stock_pf(&self) -> Result<Vec<StockLevelDto>> {
        let products = self.product_repo.list_pf(ProductFilter {
            active_only: Some(true),
            ..Default::default()
        })?;

        Ok(products.into_iter().map(|p| StockLevelDto {
            product_id: p.id,
            product_code: p.code,
            product_name: p.name,
            unit: p.unit,
            current_stock: p.current_stock,
            min_stock: p.min_stock,
            reorder_point: p.min_stock * 1.5,
            status: p.stock_status,
            last_movement_date: None,
            lots_count: 0,
        }).collect())
    }

    /// Get stock alerts
    pub fn get_stock_alerts(&self) -> Result<StockAlertsDto> {
        let mp_products = self.product_repo.list_mp(ProductFilter {
            active_only: Some(true),
            ..Default::default()
        })?;

        let pf_products = self.product_repo.list_pf(ProductFilter {
            active_only: Some(true),
            ..Default::default()
        })?;

        let mut ruptures = Vec::new();
        let mut critical = Vec::new();
        let mut low = Vec::new();

        // Check MP products
        for p in mp_products {
            let alert = StockAlertDto {
                product_id: p.id.clone(),
                product_code: p.code.clone(),
                product_name: p.name.clone(),
                product_type: "MP".to_string(),
                current_stock: p.current_stock,
                min_stock: p.min_stock,
                deficit: (p.min_stock - p.current_stock).max(0.0),
                status: p.stock_status.clone(),
            };

            match p.stock_status {
                StockStatus::Rupture => ruptures.push(alert),
                StockStatus::Critical => critical.push(alert),
                StockStatus::Low => low.push(alert),
                _ => {}
            }
        }

        // Check PF products
        for p in pf_products {
            let alert = StockAlertDto {
                product_id: p.id.clone(),
                product_code: p.code.clone(),
                product_name: p.name.clone(),
                product_type: "PF".to_string(),
                current_stock: p.current_stock,
                min_stock: p.min_stock,
                deficit: (p.min_stock - p.current_stock).max(0.0),
                status: p.stock_status.clone(),
            };

            match p.stock_status {
                StockStatus::Rupture => ruptures.push(alert),
                StockStatus::Critical => critical.push(alert),
                StockStatus::Low => low.push(alert),
                _ => {}
            }
        }

        // Get expiring lots
        let expiring = self.lot_repo.get_expiring(30)?;

        Ok(StockAlertsDto {
            total_ruptures: ruptures.len() as u32,
            total_critical: critical.len() as u32,
            total_low: low.len() as u32,
            total_expiring: expiring.len() as u32,
            ruptures,
            critical,
            low,
            expiring_soon: expiring,
        })
    }

    // =========================================================================
    // FIFO CONSUMPTION (CRITICAL BUSINESS LOGIC)
    // =========================================================================

    /// Preview FIFO consumption without actually consuming
    pub fn preview_fifo(&self, product_id: &str, quantity: f64) -> Result<FifoPreviewDto> {
        let lots = self.lot_repo.get_available_fifo(product_id)?;

        let mut remaining = quantity;
        let mut preview_lots = Vec::new();
        let mut available = 0.0;

        for lot in lots {
            available += lot.quantity_remaining;

            let to_consume = remaining.min(lot.quantity_remaining);
            if to_consume > 0.0 {
                preview_lots.push(FifoLotPreview {
                    lot_id: lot.id,
                    lot_number: lot.lot_number,
                    quantity_available: lot.quantity_remaining,
                    quantity_to_consume: to_consume,
                    expiry_date: lot.expiry_date,
                    reception_date: lot.reception_date,
                });
                remaining -= to_consume;
            }

            if remaining <= 0.0 {
                break;
            }
        }

        Ok(FifoPreviewDto {
            product_id: product_id.to_string(),
            requested_quantity: quantity,
            available_quantity: available,
            can_fulfill: remaining <= 0.0,
            lots: preview_lots,
            shortage: remaining.max(0.0),
        })
    }

    /// Consume MP using strict FIFO order
    /// This is THE critical business rule for stock management
    pub fn consume_fifo(
        &self,
        product_id: &str,
        quantity: f64,
        origin: &str, // e.g., "PRODUCTION_OUT"
        reference_type: Option<&str>,
        reference_id: Option<&str>,
        user_id: &str,
    ) -> Result<FifoResultDto> {
        // 1. Get lots sorted by FIFO (oldest first, earliest expiry first)
        let lots = self.lot_repo.get_available_fifo(product_id)?;

        if lots.is_empty() {
            return Err(anyhow!("Aucun lot disponible pour le produit {}", product_id));
        }

        // 2. Verify we have enough stock
        let total_available: f64 = lots.iter().map(|l| l.quantity_remaining).sum();
        if total_available < quantity {
            return Err(anyhow!(
                "Stock insuffisant: {} disponible, {} demande",
                total_available,
                quantity
            ));
        }

        // 3. Consume in FIFO order
        let mut remaining = quantity;
        let mut consumptions = Vec::new();
        let mut movements_created = Vec::new();

        for lot in lots {
            if remaining <= 0.0 {
                break;
            }

            let to_consume = remaining.min(lot.quantity_remaining);
            let new_quantity = lot.quantity_remaining - to_consume;

            // Create movement (OUT)
            let movement_id = EntityId::new().to_string();
            let idempotency_key = format!("FIFO-{}-{}-{}", lot.id, origin, Utc::now().timestamp_millis());

            self.movement_repo.create(
                &movement_id,
                "OUT",
                "MP",
                product_id,
                Some(&lot.id),
                to_consume,
                Some(lot.unit_cost),
                origin,
                reference_type,
                reference_id,
                user_id,
                &idempotency_key,
                None,
            )?;

            // Update lot quantity
            self.lot_repo.update_quantity_mp(&lot.id, new_quantity)?;

            info!(
                "FIFO: Consumed {} from lot {} (remaining: {})",
                to_consume, lot.lot_number, new_quantity
            );

            consumptions.push(FifoConsumption {
                lot_id: lot.id.clone(),
                lot_number: lot.lot_number.clone(),
                quantity_consumed: to_consume,
                lot_depleted: new_quantity <= 0.0,
            });

            movements_created.push(movement_id);
            remaining -= to_consume;
        }

        // 4. Emit event for sync
        // self.event_store.append(...) // TODO: implement event emission

        Ok(FifoResultDto {
            total_consumed: quantity,
            consumptions,
            movements_created,
        })
    }

    // =========================================================================
    // RECEPTION
    // =========================================================================

    /// Create reception (MP entry from supplier)
    pub fn create_reception(
        &self,
        data: CreateReceptionDto,
        user_id: &str,
    ) -> Result<ReceptionDto> {
        // Validate supplier exists
        let supplier = self.supplier_repo.get(&data.supplier_id)?
            .ok_or_else(|| anyhow!("Fournisseur non trouve: {}", data.supplier_id))?;

        // Validate date
        let reception_date = data.date.clone();

        // Generate reference
        let reference = format!(
            "REC-{}-{:04}",
            Utc::now().format("%Y%m%d"),
            rand::random::<u16>() % 10000
        );

        let reception_id = EntityId::new().to_string();
        let mut lines_response = Vec::new();
        let mut total_ht: i64 = 0;
        let mut total_tva: i64 = 0;

        for (idx, line) in data.lines.iter().enumerate() {
            // Validate product exists
            let product = self.product_repo.get_mp(&line.product_mp_id)?
                .ok_or_else(|| anyhow!("Produit MP non trouve: {}", line.product_mp_id))?;

            // Validate quantity
            if line.quantity <= 0.0 {
                return Err(anyhow!("Quantite invalide pour ligne {}", idx + 1));
            }

            // Create lot
            let lot_id = EntityId::new().to_string();
            let lot_number = line.lot_number.clone().unwrap_or_else(|| {
                format!("LOT-{}-{:03}", Utc::now().format("%Y%m%d"), idx + 1)
            });

            self.lot_repo.create_mp(
                &lot_id,
                &lot_number,
                &line.product_mp_id,
                Some(&data.supplier_id),
                line.quantity,
                line.unit_cost,
                &reception_date,
                line.expiry_date.as_deref(),
            )?;

            // Create stock movement (IN)
            let movement_id = EntityId::new().to_string();
            let idempotency_key = format!("REC-{}-{}", reception_id, idx);

            self.movement_repo.create(
                &movement_id,
                "IN",
                "MP",
                &line.product_mp_id,
                Some(&lot_id),
                line.quantity,
                Some(line.unit_cost),
                "RECEPTION",
                Some("RECEPTION"),
                Some(&reception_id),
                user_id,
                &idempotency_key,
                None,
            )?;

            // Calculate line totals
            let line_total = (line.quantity * line.unit_cost as f64) as i64;
            let tva_rate = line.tva_rate.unwrap_or(0.19);
            let line_tva = (line_total as f64 * tva_rate) as i64;

            total_ht += line_total;
            total_tva += line_tva;

            lines_response.push(ReceptionLineResponseDto {
                id: format!("{}-{}", reception_id, idx),
                product_mp_id: line.product_mp_id.clone(),
                product_code: product.code,
                product_name: product.name,
                quantity: line.quantity,
                unit: product.unit,
                unit_cost: line.unit_cost,
                line_total,
                tva_rate,
                lot_id,
                lot_number,
                expiry_date: line.expiry_date.clone(),
            });

            info!(
                "Reception: Created lot {} for product {} (qty: {})",
                lines_response.last().unwrap().lot_number,
                lines_response.last().unwrap().product_name,
                line.quantity
            );
        }

        Ok(ReceptionDto {
            id: reception_id,
            reference,
            supplier_id: data.supplier_id,
            supplier_name: supplier.name,
            date: reception_date,
            bl_number: data.bl_number,
            note: data.note,
            lines: lines_response,
            total_ht,
            total_tva,
            total_ttc: total_ht + total_tva,
            created_at: Utc::now().to_rfc3339(),
            created_by: user_id.to_string(),
        })
    }

    // =========================================================================
    // INVENTORY ADJUSTMENT
    // =========================================================================

    /// Adjust inventory (difference-based)
    pub fn adjust_inventory(
        &self,
        data: AdjustInventoryDto,
        user_id: &str,
    ) -> Result<InventoryAdjustmentDto> {
        // Get current stock
        let current_stock = self.calculate_stock(&data.product_type, &data.product_id)?;
        let difference = data.physical_quantity - current_stock;

        if difference.abs() < 0.001 {
            return Err(anyhow!("Pas de difference entre stock physique et theorique"));
        }

        // Validate reason
        if data.reason.len() < 5 {
            return Err(anyhow!("Raison trop courte (min 5 caracteres)"));
        }

        // Determine movement type
        let movement_type = if difference > 0.0 { "IN" } else { "OUT" };
        let quantity = difference.abs();

        // Create movement
        let movement_id = EntityId::new().to_string();
        let idempotency_key = format!(
            "INV-{}-{}-{}",
            data.product_id,
            Utc::now().format("%Y%m%d%H%M%S"),
            rand::random::<u16>()
        );

        self.movement_repo.create(
            &movement_id,
            movement_type,
            &data.product_type,
            &data.product_id,
            None,
            quantity,
            None,
            "INVENTAIRE",
            Some("ADJUSTMENT"),
            None,
            user_id,
            &idempotency_key,
            Some(&data.reason),
        )?;

        // Get product name
        let product_name = if data.product_type == "MP" {
            self.product_repo.get_mp(&data.product_id)?.map(|p| p.name)
        } else {
            self.product_repo.get_pf(&data.product_id)?.map(|p| p.name)
        }.unwrap_or_else(|| "Inconnu".to_string());

        info!(
            "Inventory adjustment: {} {} (diff: {} {})",
            product_name,
            if difference > 0.0 { "+" } else { "-" },
            quantity,
            data.product_type
        );

        Ok(InventoryAdjustmentDto {
            id: movement_id,
            product_id: data.product_id,
            product_name,
            previous_stock: current_stock,
            physical_stock: data.physical_quantity,
            difference,
            movement_type: if difference > 0.0 { MovementType::In } else { MovementType::Out },
            reason: data.reason,
            adjusted_at: Utc::now().to_rfc3339(),
            adjusted_by: user_id.to_string(),
        })
    }

    // =========================================================================
    // LOSS DECLARATION
    // =========================================================================

    /// Declare loss
    pub fn declare_loss(
        &self,
        data: DeclareLossDto,
        user_id: &str,
    ) -> Result<LossDeclarationDto> {
        // Validate quantity
        if data.quantity <= 0.0 {
            return Err(anyhow!("Quantite doit etre superieure a 0"));
        }

        // Validate reason
        if data.reason.len() < 3 {
            return Err(anyhow!("Raison trop courte"));
        }

        // Get product info
        let product_name = if data.product_type == "MP" {
            self.product_repo.get_mp(&data.product_id)?.map(|p| p.name)
        } else {
            self.product_repo.get_pf(&data.product_id)?.map(|p| p.name)
        }.ok_or_else(|| anyhow!("Produit non trouve"))?;

        // Get lot info if specified
        let lot_number = if let Some(ref lot_id) = data.lot_id {
            if data.product_type == "MP" {
                self.lot_repo.get_mp(lot_id)?.map(|l| l.lot_number)
            } else {
                self.lot_repo.get_pf(lot_id)?.map(|l| l.lot_number)
            }
        } else {
            None
        };

        // Create loss movement
        let movement_id = EntityId::new().to_string();
        let idempotency_key = format!(
            "LOSS-{}-{}",
            data.product_id,
            Utc::now().timestamp_millis()
        );

        self.movement_repo.create(
            &movement_id,
            "OUT",
            &data.product_type,
            &data.product_id,
            data.lot_id.as_deref(),
            data.quantity,
            None,
            "PERTE",
            Some("LOSS"),
            None,
            user_id,
            &idempotency_key,
            data.description.as_deref(),
        )?;

        // Update lot if specified
        if let Some(ref lot_id) = data.lot_id {
            if data.product_type == "MP" {
                if let Some(lot) = self.lot_repo.get_mp(lot_id)? {
                    let new_qty = (lot.quantity_remaining - data.quantity).max(0.0);
                    self.lot_repo.update_quantity_mp(lot_id, new_qty)?;
                }
            }
        }

        warn!(
            "Loss declared: {} {} of {} (reason: {})",
            data.quantity, data.product_type, product_name, data.reason
        );

        Ok(LossDeclarationDto {
            id: movement_id,
            product_id: data.product_id,
            product_name,
            lot_id: data.lot_id,
            lot_number,
            quantity: data.quantity,
            reason: data.reason,
            description: data.description,
            declared_at: Utc::now().to_rfc3339(),
            declared_by: user_id.to_string(),
        })
    }

    // =========================================================================
    // LOT MANAGEMENT
    // =========================================================================

    /// Block lot (quality issue)
    pub fn block_lot(&self, lot_id: &str, product_type: &str, _reason: &str) -> Result<()> {
        if product_type == "MP" {
            self.lot_repo.set_status_mp(lot_id, "BLOCKED")?;
        }
        // TODO: implement for PF
        info!("Lot {} blocked", lot_id);
        Ok(())
    }

    /// Unblock lot
    pub fn unblock_lot(&self, lot_id: &str, product_type: &str) -> Result<()> {
        if product_type == "MP" {
            self.lot_repo.set_status_mp(lot_id, "AVAILABLE")?;
        }
        // TODO: implement for PF
        info!("Lot {} unblocked", lot_id);
        Ok(())
    }

    /// Get expiring lots
    pub fn get_expiring_lots(&self, days: i32) -> Result<Vec<ExpiringLotDto>> {
        self.lot_repo.get_expiring(days)
            .map_err(|e| anyhow!("{}", e))
    }
}
