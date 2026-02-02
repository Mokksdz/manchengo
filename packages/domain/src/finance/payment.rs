//! Payment tracking

use chrono::NaiveDate;
use manchengo_core::{EntityId, Money};
use serde::{Deserialize, Serialize};

/// Payment method
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PaymentMethod {
    Cash,
    Check,
    Transfer,
    Other,
}

impl PaymentMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Cash => "CASH",
            Self::Check => "CHECK",
            Self::Transfer => "TRANSFER",
            Self::Other => "OTHER",
        }
    }
}

/// Payment status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PaymentStatus {
    Pending,
    Validated,
    Rejected,
}

/// Payment record (Règlement)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: EntityId,
    pub payment_number: String,
    pub client_id: EntityId,
    pub invoice_id: Option<EntityId>,

    // Payment details
    pub amount: Money,
    pub payment_date: NaiveDate,
    pub payment_method: PaymentMethod,

    // Check details (if applicable)
    pub check_number: Option<String>,
    pub check_bank: Option<String>,
    pub check_date: Option<NaiveDate>,

    // Status
    pub status: PaymentStatus,

    // Metadata
    pub notes: Option<String>,
    pub created_by: EntityId,
}

impl Payment {
    pub fn cash(
        payment_number: String,
        client_id: EntityId,
        amount: Money,
        payment_date: NaiveDate,
        user_id: EntityId,
    ) -> Self {
        Self {
            id: EntityId::new(),
            payment_number,
            client_id,
            invoice_id: None,
            amount,
            payment_date,
            payment_method: PaymentMethod::Cash,
            check_number: None,
            check_bank: None,
            check_date: None,
            status: PaymentStatus::Validated, // Cash is immediately validated
            notes: None,
            created_by: user_id,
        }
    }

    pub fn check(
        payment_number: String,
        client_id: EntityId,
        amount: Money,
        payment_date: NaiveDate,
        check_number: String,
        check_bank: String,
        check_date: NaiveDate,
        user_id: EntityId,
    ) -> Self {
        Self {
            id: EntityId::new(),
            payment_number,
            client_id,
            invoice_id: None,
            amount,
            payment_date,
            payment_method: PaymentMethod::Check,
            check_number: Some(check_number),
            check_bank: Some(check_bank),
            check_date: Some(check_date),
            status: PaymentStatus::Pending, // Check needs validation
            notes: None,
            created_by: user_id,
        }
    }

    pub fn validate(&mut self) {
        self.status = PaymentStatus::Validated;
    }

    pub fn reject(&mut self, reason: Option<String>) {
        self.status = PaymentStatus::Rejected;
        self.notes = reason;
    }

    pub fn is_validated(&self) -> bool {
        self.status == PaymentStatus::Validated
    }
}

/// Payment allocation to invoices
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentAllocation {
    pub payment_id: EntityId,
    pub invoice_id: EntityId,
    pub amount: Money,
    pub allocated_at: chrono::DateTime<chrono::Utc>,
    pub allocated_by: EntityId,
}
