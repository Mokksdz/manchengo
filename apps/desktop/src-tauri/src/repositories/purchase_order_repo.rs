//! Purchase Order Repository
//!
//! Data access for PurchaseOrder and PurchaseOrderLine entities.

use manchengo_core::{Error, Result};
use manchengo_database::Database;
use rusqlite::{params, Row, OptionalExtension};
use std::sync::Arc;

use crate::dto::appro::*;

/// Purchase order repository for CRUD operations
pub struct PurchaseOrderRepository {
    db: Arc<Database>,
}

impl PurchaseOrderRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// List purchase orders with optional filter
    pub fn list(&self, filter: PurchaseOrderFilter) -> Result<Vec<PurchaseOrderDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT po.id, po.reference, po.supplier_id,
                        s.name as supplier_name, s.code as supplier_code,
                        po.status, po.expected_delivery, po.received_date,
                        po.total_amount, po.notes,
                        po.created_at, po.updated_at
                 FROM purchase_orders po
                 LEFT JOIN suppliers s ON s.id = po.supplier_id
                 WHERE po.is_deleted = 0",
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(ref status) = filter.status {
                sql.push_str(" AND po.status = ?");
                params_vec.push(Box::new(status.clone()));
            }

            if let Some(ref supplier_id) = filter.supplier_id {
                sql.push_str(" AND po.supplier_id = ?");
                params_vec.push(Box::new(supplier_id.clone()));
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

            let mut result: Vec<PurchaseOrderDto> = Vec::new();

            if params_vec.is_empty() {
                let orders = stmt
                    .query_map([], |row| Self::row_to_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for order in orders {
                    let mut dto = order.map_err(|e| Error::Database(e.to_string()))?;
                    dto.lines = self.get_lines_internal(conn, &dto.id)?;
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
                    dto.lines = self.get_lines_internal(conn, &dto.id)?;
                    result.push(dto);
                }
            }

            Ok(result)
        })
    }

    /// Get single purchase order by ID
    pub fn get(&self, id: &str) -> Result<Option<PurchaseOrderDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT po.id, po.reference, po.supplier_id,
                            s.name as supplier_name, s.code as supplier_code,
                            po.status, po.expected_delivery, po.received_date,
                            po.total_amount, po.notes,
                            po.created_at, po.updated_at
                     FROM purchase_orders po
                     LEFT JOIN suppliers s ON s.id = po.supplier_id
                     WHERE po.id = ? AND po.is_deleted = 0",
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            let order = stmt
                .query_row([id], |row| Self::row_to_dto(row))
                .optional()
                .map_err(|e| Error::Database(e.to_string()))?;

            if let Some(mut dto) = order {
                dto.lines = self.get_lines_internal(conn, &dto.id)?;
                Ok(Some(dto))
            } else {
                Ok(None)
            }
        })
    }

    /// Create new purchase order
    pub fn create(&self, id: &str, reference: &str, data: &CreatePurchaseOrderDto) -> Result<()> {
        self.db.with_connection(|conn| {
            // Calculate total
            let total: i64 = data
                .lines
                .iter()
                .map(|l| (l.unit_price * l.quantity as f64) as i64)
                .sum();

            conn.execute(
                "INSERT INTO purchase_orders (
                    id, reference, supplier_id, status, expected_delivery,
                    total_amount, notes, created_at, is_deleted
                ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, datetime('now'), 0)",
                params![
                    id,
                    reference,
                    data.supplier_id,
                    data.expected_delivery,
                    total,
                    data.notes,
                ],
            )
            .map_err(|e| Error::Database(e.to_string()))?;

            // Insert lines
            for (idx, line) in data.lines.iter().enumerate() {
                let line_id = manchengo_core::EntityId::new().to_string();
                conn.execute(
                    "INSERT INTO purchase_order_lines (
                        id, purchase_order_id, product_mp_id, quantity,
                        unit_price, line_total, sort_order
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    params![
                        line_id,
                        id,
                        line.product_mp_id,
                        line.quantity,
                        line.unit_price,
                        (line.unit_price * line.quantity as f64) as i64,
                        idx + 1,
                    ],
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            }

            Ok(())
        })
    }

    /// Update status
    pub fn update_status(&self, id: &str, status: &str) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?",
                params![status, id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Mark as received
    pub fn mark_received(&self, id: &str) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE purchase_orders SET
                    status = 'RECEIVED',
                    received_date = datetime('now'),
                    updated_at = datetime('now')
                 WHERE id = ?",
                [id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Cancel order
    pub fn cancel(&self, id: &str) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE purchase_orders SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?",
                [id],
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
                    "SELECT COUNT(*) FROM purchase_orders WHERE reference LIKE ?",
                    [format!("BC-{}-%%", today)],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(format!("BC-{}-{:03}", today, count + 1))
        })
    }

    /// Count by status
    pub fn count_by_status(&self, status: &str) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM purchase_orders WHERE status = ? AND is_deleted = 0",
                    [status],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    // Internal helpers

    fn get_lines_internal(
        &self,
        conn: &rusqlite::Connection,
        order_id: &str,
    ) -> Result<Vec<PurchaseOrderLineDto>> {
        let mut stmt = conn
            .prepare(
                "SELECT pol.id, pol.product_mp_id, mp.name as mp_name, mp.code as mp_code,
                        pol.quantity, pol.quantity_received, pol.unit_price, pol.line_total
                 FROM purchase_order_lines pol
                 LEFT JOIN products_mp mp ON mp.id = pol.product_mp_id
                 WHERE pol.purchase_order_id = ?
                 ORDER BY pol.sort_order ASC",
            )
            .map_err(|e| Error::Database(e.to_string()))?;

        let lines = stmt
            .query_map([order_id], |row| {
                Ok(PurchaseOrderLineDto {
                    id: row.get(0)?,
                    product_mp_id: row.get(1)?,
                    product_mp_name: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    product_mp_code: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    quantity: row.get(4)?,
                    quantity_received: row.get(5)?,
                    unit_price: row.get(6)?,
                    line_total: row.get(7)?,
                })
            })
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for line in lines {
            result.push(line.map_err(|e| Error::Database(e.to_string()))?);
        }
        Ok(result)
    }

    fn row_to_dto(row: &Row) -> rusqlite::Result<PurchaseOrderDto> {
        Ok(PurchaseOrderDto {
            id: row.get(0)?,
            reference: row.get(1)?,
            supplier_id: row.get(2)?,
            supplier_name: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            supplier_code: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            status: PurchaseOrderStatus::from(row.get::<_, String>(5)?.as_str()),
            expected_delivery: row.get(6)?,
            received_date: row.get(7)?,
            total_amount: row.get(8)?,
            notes: row.get(9)?,
            lines: Vec::new(), // Will be populated separately
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    }
}
