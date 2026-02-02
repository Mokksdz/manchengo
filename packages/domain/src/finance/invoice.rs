//! Invoice management with Algerian fiscal compliance

use chrono::NaiveDate;
use manchengo_core::{AlgerianTaxRates, AuditInfo, EntityId, Error, Money, Result, UnitOfMeasure};
use serde::{Deserialize, Serialize};

/// Invoice status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InvoiceStatus {
    Draft,
    Validated,
    Sent,
    Paid,
    Cancelled,
}

impl InvoiceStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "DRAFT",
            Self::Validated => "VALIDATED",
            Self::Sent => "SENT",
            Self::Paid => "PAID",
            Self::Cancelled => "CANCELLED",
        }
    }
}

/// Payment status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InvoicePaymentStatus {
    Unpaid,
    Partial,
    Paid,
}

/// Invoice (Facture)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: EntityId,
    pub invoice_number: String,
    pub client_id: EntityId,
    pub delivery_id: Option<EntityId>,

    // Dates
    pub invoice_date: NaiveDate,
    pub due_date: Option<NaiveDate>,

    // Lines
    pub lines: Vec<InvoiceLine>,

    // Amounts
    pub total_ht: Money,
    pub total_tva: Money,
    pub timbre_fiscal: Money,
    pub total_ttc: Money,

    // Payment
    pub payment_status: InvoicePaymentStatus,
    pub amount_paid: Money,

    // Status
    pub status: InvoiceStatus,

    // Metadata
    pub notes: Option<String>,
    pub audit: AuditInfo,
}

/// Invoice line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLine {
    pub id: EntityId,
    pub invoice_id: EntityId,
    pub product_pf_id: EntityId,
    pub description: Option<String>,
    pub quantity: f64,
    pub unit: UnitOfMeasure,
    pub unit_price_ht: Money,
    pub tva_rate: f64,
    pub total_ht: Money,
    pub total_tva: Money,
    pub total_ttc: Money,
}

impl Invoice {
    pub fn new(
        invoice_number: String,
        client_id: EntityId,
        invoice_date: NaiveDate,
        user_id: EntityId,
    ) -> Self {
        Self {
            id: EntityId::new(),
            invoice_number,
            client_id,
            delivery_id: None,
            invoice_date,
            due_date: None,
            lines: Vec::new(),
            total_ht: Money::zero(),
            total_tva: Money::zero(),
            timbre_fiscal: Money::zero(),
            total_ttc: Money::zero(),
            payment_status: InvoicePaymentStatus::Unpaid,
            amount_paid: Money::zero(),
            status: InvoiceStatus::Draft,
            notes: None,
            audit: AuditInfo::new(user_id),
        }
    }

    /// Add a line to the invoice
    pub fn add_line(
        &mut self,
        product_pf_id: EntityId,
        description: Option<String>,
        quantity: f64,
        unit: UnitOfMeasure,
        unit_price_ht: Money,
        tva_rate: f64,
        user_id: EntityId,
    ) -> Result<()> {
        if self.status != InvoiceStatus::Draft {
            return Err(Error::BusinessRule(
                "Can only modify draft invoices".to_string(),
            ));
        }

        let total_ht = Money::from_centimes((quantity * unit_price_ht.centimes() as f64) as i64);
        let total_tva = Money::from_centimes((total_ht.centimes() as f64 * tva_rate) as i64);
        let total_ttc = total_ht + total_tva;

        self.lines.push(InvoiceLine {
            id: EntityId::new(),
            invoice_id: self.id,
            product_pf_id,
            description,
            quantity,
            unit,
            unit_price_ht,
            tva_rate,
            total_ht,
            total_tva,
            total_ttc,
        });

        self.recalculate_totals();
        self.audit.update(user_id);
        Ok(())
    }

    /// Validate the invoice (finalize for sending)
    pub fn validate(&mut self, user_id: EntityId) -> Result<()> {
        if self.status != InvoiceStatus::Draft {
            return Err(Error::InvalidStateTransition {
                entity: "Invoice".to_string(),
                from: self.status.as_str().to_string(),
                to: "VALIDATED".to_string(),
            });
        }

        if self.lines.is_empty() {
            return Err(Error::Validation {
                field: "lines".to_string(),
                message: "Invoice must have at least one line".to_string(),
            });
        }

        self.status = InvoiceStatus::Validated;
        self.audit.update(user_id);
        Ok(())
    }

    /// Record payment
    pub fn record_payment(&mut self, amount: Money, user_id: EntityId) {
        self.amount_paid = self.amount_paid + amount;

        if self.amount_paid.centimes() >= self.total_ttc.centimes() {
            self.payment_status = InvoicePaymentStatus::Paid;
            self.status = InvoiceStatus::Paid;
        } else if self.amount_paid.is_positive() {
            self.payment_status = InvoicePaymentStatus::Partial;
        }

        self.audit.update(user_id);
    }

    /// Get remaining amount
    pub fn remaining_amount(&self) -> Money {
        Money::from_centimes(
            (self.total_ttc.centimes() - self.amount_paid.centimes()).max(0),
        )
    }

    fn recalculate_totals(&mut self) {
        self.total_ht = self
            .lines
            .iter()
            .fold(Money::zero(), |acc, l| acc + l.total_ht);

        self.total_tva = self
            .lines
            .iter()
            .fold(Money::zero(), |acc, l| acc + l.total_tva);

        // Calculate timbre fiscal (1% of TTC, applied to final amount)
        let subtotal = self.total_ht + self.total_tva;
        self.timbre_fiscal = Money::from_centimes(
            (subtotal.centimes() as f64 * AlgerianTaxRates::TIMBRE_FISCAL) as i64,
        );

        self.total_ttc = subtotal + self.timbre_fiscal;
    }
}

/// Invoice generator from delivery
pub struct InvoiceGenerator;

impl InvoiceGenerator {
    /// Generate invoice number
    pub fn generate_number(sequence: u32, date: NaiveDate) -> String {
        format!(
            "FAC-{}{:02}{:02}-{:05}",
            date.format("%y"),
            date.format("%m"),
            date.format("%d"),
            sequence
        )
    }
}
