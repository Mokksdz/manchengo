//! Client Repository
//!
//! Data access for Client entity.

use manchengo_core::{Error, Result};
use manchengo_database::Database;
use rusqlite::{params, Row, OptionalExtension};
use std::sync::Arc;

use crate::dto::commercial::*;

/// Client repository for CRUD operations
pub struct ClientRepository {
    db: Arc<Database>,
}

impl ClientRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// List clients with optional filter
    pub fn list(&self, filter: ClientFilter) -> Result<Vec<ClientDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT id, code, name, company_name, email, phone, address,
                        wilaya, client_type, nif, rc, ai, is_active,
                        credit_limit, current_balance, notes,
                        created_at, updated_at
                 FROM clients
                 WHERE is_deleted = 0",
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(active_only) = filter.active_only {
                if active_only {
                    sql.push_str(" AND is_active = 1");
                }
            }

            if let Some(ref client_type) = filter.client_type {
                sql.push_str(" AND client_type = ?");
                params_vec.push(Box::new(client_type.clone()));
            }

            if let Some(ref wilaya) = filter.wilaya {
                sql.push_str(" AND wilaya = ?");
                params_vec.push(Box::new(wilaya.clone()));
            }

            if let Some(ref search) = filter.search {
                sql.push_str(" AND (name LIKE ? OR code LIKE ? OR company_name LIKE ? OR phone LIKE ?)");
                let search_pattern = format!("%{}%", search);
                params_vec.push(Box::new(search_pattern.clone()));
                params_vec.push(Box::new(search_pattern.clone()));
                params_vec.push(Box::new(search_pattern.clone()));
                params_vec.push(Box::new(search_pattern));
            }

            sql.push_str(" ORDER BY name ASC");

            if let Some(limit) = filter.limit {
                sql.push_str(&format!(" LIMIT {}", limit));
            } else {
                sql.push_str(" LIMIT 200");
            }

            let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

            let mut result: Vec<ClientDto> = Vec::new();

            if params_vec.is_empty() {
                let clients = stmt
                    .query_map([], |row| Self::row_to_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for client in clients {
                    result.push(client.map_err(|e| Error::Database(e.to_string()))?);
                }
            } else {
                let params_refs: Vec<&dyn rusqlite::ToSql> =
                    params_vec.iter().map(|p| p.as_ref()).collect();
                let clients = stmt
                    .query_map(params_refs.as_slice(), |row| Self::row_to_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for client in clients {
                    result.push(client.map_err(|e| Error::Database(e.to_string()))?);
                }
            }

            Ok(result)
        })
    }

    /// Get single client by ID
    pub fn get(&self, id: &str) -> Result<Option<ClientDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT id, code, name, company_name, email, phone, address,
                            wilaya, client_type, nif, rc, ai, is_active,
                            credit_limit, current_balance, notes,
                            created_at, updated_at
                     FROM clients
                     WHERE id = ? AND is_deleted = 0",
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            stmt.query_row([id], |row| Self::row_to_dto(row))
                .optional()
                .map_err(|e| Error::Database(e.to_string()))
        })
    }

    /// Create new client
    pub fn create(&self, id: &str, code: &str, data: &CreateClientDto) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO clients (
                    id, code, name, company_name, email, phone, address,
                    wilaya, client_type, nif, rc, ai, is_active,
                    credit_limit, current_balance, notes,
                    created_at, is_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?, datetime('now'), 0)",
                params![
                    id,
                    code,
                    data.name,
                    data.company_name,
                    data.email,
                    data.phone,
                    data.address,
                    data.wilaya,
                    data.client_type.as_deref().unwrap_or("STANDARD"),
                    data.nif,
                    data.rc,
                    data.ai,
                    data.credit_limit.unwrap_or(0),
                    data.notes,
                ],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Update client
    pub fn update(&self, id: &str, data: &CreateClientDto) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE clients SET
                    name = ?, company_name = ?, email = ?, phone = ?,
                    address = ?, wilaya = ?, client_type = ?,
                    nif = ?, rc = ?, ai = ?, credit_limit = ?, notes = ?,
                    updated_at = datetime('now')
                 WHERE id = ?",
                params![
                    data.name,
                    data.company_name,
                    data.email,
                    data.phone,
                    data.address,
                    data.wilaya,
                    data.client_type.as_deref().unwrap_or("STANDARD"),
                    data.nif,
                    data.rc,
                    data.ai,
                    data.credit_limit.unwrap_or(0),
                    data.notes,
                    id,
                ],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Soft delete client
    pub fn delete(&self, id: &str) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE clients SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?",
                [id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Update client balance
    pub fn update_balance(&self, id: &str, amount: i64) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE clients SET
                    current_balance = current_balance + ?,
                    updated_at = datetime('now')
                 WHERE id = ?",
                params![amount, id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Get client balance
    pub fn get_balance(&self, id: &str) -> Result<i64> {
        self.db.with_connection(|conn| {
            let balance: i64 = conn
                .query_row(
                    "SELECT current_balance FROM clients WHERE id = ?",
                    [id],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(balance)
        })
    }

    /// Generate unique client code
    pub fn generate_code(&self) -> Result<String> {
        self.db.with_connection(|conn| {
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM clients", [], |row| row.get(0))
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(format!("CLI-{:05}", count + 1))
        })
    }

    /// Count clients
    pub fn count(&self) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM clients WHERE is_deleted = 0",
                    [],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    fn row_to_dto(row: &Row) -> rusqlite::Result<ClientDto> {
        Ok(ClientDto {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            company_name: row.get(3)?,
            email: row.get(4)?,
            phone: row.get(5)?,
            address: row.get(6)?,
            wilaya: row.get(7)?,
            client_type: row.get(8)?,
            nif: row.get(9)?,
            rc: row.get(10)?,
            ai: row.get(11)?,
            is_active: row.get(12)?,
            credit_limit: row.get(13)?,
            current_balance: row.get(14)?,
            notes: row.get(15)?,
            created_at: row.get(16)?,
            updated_at: row.get(17)?,
        })
    }
}
