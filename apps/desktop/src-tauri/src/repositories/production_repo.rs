//! Production Order Repository
//!
//! Data access for ProductionOrder and ProductionConsumption entities.

use manchengo_core::{Error, Result};
use manchengo_database::Database;
use rusqlite::{params, Row, OptionalExtension};
use std::sync::Arc;

use crate::dto::{
    CompleteProductionDto, CreateProductionOrderDto, ProductionConsumptionDto, ProductionOrderDto,
    ProductionOrderFilter, ProductionStatus,
};

/// Production order repository for CRUD operations
pub struct ProductionRepository {
    db: Arc<Database>,
}

impl ProductionRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// List production orders with optional filter
    pub fn list(&self, filter: ProductionOrderFilter) -> Result<Vec<ProductionOrderDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT po.id, po.order_number, po.product_pf_id,
                        pf.name as pf_name, pf.code as pf_code,
                        po.recipe_id, r.name as recipe_name,
                        1 as batch_count, po.planned_quantity, po.actual_quantity,
                        po.status, po.planned_date, po.started_at, po.completed_at,
                        po.notes, 0 as yield_percentage, '' as lot_pf_id,
                        '' as lot_pf_number,
                        po.created_at, po.created_by, po.qr_code
                 FROM production_orders po
                 LEFT JOIN products_pf pf ON pf.id = po.product_pf_id
                 LEFT JOIN recipes r ON r.id = po.recipe_id
                 WHERE 1=1",
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(ref status) = filter.status {
                sql.push_str(" AND po.status = ?");
                params_vec.push(Box::new(status.clone()));
            }

            if let Some(ref product_pf_id) = filter.product_pf_id {
                sql.push_str(" AND po.product_pf_id = ?");
                params_vec.push(Box::new(product_pf_id.clone()));
            }

            if let Some(ref from_date) = filter.from_date {
                sql.push_str(" AND po.created_at >= ?");
                params_vec.push(Box::new(from_date.clone()));
            }

            if let Some(ref to_date) = filter.to_date {
                sql.push_str(" AND po.created_at <= ?");
                params_vec.push(Box::new(to_date.clone()));
            }

            sql.push_str(" ORDER BY po.created_at DESC");

            if let Some(limit) = filter.limit {
                sql.push_str(&format!(" LIMIT {}", limit));
            } else {
                sql.push_str(" LIMIT 100");
            }

            let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

            let mut result: Vec<ProductionOrderDto> = Vec::new();

            if params_vec.is_empty() {
                let orders = stmt
                    .query_map([], |row| Self::row_to_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for order in orders {
                    let mut dto = order.map_err(|e| Error::Database(e.to_string()))?;
                    dto.consumptions = self.get_consumptions_internal(conn, &dto.id)?;
                    result.push(dto);
                }
            } else {
                let params_refs: Vec<&dyn rusqlite::ToSql> =
                    params_vec.iter().map(|p| p.as_ref()).collect();
                let orders = stmt
                    .query_map(params_refs.as_slice(), |row| Self::row_to_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for order in orders {
                    let mut dto = order.map_err(|e| Error::Database(e.to_string()))?;
                    dto.consumptions = self.get_consumptions_internal(conn, &dto.id)?;
                    result.push(dto);
                }
            }

            Ok(result)
        })
    }

    /// Get single production order by ID
    pub fn get(&self, id: &str) -> Result<Option<ProductionOrderDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT po.id, po.reference, po.product_pf_id,
                            pf.name as pf_name, pf.code as pf_code,
                            po.recipe_id, r.name as recipe_name,
                            po.batch_count, po.target_quantity, po.actual_quantity,
                            po.status, po.scheduled_date, po.started_at, po.completed_at,
                            po.notes, po.yield_percentage, po.lot_pf_id,
                            lpf.lot_number as lot_pf_number,
                            po.created_at, po.created_by, po.qr_code
                     FROM production_orders po
                     LEFT JOIN products_pf pf ON pf.id = po.product_pf_id
                     LEFT JOIN recipes r ON r.id = po.recipe_id
                     LEFT JOIN lots_pf lpf ON lpf.id = po.lot_pf_id
                     WHERE po.id = ?",
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            let order = stmt
                .query_row([id], |row| Self::row_to_dto(row))
                .optional()
                .map_err(|e| Error::Database(e.to_string()))?;

            if let Some(mut dto) = order {
                dto.consumptions = self.get_consumptions_internal(conn, &dto.id)?;
                Ok(Some(dto))
            } else {
                Ok(None)
            }
        })
    }

    /// Create new production order
    pub fn create(
        &self,
        id: &str,
        reference: &str,
        recipe_id: &str,
        target_quantity: f64,
        data: &CreateProductionOrderDto,
        user_id: &str,
    ) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO production_orders (
                    id, reference, product_pf_id, recipe_id, batch_count,
                    target_quantity, status, scheduled_date, notes,
                    created_at, created_by, is_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, datetime('now'), ?, 0)",
                params![
                    id,
                    reference,
                    data.product_pf_id,
                    recipe_id,
                    data.batch_count,
                    target_quantity,
                    data.scheduled_date,
                    data.notes,
                    user_id,
                ],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Update production order status to IN_PROGRESS
    pub fn start(&self, id: &str) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE production_orders SET status = 'IN_PROGRESS', started_at = datetime('now') WHERE id = ?",
                [id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Complete production order
    pub fn complete(
        &self,
        id: &str,
        data: &CompleteProductionDto,
        lot_pf_id: &str,
        yield_percentage: f64,
    ) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE production_orders SET
                    status = 'COMPLETED',
                    actual_quantity = ?,
                    lot_pf_id = ?,
                    yield_percentage = ?,
                    completed_at = datetime('now')
                 WHERE id = ?",
                params![data.quantity_produced, lot_pf_id, yield_percentage, id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Cancel production order
    pub fn cancel(&self, id: &str, reason: Option<&str>) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE production_orders SET status = 'CANCELLED', notes = COALESCE(?, notes) WHERE id = ?",
                params![reason, id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Record MP consumption
    pub fn record_consumption(
        &self,
        id: &str,
        order_id: &str,
        product_mp_id: &str,
        lot_mp_id: &str,
        quantity: f64,
        unit: &str,
    ) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO production_consumptions (
                    id, production_order_id, product_mp_id, lot_mp_id,
                    quantity, unit, consumed_at
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
                params![id, order_id, product_mp_id, lot_mp_id, quantity, unit],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Generate unique reference
    pub fn generate_reference(&self) -> Result<String> {
        self.db.with_connection(|conn| {
            let today = chrono::Utc::now().format("%Y%m%d").to_string();
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM production_orders WHERE reference LIKE ?",
                    [format!("PROD-{}-%%", today)],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(format!("PROD-{}-{:03}", today, count + 1))
        })
    }

    /// Count by status
    pub fn count_by_status(&self, status: &str) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM production_orders WHERE status = ?",
                    [status],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    /// Count completed today
    pub fn count_completed_today(&self) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM production_orders
                     WHERE status = 'COMPLETED' AND date(completed_at) = date('now')",
                    [],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    /// Get orders scheduled for date
    pub fn get_scheduled_for_date(&self, date: &str) -> Result<Vec<ProductionOrderDto>> {
        self.list(ProductionOrderFilter {
            from_date: Some(format!("{} 00:00:00", date)),
            to_date: Some(format!("{} 23:59:59", date)),
            ..Default::default()
        })
    }

    // Internal helpers

    fn get_consumptions_internal(
        &self,
        conn: &rusqlite::Connection,
        order_id: &str,
    ) -> Result<Vec<ProductionConsumptionDto>> {
        let mut stmt = conn
            .prepare(
                "SELECT pc.id, pc.product_mp_id, mp.name as mp_name,
                        pc.lot_mp_id, lmp.lot_number,
                        pc.quantity, pc.unit, pc.consumed_at
                 FROM production_consumptions pc
                 LEFT JOIN products_mp mp ON mp.id = pc.product_mp_id
                 LEFT JOIN lots_mp lmp ON lmp.id = pc.lot_mp_id
                 WHERE pc.production_order_id = ?
                 ORDER BY pc.consumed_at ASC",
            )
            .map_err(|e| Error::Database(e.to_string()))?;

        let consumptions = stmt
            .query_map([order_id], |row| {
                Ok(ProductionConsumptionDto {
                    id: row.get(0)?,
                    product_mp_id: row.get(1)?,
                    product_mp_name: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    lot_mp_id: row.get(3)?,
                    lot_mp_number: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                    quantity: row.get(5)?,
                    unit: row.get(6)?,
                    consumed_at: row.get(7)?,
                })
            })
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for consumption in consumptions {
            result.push(consumption.map_err(|e| Error::Database(e.to_string()))?);
        }
        Ok(result)
    }

    fn row_to_dto(row: &Row) -> rusqlite::Result<ProductionOrderDto> {
        Ok(ProductionOrderDto {
            id: row.get(0)?,
            reference: row.get(1)?,
            product_pf_id: row.get(2)?,
            product_pf_name: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            product_pf_code: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            recipe_id: row.get(5)?,
            recipe_name: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
            batch_count: row.get(7)?,
            target_quantity: row.get(8)?,
            actual_quantity: row.get(9)?,
            status: ProductionStatus::from(row.get::<_, String>(10)?.as_str()),
            scheduled_date: row.get(11)?,
            started_at: row.get(12)?,
            completed_at: row.get(13)?,
            notes: row.get(14)?,
            yield_percentage: row.get(15)?,
            consumptions: Vec::new(), // Will be populated separately
            lot_pf_id: row.get(16)?,
            lot_pf_number: row.get(17)?,
            created_at: row.get(18)?,
            created_by: row.get(19)?,
            qr_code: row.get(20)?,
        })
    }
}
