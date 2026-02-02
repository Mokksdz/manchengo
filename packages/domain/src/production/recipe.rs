//! Production recipes (Fiches techniques)

use manchengo_core::{AuditInfo, EntityId, UnitOfMeasure};
use serde::{Deserialize, Serialize};

/// Production recipe definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recipe {
    pub id: EntityId,
    pub code: String,
    pub name: String,
    pub product_pf_id: EntityId,
    pub output_quantity: f64,
    pub output_unit: UnitOfMeasure,
    pub description: Option<String>,
    pub ingredients: Vec<RecipeIngredient>,
    pub is_active: bool,
    pub audit: AuditInfo,
}

/// Ingredient in a recipe
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeIngredient {
    pub id: EntityId,
    pub recipe_id: EntityId,
    pub product_mp_id: EntityId,
    pub quantity: f64,
    pub unit: UnitOfMeasure,
    pub is_optional: bool,
    pub notes: Option<String>,
}

impl Recipe {
    pub fn new(
        code: String,
        name: String,
        product_pf_id: EntityId,
        output_quantity: f64,
        output_unit: UnitOfMeasure,
        user_id: EntityId,
    ) -> Self {
        Self {
            id: EntityId::new(),
            code,
            name,
            product_pf_id,
            output_quantity,
            output_unit,
            description: None,
            ingredients: Vec::new(),
            is_active: true,
            audit: AuditInfo::new(user_id),
        }
    }

    pub fn add_ingredient(
        &mut self,
        product_mp_id: EntityId,
        quantity: f64,
        unit: UnitOfMeasure,
    ) {
        self.ingredients.push(RecipeIngredient {
            id: EntityId::new(),
            recipe_id: self.id,
            product_mp_id,
            quantity,
            unit,
            is_optional: false,
            notes: None,
        });
    }

    /// Scale ingredients for a given output quantity
    pub fn scale_ingredients(&self, target_quantity: f64) -> Vec<(EntityId, f64, UnitOfMeasure)> {
        let ratio = target_quantity / self.output_quantity;
        self.ingredients
            .iter()
            .map(|ing| (ing.product_mp_id, ing.quantity * ratio, ing.unit))
            .collect()
    }
}
