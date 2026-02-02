//! Vehicle management

use manchengo_core::EntityId;
use serde::{Deserialize, Serialize};

/// Delivery vehicle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vehicle {
    pub id: EntityId,
    pub code: String,
    pub name: String,
    pub license_plate: String,
    pub capacity_kg: Option<f64>,
    pub is_active: bool,
}

impl Vehicle {
    pub fn new(code: String, name: String, license_plate: String) -> Self {
        Self {
            id: EntityId::new(),
            code,
            name,
            license_plate,
            capacity_kg: None,
            is_active: true,
        }
    }

    pub fn can_carry(&self, weight_kg: f64) -> bool {
        match self.capacity_kg {
            Some(capacity) => weight_kg <= capacity,
            None => true, // No limit set
        }
    }
}
