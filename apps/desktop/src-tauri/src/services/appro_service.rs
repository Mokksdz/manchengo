//! Appro Service
//!
//! Business logic for procurement (purchase orders, supplier management).

use manchengo_core::{EntityId, Error, Result};
use manchengo_database::Database;
use manchengo_sync::EventStore;
use std::sync::Arc;
use tracing::info;

use crate::dto::appro::*;
use crate::dto::{CreateReceptionDto, ReceptionLineDto};
use crate::repositories::{PurchaseOrderRepository, SupplierRepository};
use crate::services::StockService;

/// Appro service for procurement management
pub struct ApproService {
    db: Arc<Database>,
    event_store: Arc<EventStore>,
    po_repo: Arc<PurchaseOrderRepository>,
    supplier_repo: Arc<SupplierRepository>,
    stock_service: Arc<StockService>,
}

impl ApproService {
    pub fn new(
        db: Arc<Database>,
        event_store: Arc<EventStore>,
        po_repo: Arc<PurchaseOrderRepository>,
        supplier_repo: Arc<SupplierRepository>,
        stock_service: Arc<StockService>,
    ) -> Self {
        Self {
            db,
            event_store,
            po_repo,
            supplier_repo,
            stock_service,
        }
    }

    // =========================================================================
    // PURCHASE ORDER OPERATIONS
    // =========================================================================

    /// List purchase orders
    pub fn list_orders(&self, filter: PurchaseOrderFilter) -> Result<Vec<PurchaseOrderDto>> {
        self.po_repo.list(filter)
    }

    /// Get single purchase order
    pub fn get_order(&self, id: &str) -> Result<Option<PurchaseOrderDto>> {
        self.po_repo.get(id)
    }

