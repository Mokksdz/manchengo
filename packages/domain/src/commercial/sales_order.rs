//! Sales order management

use chrono::{DateTime, NaiveDate, Utc};
use manchengo_core::{AlgerianTaxRates, AuditInfo, EntityId, Error, Money, Result, UnitOfMeasure};
use serde::{Deserialize, Serialize};

/// Sales order status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SalesOrderStatus {
    Draft,
    Confirmed,
    Prepared,
    Delivered,
    Cancelled,
}

impl SalesOrderStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "DRAFT",
            Self::Confirmed => "CONFIRMED",
            Self::Prepared => "PREPARED",
            Self::Delivered => "DELIVERED",
            Self::Cancelled => "CANCELLED",
        }
    }
}

/// Payment status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PaymentStatus {
    Unpaid,
    Partial,
    Paid,
}

/// Sales order (Commande client)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesOrder {
    pub id: EntityId,
    pub order_number: String,
    pub client_id: EntityId,

    // Dates
    pub order_date: NaiveDate,
    pub requested_date: Option<NaiveDate>,

    // Status
    pub status: SalesOrderStatus,

    // Lines
    pub lines: Vec<SalesOrderLine>,

    // Amounts
    pub total_ht: Money,
    pub total_tva: Money,
    pub total_ttc: Money,

    // Payment
    pub payment_status: PaymentStatus,
    pub amount_paid: Money,

    // Metadata
    pub notes: Option<String>,
    pub audit: AuditInfo,
}

/// Sales order line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesOrderLine {
    pub id: EntityId,
    pub sales_order_id: EntityId,
    pub product_pf_id: EntityId,
    pub quantity: f64,
    pub unit: UnitOfMeasure,
    pub unit_price_ht: Money,
    pub tva_rate: f64,
    pub total_ht: Money,
    pub total_tva: Money,
    pub total_ttc: Money,
    pub quantity_delivered: f64,
    pub notes: Option<String>,
}

impl SalesOrder {
    pub fn new(
        order_number: String,
        client_id: EntityId,
        order_date: NaiveDate,
        user_id: EntityId,
    ) -> Self {
        Self {
            id: EntityId::new(),
            order_number,
            client_id,
            order_date,
            requested_date: None,
            status: SalesOrderStatus::Draft,
            lines: Vec::new(),
            total_ht: Money::zero(),
            total_tva: Money::zero(),
            total_ttc: Money::zero(),
            payment_status: PaymentStatus::Unpaid,
            amount_paid: Money::zero(),
            notes: None,
            audit: AuditInfo::new(user_id),
        }
    }

    /// Add a line to the order
    pub fn add_line(
        &mut self,
        product_pf_id: EntityId,
        quantity: f64,
        unit: UnitOfMeasure,
        unit_price_ht: Money,
        tva_rate: f64,
        user_id: EntityId,
    ) -> Result<()> {
        if self.status != SalesOrderStatus::Draft {
            return Err(Error::BusinessRule(
                "Can only add lines to draft orders".to_string(),
            ));
        }

        let total_ht = Money::from_centimes((quantity * unit_price_ht.centimes() as f64) as i64);
        let total_tva = Money::from_centimes((total_ht.centimes() as f64 * tva_rate) as i64);
        let total_ttc = total_ht + total_tva;

        self.lines.push(SalesOrderLine {
            id: EntityId::new(),
            sales_order_id: self.id,
            product_pf_id,
            quantity,
            unit,
            unit_price_ht,
            tva_rate,
            total_ht,
            total_tva,
            total_ttc,
            quantity_delivered: 0.0,
            notes: None,
        });

        self.recalculate_totals();
        self.audit.update(user_id);
        Ok(())
    }

    /// Confirm the order
    pub fn confirm(&mut self, user_id: EntityId) -> Result<()> {
        if self.status != SalesOrderStatus::Draft {
            return Err(Error::InvalidStateTransition {
                entity: "SalesOrder".to_string(),
                from: self.status.as_str().to_string(),
                to: "CONFIRMED".to_string(),
            });
        }

        if self.lines.is_empty() {
            return Err(Error::Validation {
                field: "lines".to_string(),
                message: "Order must have at least one line".to_string(),
            });
        }

        self.status = SalesOrderStatus::Confirmed;
        self.audit.update(user_id);
        Ok(())
    }

    /// Record payment received
    pub fn record_payment(&mut self, amount: Money, user_id: EntityId) {
        self.amount_paid = self.amount_paid + amount;

        if self.amount_paid.centimes() >= self.total_ttc.centimes() {
            self.payment_status = PaymentStatus::Paid;
        } else if self.amount_paid.is_positive() {
            self.payment_status = PaymentStatus::Partial;
        }

        self.audit.update(user_id);
    }

    /// Get remaining amount to pay
    pub fn remaining_amount(&self) -> Money {
        Money::from_centimes(
            (self.total_ttc.centimes() - self.amount_paid.centimes()).max(0),
        )
    }

    /// Check if fully delivered
    pub fn is_fully_delivered(&self) -> bool {
        self.lines
            .iter()
            .all(|l| l.quantity_delivered >= l.quantity)
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

        self.total_ttc = self.total_ht + self.total_tva;
    }
}
