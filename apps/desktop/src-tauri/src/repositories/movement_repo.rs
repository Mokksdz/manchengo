//! Stock Movement Repository
//!
//! Data access for StockMovement - the immutable audit trail.

use manchengo_core::{Error, Result};
use manchengo_database::Database;
use rusqlite::{params, Row};
use std::sync::Arc;

use crate::dto::{MovementDto, MovementFilter, MovementOrigin, MovementType};

/// Stock movement repository (append-only for audit)
pub struct MovementRepository {
    db: Arc<Database>,
}

impl MovementRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// Create new stock movement (immutable - cannot be updated/deleted)
    pub fn create(
        &self,
        id: &str,
        movement_type: &str, // "IN" or "OUT"
        product_type: &str,  // "MP" or "PF"
        product_id: &str,
        lot_id: Option<&str>,
        quantity: f64,
        unit_cost: Option<i64>,
        origin: &str,
        reference_type: Option<&str>,
        reference_id: Option<&str>,
        user_id: &str,
        idempotency_key: &str,
        note: Option<&str>,
    ) -> Result<()> {
        self.db.with_connection(|conn| {
            // Check idempotency to prevent duplicates
            let exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM stock_movements WHERE idempotency_key = ?)",
                [idempotency_key],
                |row| row.get(0)
            ).map_err(|e| Error::Database(e.to_string()))?;

            if exists {
                tracing::warn!("Duplicate movement detected: {}", idempotency_key);
                return Ok(());
            }

            // Insert based on product type
            if product_type == "MP" {
                conn.execute(
                    "INSERT INTO stock_movements (
                        id, movement_type, product_type, product_mp_id, lot_mp_id,
                        quantity, unit_cost, origin, reference_type, reference_id,
                        user_id, idempotency_key, note, created_at, is_deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)",
                    params![
                        id, movement_type, product_type, product_id, lot_id,
                        quantity, unit_cost, origin, reference_type, reference_id,
                        user_id, idempotency_key, note
                    ]
                ).map_err(|e| Error::Database(e.to_string()))?;
            } else {
                conn.execute(
                    "INSERT INTO stock_movements (
                        id, movement_type, product_type, product_pf_id, lot_pf_id,
                        quantity, unit_cost, origin, reference_type, reference_id,
                        user_id, idempotency_key, note, created_at, is_deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)",
                    params![
                        id, movement_type, product_type, product_id, lot_id,
                        quantity, unit_cost, origin, reference_type, reference_id,
                        user_id, idempotency_key, note
                    ]
                ).map_err(|e| Error::Database(e.to_string()))?;
            }

            Ok(())
        })
    }

    /// List movements with filters
    pub fn list(&self, filter: MovementFilter) -> Result<Vec<MovementDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT
                    m.id, m.movement_type, m.product_type,
                    COALESCE(m.product_mp_id, m.product_pf_id) as product_id,
                    COALESCE(pmp.code, ppf.code) as product_code,
                    COALESCE(pmp.name, ppf.name) as product_name,
                    COALESCE(m.lot_mp_id, m.lot_pf_id) as lot_id,
                    COALESCE(lmp.lot_number, lpf.lot_number) as lot_number,
                    m.quantity,
                    COALESCE(pmp.unit, ppf.unit) as unit,
                    m.unit_cost, m.origin, m.reference_type, m.reference_id,
                    m.user_id, u.name as user_name, m.created_at, m.note
                 FROM stock_movements m
                 LEFT JOIN products_mp pmp ON pmp.id = m.product_mp_id
                 LEFT JOIN products_pf ppf ON ppf.id = m.product_pf_id
                 LEFT JOIN lots_mp lmp ON lmp.id = m.lot_mp_id
                 LEFT JOIN lots_pf lpf ON lpf.id = m.lot_pf_id
                 LEFT JOIN users u ON u.id = m.user_id
                 WHERE m.is_deleted = 0"
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(ref product_type) = filter.product_type {
                sql.push_str(" AND m.product_type = ?");
                params_vec.push(Box::new(product_type.clone()));
            }

            if let Some(ref product_id) = filter.product_id {
                sql.push_str(" AND (m.product_mp_id = ? OR m.product_pf_id = ?)");
                params_vec.push(Box::new(product_id.clone()));
                params_vec.push(Box::new(product_id.clone()));
            }

            if let Some(ref movement_type) = filter.movement_type {
                sql.push_str(" AND m.movement_type = ?");
                params_vec.push(Box::new(movement_type.clone()));
            }

            if let Some(ref origin) = filter.origin {
                sql.push_str(" AND m.origin = ?");
                params_vec.push(Box::new(origin.clone()));
            }

            if let Some(ref from_date) = filter.from_date {
                sql.push_str(" AND m.created_at >= ?");
                params_vec.push(Box::new(from_date.clone()));
            }

            if let Some(ref to_date) = filter.to_date {
                sql.push_str(" AND m.created_at <= ?");
                params_vec.push(Box::new(to_date.clone()));
            }

            sql.push_str(" ORDER BY m.created_at DESC");

            if let Some(limit) = filter.limit {
                sql.push_str(&format!(" LIMIT {}", limit));
            } else {
                sql.push_str(" LIMIT 100");
            }

            let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

            let mut result: Vec<MovementDto> = Vec::new();
            if params_vec.is_empty() {
                let movements = stmt.query_map([], |row| Self::row_to_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for movement in movements {
                    result.push(movement.map_err(|e| Error::Database(e.to_string()))?);
                }
            } else {
                let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
                let movements = stmt.query_map(params_refs.as_slice(), |row| Self::row_to_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for movement in movements {
                    result.push(movement.map_err(|e| Error::Database(e.to_string()))?);
                }
            }
            Ok(result)
        })
    }

    /// Get movement history for a specific product
    pub fn get_product_history(
        &self,
        product_type: &str,
        product_id: &str,
        limit: u32,
    ) -> Result<Vec<MovementDto>> {
        self.list(MovementFilter {
            product_type: Some(product_type.to_string()),
            product_id: Some(product_id.to_string()),
            limit: Some(limit),
            ..Default::default()
        })
    }

    /// Calculate current stock for a product (SUM(IN) - SUM(OUT))
    pub fn calculate_stock(&self, product_type: &str, product_id: &str) -> Result<f64> {
        self.db.with_connection(|conn| {
            let column = if product_type == "MP" {
                "product_mp_id"
            } else {
                "product_pf_id"
            };

            let stock: f64 = conn.query_row(
                &format!(
                    "SELECT COALESCE(
                        SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE -quantity END),
                        0
                    )
                    FROM stock_movements
                    WHERE {} = ? AND is_deleted = 0",
                    column
                ),
                [product_id],
                |row| row.get(0)
            ).map_err(|e| Error::Database(e.to_string()))?;

            Ok(stock)
        })
    }

    /// Count total movements
    pub fn count(&self) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM stock_movements WHERE is_deleted = 0",
                [],
                |row| row.get(0)
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    fn row_to_dto(row: &Row) -> rusqlite::Result<MovementDto> {
        Ok(MovementDto {
            id: row.get(0)?,
            movement_type: if row.get::<_, String>(1)? == "IN" {
                MovementType::In
            } else {
                MovementType::Out
            },
            product_type: row.get(2)?,
            product_id: row.get(3)?,
            product_code: row.get(4)?,
            product_name: row.get(5)?,
            lot_id: row.get(6)?,
            lot_number: row.get(7)?,
            quantity: row.get(8)?,
            unit: row.get(9)?,
            unit_cost: row.get(10)?,
            origin: MovementOrigin::from(row.get::<_, String>(11)?.as_str()),
            reference_type: row.get(12)?,
            reference_id: row.get(13)?,
            user_id: row.get(14)?,
            user_name: row.get(15)?,
            created_at: row.get(16)?,
            note: row.get(17)?,
        })
    }
}
