//! Supplier Repository
//!
//! Data access for Supplier entities.

use manchengo_core::{Error, Result};
use manchengo_database::Database;
use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Supplier DTO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierDto {
    pub id: String,
    pub code: String,
    pub name: String,
    pub contact_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub commune: Option<String>,
    pub wilaya_code: Option<String>,
    pub nif: Option<String>,
    pub nis: Option<String>,
    pub rc: Option<String>,
    pub article_imposition: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

/// Create supplier request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSupplierDto {
    pub name: String,
    pub contact_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub commune: Option<String>,
    pub wilaya_code: Option<String>,
    pub nif: Option<String>,
    pub nis: Option<String>,
    pub rc: Option<String>,
    pub article_imposition: Option<String>,
}

/// Supplier repository
pub struct SupplierRepository {
    db: Arc<Database>,
}

impl SupplierRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// List all suppliers
    pub fn list(&self, active_only: bool) -> Result<Vec<SupplierDto>> {
        self.db.with_connection(|conn| {
            let sql = if active_only {
                "SELECT id, code, name, contact_name, phone, email,
                        address_line1, address_line2, commune, wilaya_code,
                        nif, nis, rc, article_imposition, is_active, created_at
                 FROM suppliers WHERE is_active = 1 ORDER BY name"
            } else {
                "SELECT id, code, name, contact_name, phone, email,
                        address_line1, address_line2, commune, wilaya_code,
                        nif, nis, rc, article_imposition, is_active, created_at
                 FROM suppliers ORDER BY name"
            };

            let mut stmt = conn.prepare(sql).map_err(|e| Error::Database(e.to_string()))?;
            let suppliers = stmt.query_map([], |row| Self::row_to_dto(row))
                .map_err(|e| Error::Database(e.to_string()))?;

            let mut result = Vec::new();
            for supplier in suppliers {
                result.push(supplier.map_err(|e| Error::Database(e.to_string()))?);
            }
            Ok(result)
        })
    }

    /// Get supplier by ID
    pub fn get(&self, id: &str) -> Result<Option<SupplierDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, code, name, contact_name, phone, email,
                        address_line1, address_line2, commune, wilaya_code,
                        nif, nis, rc, article_imposition, is_active, created_at
                 FROM suppliers WHERE id = ?"
            ).map_err(|e| Error::Database(e.to_string()))?;

            match stmt.query_row([id], |row| Self::row_to_dto(row)) {
                Ok(dto) => Ok(Some(dto)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(Error::Database(e.to_string())),
            }
        })
    }

    /// Create new supplier
    pub fn create(&self, id: &str, code: &str, data: &CreateSupplierDto) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO suppliers (id, code, name, contact_name, phone, email,
                    address_line1, address_line2, commune, wilaya_code,
                    nif, nis, rc, article_imposition, is_active, created_at, created_by, updated_at, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), 'system', datetime('now'), 'system')",
                params![
                    id,
                    code,
                    data.name,
                    data.contact_name,
                    data.phone,
                    data.email,
                    data.address_line1,
                    data.address_line2,
                    data.commune,
                    data.wilaya_code,
                    data.nif,
                    data.nis,
                    data.rc,
                    data.article_imposition
                ]
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Update supplier
    pub fn update(&self, id: &str, data: &CreateSupplierDto) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE suppliers SET
                    name = ?, contact_name = ?, phone = ?, email = ?,
                    address_line1 = ?, address_line2 = ?, commune = ?, wilaya_code = ?,
                    nif = ?, nis = ?, rc = ?, article_imposition = ?,
                    updated_at = datetime('now')
                 WHERE id = ?",
                params![
                    data.name,
                    data.contact_name,
                    data.phone,
                    data.email,
                    data.address_line1,
                    data.address_line2,
                    data.commune,
                    data.wilaya_code,
                    data.nif,
                    data.nis,
                    data.rc,
                    data.article_imposition,
                    id
                ]
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Deactivate supplier
    pub fn deactivate(&self, id: &str) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE suppliers SET is_active = 0, updated_at = datetime('now') WHERE id = ?",
                [id]
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Generate next supplier code
    pub fn generate_code(&self) -> Result<String> {
        self.db.with_connection(|conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM suppliers",
                [],
                |row| row.get(0)
            ).map_err(|e| Error::Database(e.to_string()))?;

            Ok(format!("FOUR-{:04}", count + 1))
        })
    }

    /// Count suppliers
    pub fn count(&self) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM suppliers WHERE is_active = 1",
                [],
                |row| row.get(0)
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    fn row_to_dto(row: &Row) -> rusqlite::Result<SupplierDto> {
        Ok(SupplierDto {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            contact_name: row.get(3)?,
            phone: row.get(4)?,
            email: row.get(5)?,
            address_line1: row.get(6)?,
            address_line2: row.get(7)?,
            commune: row.get(8)?,
            wilaya_code: row.get(9)?,
            nif: row.get(10)?,
            nis: row.get(11)?,
            rc: row.get(12)?,
            article_imposition: row.get(13)?,
            is_active: row.get::<_, i32>(14)? == 1,
            created_at: row.get(15)?,
        })
    }
}
