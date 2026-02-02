//! Client management

use manchengo_core::{Address, AuditInfo, ClientType, EntityId, FiscalIdentity, Money};
use serde::{Deserialize, Serialize};

/// Client entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Client {
    pub id: EntityId,
    pub code: String,
    pub name: String,
    pub client_type: ClientType,

    // Contact
    pub contact_name: Option<String>,
    pub phone: Option<String>,
    pub phone_secondary: Option<String>,
    pub email: Option<String>,

    // Address
    pub address: Option<Address>,
    pub gps_lat: Option<f64>,
    pub gps_lon: Option<f64>,

    // Fiscal identity
    pub fiscal_identity: Option<FiscalIdentity>,

    // Commercial terms
    pub payment_terms_days: i32,
    pub credit_limit: Money,
    pub current_balance: Money, // Positive = they owe us

    // Metadata
    pub notes: Option<String>,
    pub is_active: bool,
    pub audit: AuditInfo,
}

impl Client {
    pub fn new(
        code: String,
        name: String,
        client_type: ClientType,
        user_id: EntityId,
    ) -> Self {
        Self {
            id: EntityId::new(),
            code,
            name,
            client_type,
            contact_name: None,
            phone: None,
            phone_secondary: None,
            email: None,
            address: None,
            gps_lat: None,
            gps_lon: None,
            fiscal_identity: None,
            payment_terms_days: 0,
            credit_limit: Money::zero(),
            current_balance: Money::zero(),
            notes: None,
            is_active: true,
            audit: AuditInfo::new(user_id),
        }
    }

    /// Check if client can place an order of given amount
    pub fn can_order(&self, amount: Money) -> bool {
        if self.credit_limit.is_zero() {
            return true; // No limit set
        }

        let new_balance = self.current_balance + amount;
        new_balance.centimes() <= self.credit_limit.centimes()
    }

    /// Add to client balance (they owe us more)
    pub fn add_to_balance(&mut self, amount: Money, user_id: EntityId) {
        self.current_balance = self.current_balance + amount;
        self.audit.update(user_id);
    }

    /// Reduce client balance (payment received)
    pub fn reduce_balance(&mut self, amount: Money, user_id: EntityId) {
        self.current_balance = self.current_balance - amount;
        self.audit.update(user_id);
    }

    /// Check if client has required fiscal identity
    pub fn has_fiscal_identity(&self) -> bool {
        self.fiscal_identity.is_some()
    }

    /// Validate fiscal identity completeness
    pub fn validate_fiscal_identity(&self) -> Vec<String> {
        match &self.fiscal_identity {
            Some(fi) => fi.validate(),
            None => vec!["Fiscal identity not set".to_string()],
        }
    }
}