    /// Create new purchase order
    pub fn create_order(&self, data: CreatePurchaseOrderDto) -> Result<PurchaseOrderDto> {
        let id = EntityId::new().to_string();
        let reference = self.po_repo.generate_reference()?;

        self.po_repo.create(&id, &reference, &data)?;

        info!("Created purchase order {} for supplier {}", reference, data.supplier_id);

        self.po_repo
            .get(&id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "PurchaseOrder".to_string(),
                id: id.clone(),
            })
    }

    /// Confirm purchase order (DRAFT -> CONFIRMED)
    pub fn confirm_order(&self, id: &str) -> Result<PurchaseOrderDto> {
        let order = self
            .po_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "PurchaseOrder".to_string(),
                id: id.to_string(),
            })?;

        if order.status != PurchaseOrderStatus::Draft {
            return Err(Error::InvalidStateTransition {
                entity: "PurchaseOrder".to_string(),
                from: format!("{:?}", order.status),
                to: "CONFIRMED".to_string(),
            });
        }

        self.po_repo.update_status(id, "CONFIRMED")?;

        info!("Confirmed purchase order {}", order.reference);

        self.po_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "PurchaseOrder".to_string(),
                id: id.to_string(),
            })
    }

    /// Send purchase order (CONFIRMED -> SENT)
    pub fn send_order(&self, id: &str) -> Result<PurchaseOrderDto> {
        let order = self
            .po_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "PurchaseOrder".to_string(),
                id: id.to_string(),
            })?;

        if order.status != PurchaseOrderStatus::Confirmed {
            return Err(Error::InvalidStateTransition {
                entity: "PurchaseOrder".to_string(),
                from: format!("{:?}", order.status),
                to: "SENT".to_string(),
            });
        }

        self.po_repo.update_status(id, "SENT")?;

        info!("Sent purchase order {} to supplier", order.reference);

        self.po_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "PurchaseOrder".to_string(),
                id: id.to_string(),
            })
    }

    /// Receive purchase order (creates reception and updates stock)
    pub fn receive_order(&self, id: &str, data: ReceivePurchaseOrderDto, user_id: &str) -> Result<PurchaseOrderDto> {
        let order = self
            .po_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "PurchaseOrder".to_string(),
                id: id.to_string(),
            })?;

        if order.status != PurchaseOrderStatus::Sent {
            return Err(Error::InvalidStateTransition {
                entity: "PurchaseOrder".to_string(),
                from: format!("{:?}", order.status),
                to: "RECEIVED".to_string(),
            });
        }

        // Create reception lines
        let reception_lines: Vec<ReceptionLineDto> = data
            .lines
            .iter()
            .zip(order.lines.iter())
            .map(|(received, original)| ReceptionLineDto {
                product_mp_id: original.product_mp_id.clone(),
                quantity: received.quantity_received as f64,
                unit_cost: received.unit_cost.unwrap_or(original.unit_price as i64),
                lot_number: received.lot_number.clone(),
                expiry_date: received.expiry_date.clone(),
                tva_rate: None,
            })
            .collect();

        // Create reception via stock service
        let reception_data = CreateReceptionDto {
            supplier_id: order.supplier_id.clone(),
            date: chrono::Utc::now().to_rfc3339(),
            bl_number: Some(format!("BL-{}", order.reference)),
            note: Some(format!("Reception from BC {}", order.reference)),
            lines: reception_lines,
        };

        self.stock_service
            .create_reception(reception_data, user_id)
            .map_err(|e| Error::Internal(e.to_string()))?;

        // Mark order as received
        self.po_repo.mark_received(id)?;

        info!("Received purchase order {}", order.reference);

        self.po_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "PurchaseOrder".to_string(),
                id: id.to_string(),
            })
    }

    /// Cancel purchase order
    pub fn cancel_order(&self, id: &str) -> Result<()> {
        let order = self
            .po_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "PurchaseOrder".to_string(),
                id: id.to_string(),
            })?;

        if order.status == PurchaseOrderStatus::Received {
            return Err(Error::BusinessRule("Cannot cancel received orders".to_string()));
        }

        self.po_repo.cancel(id)?;

        info!("Cancelled purchase order {}", order.reference);
        Ok(())
    }

    // =========================================================================
    // SUPPLIER OPERATIONS
    // =========================================================================

    /// Get supplier performance
    pub fn get_supplier_performance(&self, supplier_id: &str) -> Result<SupplierPerformanceDto> {
        let supplier = self
            .supplier_repo
            .get(supplier_id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Supplier".to_string(),
                id: supplier_id.to_string(),
            })?;

        // Get all orders for this supplier
        let orders = self.po_repo.list(PurchaseOrderFilter {
            supplier_id: Some(supplier_id.to_string()),
            limit: Some(1000),
            ..Default::default()
        })?;

        let total_orders = orders.len() as i32;
        let total_amount: i64 = orders.iter().map(|o| o.total_amount).sum();

        // Calculate on-time deliveries (simplified)
        let received_orders: Vec<_> = orders
            .iter()
            .filter(|o| o.status == PurchaseOrderStatus::Received)
            .collect();

        let on_time = received_orders
            .iter()
            .filter(|o| {
                if let (Some(expected), Some(received)) = (&o.expected_delivery, &o.received_date) {
                    received <= expected
                } else {
                    true
                }
            })
            .count() as i32;

        let late = received_orders.len() as i32 - on_time;

        let on_time_rate = if received_orders.is_empty() {
            100.0
        } else {
            (on_time as f64 / received_orders.len() as f64) * 100.0
        };

        Ok(SupplierPerformanceDto {
            supplier_id: supplier_id.to_string(),
            supplier_name: supplier.name,
            total_orders,
            total_amount,
            on_time_deliveries: on_time,
            late_deliveries: late,
            on_time_rate,
            avg_delivery_days: 5.0, // TODO: calculate actual average
            quality_issues: 0,
        })
    }

    // =========================================================================
    // DASHBOARD
    // =========================================================================

    /// Get appro dashboard
    pub fn get_dashboard(&self) -> Result<ApproDashboardDto> {
        let pending = self.po_repo.count_by_status("SENT")? as i32
            + self.po_repo.count_by_status("CONFIRMED")? as i32;

        // Get recent orders
        let recent_orders = self.po_repo.list(PurchaseOrderFilter {
            limit: Some(5),
            ..Default::default()
        })?;

        // TODO: Get low stock alerts from stock service
        let low_stock_alerts = Vec::new();

        Ok(ApproDashboardDto {
            pending_orders: pending,
            orders_this_month: 0, // TODO: calculate
            total_spent_this_month: 0,
            recent_orders,
            low_stock_alerts,
        })
    }
}
