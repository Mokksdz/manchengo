//! Product definitions for raw materials and finished products

use chrono::{DateTime, Utc};
use manchengo_core::{AuditInfo, EntityId, Money, UnitOfMeasure};
use serde::{Deserialize, Serialize};

/// Raw material product definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductMp {
    pub id: EntityId,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub category_id: Option<EntityId>,
    pub unit: UnitOfMeasure,
    pub min_stock_level: f64,
    pub reorder_point: f64,
    pub is_perishable: bool,
    pub default_shelf_life_days: Option<i32>,
    pub is_active: bool,
    pub audit: AuditInfo,
}

impl ProductMp {
    pub fn new(
        code: String,
        name: String,
        unit: UnitOfMeasure,
        user_id: EntityId,
    ) -> Self {
        Self {
            id: EntityId::new(),
            code,
            name,
            description: None,
            category_id: None,
            unit,
            min_stock_level: 0.0,
            reorder_point: 0.0,
            is_perishable: true,
            default_shelf_life_days: None,
            is_active: true,
            audit: AuditInfo::new(user_id),
        }
    }
}

/// Finished product definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductPf {
    pub id: EntityId,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub category_id: Option<EntityId>,
    pub unit: UnitOfMeasure,
    pub weight_kg: Option<f64>,
    pub min_stock_level: f64,
    pub is_perishable: bool,
    pub default_shelf_life_days: Option<i32>,
    pub base_price_ht: Money,
    pub tva_rate: f64,
    pub is_active: bool,
    pub audit: AuditInfo,
}

impl ProductPf {
    pub fn new(
        code: String,
        name: String,
        unit: UnitOfMeasure,
        base_price_ht: Money,
        user_id: EntityId,
    ) -> Self {
        Self {
            id: EntityId::new(),
            code,
            name,
            description: None,
            category_id: None,
            unit,
            weight_kg: None,
            min_stock_level: 0.0,
            is_perishable: true,
            default_shelf_life_days: None,
            base_price_ht,
            tva_rate: 0.19, // Standard Algerian TVA
            is_active: true,
            audit: AuditInfo::new(user_id),
        }
    }

    /// Calculate TTC price from HT
    pub fn calculate_ttc(&self, price_ht: Money) -> Money {
        let tva = Money::from_centimes((price_ht.centimes() as f64 * self.tva_rate) as i64);
        price_ht + tva
    }
}
