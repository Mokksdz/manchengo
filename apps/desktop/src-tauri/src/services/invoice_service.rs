//! Invoice Service
//!
//! Business logic for invoices and payments.
//! Includes Algerian fiscal calculations (TVA 19%, timbre fiscal).

use manchengo_core::{EntityId, Error, Result};
use manchengo_database::Database;
use manchengo_sync::EventStore;
use std::sync::Arc;
use tracing::info;

use crate::dto::invoice::*;
use crate::repositories::{ClientRepository, InvoiceRepository};

/// TVA rate in Algeria (19%)
const TVA_RATE: f64 = 0.19;

/// Timbre fiscal rate (1%)
const TIMBRE_RATE: f64 = 0.01;

/// Timbre fiscal minimum threshold
const TIMBRE_THRESHOLD: i64 = 5000_00; // 5000 DA in centimes

/// Invoice service for invoice management
pub struct InvoiceService {
    db: Arc<Database>,
    event_store: Arc<EventStore>,
    invoice_repo: Arc<InvoiceRepository>,
    client_repo: Arc<ClientRepository>,
}

impl InvoiceService {
    pub fn new(
        db: Arc<Database>,
        event_store: Arc<EventStore>,
        invoice_repo: Arc<InvoiceRepository>,
        client_repo: Arc<ClientRepository>,
    ) -> Self {
        Self {
            db,
            event_store,
            invoice_repo,
            client_repo,
        }
    }

    // =========================================================================
    // INVOICE OPERATIONS
    // =========================================================================

    /// List invoices
    pub fn list_invoices(&self, filter: InvoiceFilter) -> Result<Vec<InvoiceDto>> {
        self.invoice_repo.list(filter)
    }

    /// Get single invoice
    pub fn get_invoice(&self, id: &str) -> Result<Option<InvoiceDto>> {
        self.invoice_repo.get(id)
    }

