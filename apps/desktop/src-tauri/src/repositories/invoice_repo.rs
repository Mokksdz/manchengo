//! Invoice Repository
//!
//! Data access for Invoice and InvoiceLine entities.

use manchengo_core::{Error, Result};
use manchengo_database::Database;
use rusqlite::{params, Row, OptionalExtension};
use std::sync::Arc;

use crate::dto::invoice::*;

/// Invoice repository for CRUD operations
pub struct InvoiceRepository {
    db: Arc<Database>,
}

impl InvoiceRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// List invoices with optional filter
    pub fn list(&self, filter: InvoiceFilter) -> Result<Vec<InvoiceDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT i.id, i.invoice_number, i.client_id,
                        c.name as client_name, c.code as client_code,
                        i.status, i.total_ht, i.total_tva, i.total_ttc,
                        i.timbre_fiscal, i.payment_method, i.payment_due_date,
                        i.notes, i.created_at, i.validated_at, i.voided_at
                 FROM invoices i
                 LEFT JOIN clients c ON c.id = i.client_id
                 WHERE i.is_deleted = 0",
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(ref status) = filter.status {
                sql.push_str(" AND i.status = ?");
                params_vec.push(Box::new(status.clone()));
            }

            if let Some(ref client_id) = filter.client_id {
                sql.push_str(" AND i.client_id = ?");
                params_vec.push(Box::new(client_id.clone()));
            }

            if let Some(ref from_date) = filter.from_date {
                sql.push_str(" AND i.created_at >= ?");
                params_vec.push(Box::new(from_date.clone()));
            }

            if let Some(ref to_date) = filter.to_date {
                sql.push_str(" AND i.created_at <= ?");
                params_vec.push(Box::new(to_date.clone()));
            }

            sql.push_str(" ORDER BY i.created_at DESC");

            if let Some(limit) = filter.limit {
                sql.push_str(&format!(" LIMIT {}", limit));
            } else {
                sql.push_str(" LIMIT 100");
            }

            let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

            let mut result: Vec<InvoiceDto> = Vec::new();

            if params_vec.is_empty() {
                let invoices = stmt
                    .query_map([], |row| Self::row_to_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for invoice in invoices {
                    let mut dto = invoice.map_err(|e| Error::Database(e.to_string()))?;
                    dto.lines = self.get_lines_internal(conn, &dto.id)?;
                    result.push(dto);
                }
            } else {
                let params_refs: Vec<&dyn rusqlite::ToSql> =
                    params_vec.iter().map(|p| p.as_ref()).collect();
                let invoices = stmt
                    .query_map(params_refs.as_slice(), |row| Self::row_to_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for invoice in invoices {
                    let mut dto = invoice.map_err(|e| Error::Database(e.to_string()))?;
                    dto.lines = self.get_lines_internal(conn, &dto.id)?;
                    result.push(dto);
                }
            }

            Ok(result)
        })
    }

    /// Get single invoice by ID
    pub fn get(&self, id: &str) -> Result<Option<InvoiceDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT i.id, i.invoice_number, i.client_id,
                            c.name as client_name, c.code as client_code,
                            i.status, i.total_ht, i.total_tva, i.total_ttc,
                            i.timbre_fiscal, i.payment_method, i.payment_due_date,
                            i.notes, i.created_at, i.validated_at, i.voided_at
                     FROM invoices i
                     LEFT JOIN clients c ON c.id = i.client_id
                     WHERE i.id = ? AND i.is_deleted = 0",
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            let invoice = stmt
                .query_row([id], |row| Self::row_to_dto(row))
                .optional()
                .map_err(|e| Error::Database(e.to_string()))?;

            if let Some(mut dto) = invoice {
                dto.lines = self.get_lines_internal(conn, &dto.id)?;
                Ok(Some(dto))
            } else {
                Ok(None)
            }
        })
    }

    /// Create new invoice
    pub fn create(&self, id: &str, invoice_number: &str, data: &CreateInvoiceDto, totals: &InvoiceTotalsDto) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO invoices (
                    id, invoice_number, client_id, status,
                    total_ht, total_tva, total_ttc, timbre_fiscal,
                    payment_method, payment_due_date, notes,
                    created_at, is_deleted
                ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)",
                params![
                    id,
                    invoice_number,
                    data.client_id,
                    totals.total_ht,
                    totals.total_tva,
                    totals.total_ttc,
                    totals.timbre_fiscal,
                    data.payment_method.as_deref().unwrap_or("ESPECES"),
                    data.payment_due_date,
                    data.notes,
                ],
            )
            .map_err(|e| Error::Database(e.to_string()))?;

            // Insert lines
            for (idx, line) in data.lines.iter().enumerate() {
                let line_id = manchengo_core::EntityId::new().to_string();
                let line_ht = (line.unit_price_ht as f64 * line.quantity as f64) as i64;
                let line_tva = (line_ht as f64 * 0.19) as i64; // 19% TVA
                let line_ttc = line_ht + line_tva;

                conn.execute(
                    "INSERT INTO invoice_lines (
                        id, invoice_id, product_pf_id, quantity,
                        unit_price_ht, line_total_ht, line_total_tva, line_total_ttc,
                        sort_order
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    params![
                        line_id,
                        id,
                        line.product_pf_id,
                        line.quantity,
                        line.unit_price_ht,
                        line_ht,
                        line_tva,
                        line_ttc,
                        idx + 1,
                    ],
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            }

            Ok(())
        })
    }

    /// Validate invoice (DRAFT -> VALIDATED)
    pub fn validate(&self, id: &str) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE invoices SET status = 'VALIDATED', validated_at = datetime('now') WHERE id = ? AND status = 'DRAFT'",
                [id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Void invoice (annulation)
    pub fn void(&self, id: &str, reason: Option<&str>) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE invoices SET
                    status = 'VOIDED',
                    voided_at = datetime('now'),
                    notes = COALESCE(notes || ' | Annulée: ' || ?, notes)
                 WHERE id = ? AND status != 'PAID'",
                params![reason.unwrap_or("Annulation"), id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Mark as paid
    pub fn mark_paid(&self, id: &str) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE invoices SET status = 'PAID' WHERE id = ? AND status = 'VALIDATED'",
                [id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Generate unique invoice number
    pub fn generate_number(&self) -> Result<String> {
        self.db.with_connection(|conn| {
            let today = chrono::Utc::now().format("%Y%m%d").to_string();
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM invoices WHERE invoice_number LIKE ?",
                    [format!("FAC-{}-%%", today)],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(format!("FAC-{}-{:03}", today, count + 1))
        })
    }

    /// Get outstanding invoices for client
    pub fn get_outstanding(&self, client_id: &str) -> Result<Vec<InvoiceDto>> {
        self.list(InvoiceFilter {
            client_id: Some(client_id.to_string()),
            status: Some("VALIDATED".to_string()),
            ..Default::default()
        })
    }

    /// Count by status
    pub fn count_by_status(&self, status: &str) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM invoices WHERE status = ? AND is_deleted = 0",
                    [status],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    /// Get total invoiced today
    pub fn total_today(&self) -> Result<i64> {
        self.db.with_connection(|conn| {
            let total: i64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(total_ttc), 0) FROM invoices
                     WHERE date(created_at) = date('now') AND status != 'VOIDED' AND is_deleted = 0",
                    [],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(total)
        })
    }

    // Internal helpers

    fn get_lines_internal(
        &self,
        conn: &rusqlite::Connection,
        invoice_id: &str,
    ) -> Result<Vec<InvoiceLineDto>> {
        let mut stmt = conn
            .prepare(
                "SELECT il.id, il.product_pf_id, pf.name as pf_name, pf.code as pf_code,
                        il.quantity, il.unit_price_ht, il.line_total_ht,
                        il.line_total_tva, il.line_total_ttc
                 FROM invoice_lines il
                 LEFT JOIN products_pf pf ON pf.id = il.product_pf_id
                 WHERE il.invoice_id = ?
                 ORDER BY il.sort_order ASC",
            )
            .map_err(|e| Error::Database(e.to_string()))?;

        let lines = stmt
            .query_map([invoice_id], |row| {
                Ok(InvoiceLineDto {
                    id: row.get(0)?,
                    product_pf_id: row.get(1)?,
                    product_pf_name: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    product_pf_code: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    quantity: row.get(4)?,
                    unit_price_ht: row.get(5)?,
                    line_total_ht: row.get(6)?,
                    line_total_tva: row.get(7)?,
                    line_total_ttc: row.get(8)?,
                })
            })
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for line in lines {
            result.push(line.map_err(|e| Error::Database(e.to_string()))?);
        }
        Ok(result)
    }

    fn row_to_dto(row: &Row) -> rusqlite::Result<InvoiceDto> {
        Ok(InvoiceDto {
            id: row.get(0)?,
            invoice_number: row.get(1)?,
            client_id: row.get(2)?,
            client_name: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            client_code: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            status: InvoiceStatus::from(row.get::<_, String>(5)?.as_str()),
            total_ht: row.get(6)?,
            total_tva: row.get(7)?,
            total_ttc: row.get(8)?,
            timbre_fiscal: row.get(9)?,
            payment_method: row.get(10)?,
            payment_due_date: row.get(11)?,
            notes: row.get(12)?,
            lines: Vec::new(), // Will be populated separately
            created_at: row.get(13)?,
            validated_at: row.get(14)?,
            voided_at: row.get(15)?,
        })
    }
}
