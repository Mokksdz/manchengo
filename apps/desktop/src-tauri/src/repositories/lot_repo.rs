//! Lot Repository
//!
//! Data access for LotMp and LotPf entities with FIFO support.

use chrono::{NaiveDate, Utc};
use manchengo_core::{Error, Result};
use manchengo_database::Database;
use rusqlite::{params, Row};
use std::sync::Arc;

use crate::dto::{ExpiringLotDto, LotFilter, LotMpDto, LotPfDto, LotStatus};

/// Lot repository with FIFO queries
pub struct LotRepository {
    db: Arc<Database>,
}

impl LotRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    // =========================================================================
    // LOT MP
    // =========================================================================

    /// Get lots ordered by FIFO (oldest reception first, earliest expiry first)
    /// This is the CRITICAL method for FIFO consumption
    pub fn get_available_fifo(&self, product_id: &str) -> Result<Vec<LotMpDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT
                    l.id, l.lot_number, l.product_mp_id,
                    p.code as product_code, p.name as product_name,
                    l.quantity_initial, l.quantity_remaining, p.unit,
                    l.unit_cost, l.total_cost, l.status,
                    l.supplier_id, s.name as supplier_name,
                    l.reception_date, l.expiry_date, l.qr_code
                 FROM lots_mp l
                 JOIN products_mp p ON p.id = l.product_mp_id
                 LEFT JOIN suppliers s ON s.id = l.supplier_id
                 WHERE l.product_mp_id = ?
                   AND l.status = 'AVAILABLE'
                   AND l.quantity_remaining > 0
                 ORDER BY l.reception_date ASC, l.expiry_date ASC NULLS LAST, l.id ASC"
            ).map_err(|e| Error::Database(e.to_string()))?;

            let lots = stmt.query_map([product_id], |row| Self::row_to_mp_dto(row))
                .map_err(|e| Error::Database(e.to_string()))?;

            let mut result = Vec::new();
            for lot in lots {
                result.push(lot.map_err(|e| Error::Database(e.to_string()))?);
            }
            Ok(result)
        })
    }

    /// List lots with filters
    pub fn list_mp(&self, filter: LotFilter) -> Result<Vec<LotMpDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT
                    l.id, l.lot_number, l.product_mp_id,
                    p.code as product_code, p.name as product_name,
                    l.quantity_initial, l.quantity_remaining, p.unit,
                    l.unit_cost, l.total_cost, l.status,
                    l.supplier_id, s.name as supplier_name,
                    l.reception_date, l.expiry_date, l.qr_code
                 FROM lots_mp l
                 JOIN products_mp p ON p.id = l.product_mp_id
                 LEFT JOIN suppliers s ON s.id = l.supplier_id
                 WHERE 1=1"
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(ref product_id) = filter.product_id {
                sql.push_str(" AND l.product_mp_id = ?");
                params_vec.push(Box::new(product_id.clone()));
            }

            if let Some(ref status) = filter.status {
                sql.push_str(" AND l.status = ?");
                params_vec.push(Box::new(status.clone()));
            }

            if let Some(days) = filter.expiring_within_days {
                sql.push_str(" AND l.expiry_date IS NOT NULL AND l.expiry_date <= date('now', '+' || ? || ' days')");
                params_vec.push(Box::new(days));
            }

            sql.push_str(" ORDER BY l.reception_date DESC");

            let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

            let mut result: Vec<LotMpDto> = Vec::new();
            if params_vec.is_empty() {
                let lots = stmt.query_map([], |row| Self::row_to_mp_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for lot in lots {
                    result.push(lot.map_err(|e| Error::Database(e.to_string()))?);
                }
            } else {
                let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
                let lots = stmt.query_map(params_refs.as_slice(), |row| Self::row_to_mp_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for lot in lots {
                    result.push(lot.map_err(|e| Error::Database(e.to_string()))?);
                }
            }
            Ok(result)
        })
    }

    /// Get lot by ID
    pub fn get_mp(&self, id: &str) -> Result<Option<LotMpDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT
                    l.id, l.lot_number, l.product_mp_id,
                    p.code as product_code, p.name as product_name,
                    l.quantity_initial, l.quantity_remaining, p.unit,
                    l.unit_cost, l.total_cost, l.status,
                    l.supplier_id, s.name as supplier_name,
                    l.reception_date, l.expiry_date, l.qr_code
                 FROM lots_mp l
                 JOIN products_mp p ON p.id = l.product_mp_id
                 LEFT JOIN suppliers s ON s.id = l.supplier_id
                 WHERE l.id = ?"
            ).map_err(|e| Error::Database(e.to_string()))?;

            match stmt.query_row([id], |row| Self::row_to_mp_dto(row)) {
                Ok(dto) => Ok(Some(dto)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(Error::Database(e.to_string())),
            }
        })
    }

    /// Create new lot
    pub fn create_mp(
        &self,
        id: &str,
        lot_number: &str,
        product_id: &str,
        supplier_id: Option<&str>,
        quantity: f64,
        unit_cost: i64,
        reception_date: &str,
        expiry_date: Option<&str>,
    ) -> Result<()> {
        self.db.with_connection(|conn| {
            let total_cost = (quantity * unit_cost as f64) as i64;

            conn.execute(
                "INSERT INTO lots_mp (id, lot_number, product_mp_id, supplier_id, quantity_initial, quantity_remaining, unit_cost, total_cost, status, reception_date, expiry_date, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, datetime('now'))",
                params![
                    id,
                    lot_number,
                    product_id,
                    supplier_id,
                    quantity,
                    quantity,
                    unit_cost,
                    total_cost,
                    reception_date,
                    expiry_date
                ]
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Update lot quantity (for FIFO consumption)
    pub fn update_quantity_mp(&self, id: &str, new_quantity: f64) -> Result<()> {
        self.db.with_connection(|conn| {
            let status = if new_quantity <= 0.0 { "CONSUMED" } else { "AVAILABLE" };

            conn.execute(
                "UPDATE lots_mp SET quantity_remaining = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
                params![new_quantity, status, id]
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Block/unblock lot
    pub fn set_status_mp(&self, id: &str, status: &str) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE lots_mp SET status = ?, updated_at = datetime('now') WHERE id = ?",
                params![status, id]
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Count lots MP
    pub fn count_mp(&self) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM lots_mp WHERE status = 'AVAILABLE'",
                [],
                |row| row.get(0)
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    /// Get expiring lots within N days
    pub fn get_expiring(&self, days: i32) -> Result<Vec<ExpiringLotDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT
                    l.id, l.lot_number, l.product_mp_id,
                    p.name as product_name, 'MP' as product_type,
                    l.quantity_remaining, p.unit, l.expiry_date,
                    julianday(l.expiry_date) - julianday('now') as days_until
                 FROM lots_mp l
                 JOIN products_mp p ON p.id = l.product_mp_id
                 WHERE l.status = 'AVAILABLE'
                   AND l.expiry_date IS NOT NULL
                   AND l.expiry_date <= date('now', '+' || ? || ' days')
                 UNION ALL
                 SELECT
                    l.id, l.lot_number, l.product_pf_id,
                    p.name as product_name, 'PF' as product_type,
                    l.quantity_remaining, p.unit, l.expiry_date,
                    julianday(l.expiry_date) - julianday('now') as days_until
                 FROM lots_pf l
                 JOIN products_pf p ON p.id = l.product_pf_id
                 WHERE l.status = 'AVAILABLE'
                   AND l.expiry_date IS NOT NULL
                   AND l.expiry_date <= date('now', '+' || ? || ' days')
                 ORDER BY days_until ASC"
            ).map_err(|e| Error::Database(e.to_string()))?;

            let lots = stmt.query_map([days, days], |row| {
                let days_until: f64 = row.get(8)?;
                let days_int = days_until.ceil() as i32;

                Ok(ExpiringLotDto {
                    lot_id: row.get(0)?,
                    lot_number: row.get(1)?,
                    product_id: row.get(2)?,
                    product_name: row.get(3)?,
                    product_type: row.get(4)?,
                    quantity_remaining: row.get(5)?,
                    unit: row.get(6)?,
                    expiry_date: row.get(7)?,
                    days_until_expiry: days_int,
                    is_critical: days_int <= 7,
                })
            }).map_err(|e| Error::Database(e.to_string()))?;

            let mut result = Vec::new();
            for lot in lots {
                result.push(lot.map_err(|e| Error::Database(e.to_string()))?);
            }
            Ok(result)
        })
    }

    fn row_to_mp_dto(row: &Row) -> rusqlite::Result<LotMpDto> {
        let expiry_date: Option<String> = row.get(14)?;
        let reception_date: String = row.get(13)?;

        // Calculate days until expiry
        let (is_expired, days_until) = if let Some(ref exp) = expiry_date {
            if let Ok(exp_date) = NaiveDate::parse_from_str(exp, "%Y-%m-%d") {
                let today = Utc::now().date_naive();
                let days = (exp_date - today).num_days() as i32;
                (days < 0, Some(days))
            } else {
                (false, None)
            }
        } else {
            (false, None)
        };

        Ok(LotMpDto {
            id: row.get(0)?,
            lot_number: row.get(1)?,
            product_id: row.get(2)?,
            product_code: row.get(3)?,
            product_name: row.get(4)?,
            quantity_initial: row.get(5)?,
            quantity_remaining: row.get(6)?,
            unit: row.get(7)?,
            unit_cost: row.get(8)?,
            total_cost: row.get(9)?,
            status: LotStatus::from(row.get::<_, String>(10)?.as_str()),
            supplier_id: row.get(11)?,
            supplier_name: row.get(12)?,
            reception_date,
            expiry_date,
            is_expired,
            days_until_expiry: days_until,
            qr_code: row.get(15)?,
        })
    }

    // =========================================================================
    // LOT PF
    // =========================================================================

    /// List PF lots
    pub fn list_pf(&self, filter: LotFilter) -> Result<Vec<LotPfDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT
                    l.id, l.lot_number, l.product_pf_id,
                    p.code as product_code, p.name as product_name,
                    l.quantity_initial, l.quantity_remaining, p.unit,
                    l.status, l.production_order_id,
                    l.production_date, l.expiry_date, l.qr_code
                 FROM lots_pf l
                 JOIN products_pf p ON p.id = l.product_pf_id
                 WHERE 1=1"
            );

            if let Some(ref product_id) = filter.product_id {
                sql.push_str(&format!(" AND l.product_pf_id = '{}'", product_id));
            }

            if let Some(ref status) = filter.status {
                sql.push_str(&format!(" AND l.status = '{}'", status));
            }

            sql.push_str(" ORDER BY l.production_date DESC");

            let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;
            let lots = stmt.query_map([], |row| Self::row_to_pf_dto(row))
                .map_err(|e| Error::Database(e.to_string()))?;

            let mut result = Vec::new();
            for lot in lots {
                result.push(lot.map_err(|e| Error::Database(e.to_string()))?);
            }
            Ok(result)
        })
    }

    /// Get PF lot by ID
    pub fn get_pf(&self, id: &str) -> Result<Option<LotPfDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT
                    l.id, l.lot_number, l.product_pf_id,
                    p.code as product_code, p.name as product_name,
                    l.quantity_initial, l.quantity_remaining, p.unit,
                    l.status, l.production_order_id,
                    l.production_date, l.expiry_date, l.qr_code
                 FROM lots_pf l
                 JOIN products_pf p ON p.id = l.product_pf_id
                 WHERE l.id = ?"
            ).map_err(|e| Error::Database(e.to_string()))?;

            match stmt.query_row([id], |row| Self::row_to_pf_dto(row)) {
                Ok(dto) => Ok(Some(dto)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(Error::Database(e.to_string())),
            }
        })
    }

    /// Create PF lot (from production)
    pub fn create_pf(
        &self,
        id: &str,
        lot_number: &str,
        product_id: &str,
        production_order_id: &str,
        quantity: f64,
        production_date: &str,
        expiry_date: Option<&str>,
    ) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO lots_pf (id, lot_number, product_pf_id, production_order_id, quantity_initial, quantity_remaining, status, production_date, expiry_date, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, datetime('now'))",
                params![
                    id,
                    lot_number,
                    product_id,
                    production_order_id,
                    quantity,
                    quantity,
                    production_date,
                    expiry_date
                ]
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Count PF lots
    pub fn count_pf(&self) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM lots_pf WHERE status = 'AVAILABLE'",
                [],
                |row| row.get(0)
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    fn row_to_pf_dto(row: &Row) -> rusqlite::Result<LotPfDto> {
        let expiry_date: Option<String> = row.get(11)?;
        let production_date: String = row.get(10)?;

        let (is_expired, days_until) = if let Some(ref exp) = expiry_date {
            if let Ok(exp_date) = NaiveDate::parse_from_str(exp, "%Y-%m-%d") {
                let today = Utc::now().date_naive();
                let days = (exp_date - today).num_days() as i32;
                (days < 0, Some(days))
            } else {
                (false, None)
            }
        } else {
            (false, None)
        };

        Ok(LotPfDto {
            id: row.get(0)?,
            lot_number: row.get(1)?,
            product_id: row.get(2)?,
            product_code: row.get(3)?,
            product_name: row.get(4)?,
            quantity_initial: row.get(5)?,
            quantity_remaining: row.get(6)?,
            unit: row.get(7)?,
            status: LotStatus::from(row.get::<_, String>(8)?.as_str()),
            production_order_id: row.get(9)?,
            production_date,
            expiry_date,
            is_expired,
            days_until_expiry: days_until,
            qr_code: row.get(12)?,
        })
    }
}
