//! Supplier management

use manchengo_core::{Address, AuditInfo, EntityId, FiscalIdentity};
use serde::{Deserialize, Serialize};

/// Supplier entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Supplier {
    pub id: EntityId,
    pub code: String,
    pub name: String,

    // Contact
    pub contact_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,

    // Address
    pub address: Option<Address>,

    // Fiscal identity
    pub fiscal_identity: Option<FiscalIdentity>,

    // Metadata
    pub notes: Option<String>,
    pub is_active: bool,
    pub audit: AuditInfo,
}

impl Supplier {
    pub fn new(code: String, name: String, user_id: EntityId) -> Self {
        Self {
            id: EntityId::new(),
            code,
            name,
            contact_name: None,
            phone: None,
            email: None,
            address: None,
            fiscal_identity: None,
            notes: None,
            is_active: true,
            audit: AuditInfo::new(user_id),
        }
    }

    pub fn has_fiscal_identity(&self) -> bool {
        self.fiscal_identity.is_some()
    }
}