    /// Create new invoice
    pub fn create_invoice(&self, data: CreateInvoiceDto) -> Result<InvoiceDto> {
        // Calculate totals
        let totals = self.calculate_totals(&data.lines)?;

        let id = EntityId::new().to_string();
        let invoice_number = self.invoice_repo.generate_number()?;

        self.invoice_repo.create(&id, &invoice_number, &data, &totals)?;

        info!("Created invoice {} for client {}", invoice_number, data.client_id);

        self.invoice_repo
            .get(&id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Invoice".to_string(),
                id: id.clone(),
            })
    }

    /// Validate invoice (DRAFT -> VALIDATED)
    pub fn validate_invoice(&self, id: &str) -> Result<InvoiceDto> {
        let invoice = self
            .invoice_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Invoice".to_string(),
                id: id.to_string(),
            })?;

        if invoice.status != InvoiceStatus::Draft {
            return Err(Error::InvalidStateTransition {
                entity: "Invoice".to_string(),
                from: format!("{:?}", invoice.status),
                to: "VALIDATED".to_string(),
            });
        }

        self.invoice_repo.validate(id)?;

        // Update client balance
        self.client_repo
            .update_balance(&invoice.client_id, invoice.total_ttc)?;

        info!("Validated invoice {}", invoice.invoice_number);

        self.invoice_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Invoice".to_string(),
                id: id.to_string(),
            })
    }

    /// Void invoice (annulation)
    pub fn void_invoice(&self, id: &str, reason: Option<&str>) -> Result<()> {
        let invoice = self
            .invoice_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Invoice".to_string(),
                id: id.to_string(),
            })?;

        if invoice.status == InvoiceStatus::Paid {
            return Err(Error::BusinessRule("Cannot void paid invoices".to_string()));
        }

        // Reverse client balance if invoice was validated
        if invoice.status == InvoiceStatus::Validated {
            self.client_repo
                .update_balance(&invoice.client_id, -invoice.total_ttc)?;
        }

        self.invoice_repo.void(id, reason)?;

        info!("Voided invoice {}", invoice.invoice_number);
        Ok(())
    }

    /// Calculate invoice totals (with Algerian fiscal rules)
    pub fn calculate_totals(&self, lines: &[CreateInvoiceLineDto]) -> Result<InvoiceTotalsDto> {
        let mut total_ht: i64 = 0;
        let mut total_tva: i64 = 0;
        let mut line_totals = Vec::new();

        for line in lines {
            let line_ht = line.unit_price_ht * (line.quantity as i64);
            let line_tva = (line_ht as f64 * TVA_RATE) as i64;
            let line_ttc = line_ht + line_tva;

            total_ht += line_ht;
            total_tva += line_tva;

            line_totals.push(InvoiceLineTotalsDto {
                product_pf_id: line.product_pf_id.clone(),
                quantity: line.quantity,
                unit_price_ht: line.unit_price_ht,
                line_ht,
                line_tva,
                line_ttc,
            });
        }

        // Calculate timbre fiscal (1% of TTC if > 5000 DA)
        let subtotal_ttc = total_ht + total_tva;
        let timbre_fiscal = self.calculate_timbre_fiscal_amount(subtotal_ttc);
        let total_ttc = subtotal_ttc + timbre_fiscal;

        Ok(InvoiceTotalsDto {
            total_ht,
            total_tva,
            timbre_fiscal,
            total_ttc,
            lines: line_totals,
        })
    }

    /// Calculate timbre fiscal amount
    pub fn calculate_timbre_fiscal_amount(&self, total_ttc: i64) -> i64 {
        if total_ttc >= TIMBRE_THRESHOLD {
            (total_ttc as f64 * TIMBRE_RATE) as i64
        } else {
            0
        }
    }

    /// Get timbre fiscal details
    pub fn get_timbre_fiscal(&self, total_ttc: i64) -> TimbreFiscalDto {
        let timbre_amount = self.calculate_timbre_fiscal_amount(total_ttc);
        TimbreFiscalDto {
            total_ttc,
            timbre_amount,
            final_total: total_ttc + timbre_amount,
            timbre_rate: TIMBRE_RATE,
            threshold: TIMBRE_THRESHOLD,
        }
    }

    // =========================================================================
    // PAYMENT OPERATIONS
    // =========================================================================

    /// List payments
    pub fn list_payments(&self, filter: PaymentFilter) -> Result<Vec<PaymentDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT p.id, p.invoice_id, i.invoice_number, i.client_id,
                        c.name as client_name, p.amount, p.payment_method,
                        p.payment_date, p.reference, p.notes, p.created_at
                 FROM payments p
                 LEFT JOIN invoices i ON i.id = p.invoice_id
                 LEFT JOIN clients c ON c.id = i.client_id
                 WHERE 1=1",
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(ref client_id) = filter.client_id {
                sql.push_str(" AND i.client_id = ?");
                params_vec.push(Box::new(client_id.clone()));
            }

            if let Some(ref invoice_id) = filter.invoice_id {
                sql.push_str(" AND p.invoice_id = ?");
                params_vec.push(Box::new(invoice_id.clone()));
            }

            sql.push_str(" ORDER BY p.created_at DESC");

            if let Some(limit) = filter.limit {
                sql.push_str(&format!(" LIMIT {}", limit));
            }

            let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

            let mut result: Vec<PaymentDto> = Vec::new();

            if params_vec.is_empty() {
                let payments = stmt
                    .query_map([], |row| {
                        Ok(PaymentDto {
                            id: row.get(0)?,
                            invoice_id: row.get(1)?,
                            invoice_number: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                            client_id: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                            client_name: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                            amount: row.get(5)?,
                            payment_method: row.get(6)?,
                            payment_date: row.get(7)?,
                            reference: row.get(8)?,
                            notes: row.get(9)?,
                            created_at: row.get(10)?,
                        })
                    })
                    .map_err(|e| Error::Database(e.to_string()))?;

                for payment in payments {
                    result.push(payment.map_err(|e| Error::Database(e.to_string()))?);
                }
            } else {
                let params_refs: Vec<&dyn rusqlite::ToSql> =
                    params_vec.iter().map(|p| p.as_ref()).collect();
                let payments = stmt
                    .query_map(params_refs.as_slice(), |row| {
                        Ok(PaymentDto {
                            id: row.get(0)?,
                            invoice_id: row.get(1)?,
                            invoice_number: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                            client_id: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                            client_name: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                            amount: row.get(5)?,
                            payment_method: row.get(6)?,
                            payment_date: row.get(7)?,
                            reference: row.get(8)?,
                            notes: row.get(9)?,
                            created_at: row.get(10)?,
                        })
                    })
                    .map_err(|e| Error::Database(e.to_string()))?;

                for payment in payments {
                    result.push(payment.map_err(|e| Error::Database(e.to_string()))?);
                }
            }

            Ok(result)
        })
    }

    /// Create payment
    pub fn create_payment(&self, data: CreatePaymentDto) -> Result<PaymentDto> {
        let invoice = self
            .invoice_repo
            .get(&data.invoice_id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Invoice".to_string(),
                id: data.invoice_id.clone(),
            })?;

        if invoice.status != InvoiceStatus::Validated {
            return Err(Error::BusinessRule("Can only pay validated invoices".to_string()));
        }

        let id = EntityId::new().to_string();

        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO payments (
                    id, invoice_id, amount, payment_method, payment_date,
                    reference, notes, created_at
                ) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, datetime('now'))",
                rusqlite::params![
                    id,
                    data.invoice_id,
                    data.amount,
                    data.payment_method,
                    data.payment_date,
                    data.reference,
                    data.notes,
                ],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })?;

        // Update client balance
        self.client_repo
            .update_balance(&invoice.client_id, -data.amount)?;

        // Check if invoice is fully paid
        let total_paid = self.get_total_paid(&data.invoice_id)?;
        if total_paid >= invoice.total_ttc {
            self.invoice_repo.mark_paid(&data.invoice_id)?;
        }

        info!(
            "Created payment of {} for invoice {}",
            data.amount, invoice.invoice_number
        );

        // Return the created payment
        self.list_payments(PaymentFilter {
            invoice_id: Some(data.invoice_id),
            limit: Some(1),
            ..Default::default()
        })?
        .into_iter()
        .next()
        .ok_or_else(|| Error::NotFound {
            entity_type: "Payment".to_string(),
            id: id.clone(),
        })
    }

    /// Get total paid for invoice
    fn get_total_paid(&self, invoice_id: &str) -> Result<i64> {
        self.db.with_connection(|conn| {
            let total: i64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = ?",
                    [invoice_id],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(total)
        })
    }

    /// Get outstanding invoices for client
    pub fn get_outstanding_invoices(&self, client_id: &str) -> Result<Vec<InvoiceDto>> {
        self.invoice_repo.get_outstanding(client_id)
    }

    // =========================================================================
    // STATS
    // =========================================================================

    /// Get total invoiced today
    pub fn get_total_today(&self) -> Result<i64> {
        self.invoice_repo.total_today()
    }

    /// Count invoices today
    pub fn count_invoices_today(&self) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM invoices
                     WHERE date(created_at) = date('now') AND is_deleted = 0",
                    [],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }
}
