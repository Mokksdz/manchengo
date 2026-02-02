//! Price list management by client type

use chrono::NaiveDate;
use manchengo_core::{AuditInfo, ClientType, EntityId, Money};
use serde::{Deserialize, Serialize};

/// Price list for a client type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceList {
    pub id: EntityId,
    pub code: String,
    pub name: String,
    pub client_type: ClientType,
    pub valid_from: NaiveDate,
    pub valid_until: Option<NaiveDate>,
    pub lines: Vec<PriceListLine>,
    pub is_active: bool,
    pub audit: AuditInfo,
}

/// Price for a specific product in a price list
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceListLine {
    pub id: EntityId,
    pub price_list_id: EntityId,
    pub product_pf_id: EntityId,
    pub price_ht: Money,
    pub min_quantity: f64,
}

impl PriceList {
    pub fn new(
        code: String,
        name: String,
        client_type: ClientType,
        valid_from: NaiveDate,
        user_id: EntityId,
    ) -> Self {
        Self {
            id: EntityId::new(),
            code,
            name,
            client_type,
            valid_from,
            valid_until: None,
            lines: Vec::new(),
            is_active: true,
            audit: AuditInfo::new(user_id),
        }
    }

    /// Check if price list is valid on a given date
    pub fn is_valid_on(&self, date: NaiveDate) -> bool {
        if !self.is_active {
            return false;
        }

        if date < self.valid_from {
            return false;
        }

        match self.valid_until {
            Some(until) => date <= until,
            None => true,
        }
    }

    /// Get price for a product and quantity
    pub fn get_price(&self, product_id: EntityId, quantity: f64) -> Option<Money> {
        // Find all lines for this product, sorted by min_quantity desc
        let mut applicable: Vec<_> = self
            .lines
            .iter()
            .filter(|l| l.product_pf_id == product_id && quantity >= l.min_quantity)
            .collect();

        applicable.sort_by(|a, b| b.min_quantity.partial_cmp(&a.min_quantity).unwrap());

        applicable.first().map(|l| l.price_ht)
    }

    /// Add or update a price line
    pub fn set_price(
        &mut self,
        product_pf_id: EntityId,
        price_ht: Money,
        min_quantity: f64,
        user_id: EntityId,
    ) {
        // Remove existing line for same product and min_quantity
        self.lines
            .retain(|l| !(l.product_pf_id == product_pf_id && l.min_quantity == min_quantity));

        self.lines.push(PriceListLine {
            id: EntityId::new(),
            price_list_id: self.id,
            product_pf_id,
            price_ht,
            min_quantity,
        });

        self.audit.update(user_id);
    }
}

/// Price lookup service
pub struct PriceLookup;

impl PriceLookup {
    /// Find applicable price for a client and product
    pub fn find_price(
        price_lists: &[PriceList],
        client_type: ClientType,
        product_id: EntityId,
        quantity: f64,
        date: NaiveDate,
    ) -> Option<Money> {
        price_lists
            .iter()
            .filter(|pl| pl.client_type == client_type && pl.is_valid_on(date))
            .filter_map(|pl| pl.get_price(product_id, quantity))
            .next()
    }
}
