//! Recipe Repository
//!
//! Data access for Recipe and RecipeItem entities.

use manchengo_core::{Error, Result};
use manchengo_database::Database;
use rusqlite::{params, Row, OptionalExtension};
use std::sync::Arc;

use crate::dto::{
    CreateRecipeDto, CreateRecipeItemDto, RecipeDto, RecipeFilter, RecipeItemDto, RecipeItemType,
};

/// Recipe repository for CRUD operations
pub struct RecipeRepository {
    db: Arc<Database>,
}

impl RecipeRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// List recipes with optional filter
    pub fn list(&self, filter: RecipeFilter) -> Result<Vec<RecipeDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT r.id, r.name, r.code, r.product_pf_id,
                        pf.name as pf_name, pf.code as pf_code,
                        10.0 as batch_weight, r.output_quantity, r.output_unit,
                        0.05 as loss_tolerance, 90 as shelf_life_days, r.is_active,
                        r.created_at, r.updated_at
                 FROM recipes r
                 LEFT JOIN products_pf pf ON pf.id = r.product_pf_id
                 WHERE 1=1",
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(active_only) = filter.active_only {
                if active_only {
                    sql.push_str(" AND r.is_active = 1");
                }
            }

            if let Some(ref product_pf_id) = filter.product_pf_id {
                sql.push_str(" AND r.product_pf_id = ?");
                params_vec.push(Box::new(product_pf_id.clone()));
            }

            if let Some(ref search) = filter.search {
                sql.push_str(" AND (r.name LIKE ? OR r.code LIKE ? OR pf.name LIKE ?)");
                let search_pattern = format!("%{}%", search);
                params_vec.push(Box::new(search_pattern.clone()));
                params_vec.push(Box::new(search_pattern.clone()));
                params_vec.push(Box::new(search_pattern));
            }

            sql.push_str(" ORDER BY r.name ASC");

            let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

            let mut result: Vec<RecipeDto> = Vec::new();

            if params_vec.is_empty() {
                let recipes = stmt
                    .query_map([], |row| Self::row_to_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for recipe in recipes {
                    let mut dto = recipe.map_err(|e| Error::Database(e.to_string()))?;
                    dto.items = self.get_recipe_items_internal(conn, &dto.id)?;
                    result.push(dto);
                }
            } else {
                let params_refs: Vec<&dyn rusqlite::ToSql> =
                    params_vec.iter().map(|p| p.as_ref()).collect();
                let recipes = stmt
                    .query_map(params_refs.as_slice(), |row| Self::row_to_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for recipe in recipes {
                    let mut dto = recipe.map_err(|e| Error::Database(e.to_string()))?;
                    dto.items = self.get_recipe_items_internal(conn, &dto.id)?;
                    result.push(dto);
                }
            }

            Ok(result)
        })
    }

    /// Get single recipe by ID
    pub fn get(&self, id: &str) -> Result<Option<RecipeDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT r.id, r.name, r.code, r.product_pf_id,
                            pf.name as pf_name, pf.code as pf_code,
                            r.batch_weight, r.output_quantity, r.output_unit,
                            r.loss_tolerance, r.shelf_life_days, r.is_active,
                            r.created_at, r.updated_at
                     FROM recipes r
                     LEFT JOIN products_pf pf ON pf.id = r.product_pf_id
                     WHERE r.id = ?",
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            let recipe = stmt
                .query_row([id], |row| Self::row_to_dto(row))
                .optional()
                .map_err(|e| Error::Database(e.to_string()))?;

            if let Some(mut dto) = recipe {
                dto.items = self.get_recipe_items_internal(conn, &dto.id)?;
                Ok(Some(dto))
            } else {
                Ok(None)
            }
        })
    }

    /// Get recipe by product PF ID (active recipe)
    pub fn get_by_product_pf(&self, product_pf_id: &str) -> Result<Option<RecipeDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT r.id, r.name, r.code, r.product_pf_id,
                            pf.name as pf_name, pf.code as pf_code,
                            r.batch_weight, r.output_quantity, r.output_unit,
                            r.loss_tolerance, r.shelf_life_days, r.is_active,
                            r.created_at, r.updated_at
                     FROM recipes r
                     LEFT JOIN products_pf pf ON pf.id = r.product_pf_id
                     WHERE r.product_pf_id = ? AND r.is_active = 1
                     ORDER BY r.created_at DESC
                     LIMIT 1",
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            let recipe = stmt
                .query_row([product_pf_id], |row| Self::row_to_dto(row))
                .optional()
                .map_err(|e| Error::Database(e.to_string()))?;

            if let Some(mut dto) = recipe {
                dto.items = self.get_recipe_items_internal(conn, &dto.id)?;
                Ok(Some(dto))
            } else {
                Ok(None)
            }
        })
    }

    /// Create new recipe
    pub fn create(&self, id: &str, code: &str, data: &CreateRecipeDto) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO recipes (
                    id, name, code, product_pf_id, batch_weight, output_quantity,
                    output_unit, loss_tolerance, shelf_life_days, is_active,
                    created_at, is_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, 'UNIT', ?, ?, 1, datetime('now'), 0)",
                params![
                    id,
                    data.name,
                    code,
                    data.product_pf_id,
                    data.batch_weight,
                    data.output_quantity,
                    data.loss_tolerance.unwrap_or(0.05),
                    data.shelf_life_days.unwrap_or(90),
                ],
            )
            .map_err(|e| Error::Database(e.to_string()))?;

            // Insert recipe items
            for (idx, item) in data.items.iter().enumerate() {
                let item_id = manchengo_core::EntityId::new().to_string();
                self.create_recipe_item_internal(conn, &item_id, id, item, idx as i32 + 1)?;
            }

            Ok(())
        })
    }

    /// Update recipe
    pub fn update(&self, id: &str, data: &CreateRecipeDto) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE recipes SET
                    name = ?, batch_weight = ?, output_quantity = ?,
                    loss_tolerance = ?, shelf_life_days = ?, updated_at = datetime('now')
                 WHERE id = ?",
                params![
                    data.name,
                    data.batch_weight,
                    data.output_quantity,
                    data.loss_tolerance.unwrap_or(0.05),
                    data.shelf_life_days.unwrap_or(90),
                    id,
                ],
            )
            .map_err(|e| Error::Database(e.to_string()))?;

            // Delete old items
            conn.execute("DELETE FROM recipe_items WHERE recipe_id = ?", [id])
                .map_err(|e| Error::Database(e.to_string()))?;

            // Insert new items
            for (idx, item) in data.items.iter().enumerate() {
                let item_id = manchengo_core::EntityId::new().to_string();
                self.create_recipe_item_internal(conn, &item_id, id, item, idx as i32 + 1)?;
            }

            Ok(())
        })
    }

    /// Soft delete recipe
    pub fn delete(&self, id: &str) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE recipes SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?",
                [id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Activate/deactivate recipe
    pub fn set_active(&self, id: &str, active: bool) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE recipes SET is_active = ?, updated_at = datetime('now') WHERE id = ?",
                params![active, id],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Generate unique recipe code
    pub fn generate_code(&self) -> Result<String> {
        self.db.with_connection(|conn| {
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM recipes", [], |row| row.get(0))
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(format!("REC-{:04}", count + 1))
        })
    }

    /// Count recipes
    pub fn count(&self) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM recipes",
                    [],
                    |row| row.get(0),
                )
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    // Internal helpers

    fn get_recipe_items_internal(
        &self,
        conn: &rusqlite::Connection,
        recipe_id: &str,
    ) -> Result<Vec<RecipeItemDto>> {
        let mut stmt = conn
            .prepare(
                "SELECT ri.id, ri.item_type, ri.product_mp_id,
                        mp.name as mp_name, mp.code as mp_code,
                        ri.quantity, ri.unit, ri.affects_stock, ri.is_mandatory, ri.sort_order
                 FROM recipe_items ri
                 LEFT JOIN products_mp mp ON mp.id = ri.product_mp_id
                 WHERE ri.recipe_id = ?
                 ORDER BY ri.sort_order ASC",
            )
            .map_err(|e| Error::Database(e.to_string()))?;

        let items = stmt
            .query_map([recipe_id], |row| {
                Ok(RecipeItemDto {
                    id: row.get(0)?,
                    item_type: match row.get::<_, String>(1)?.as_str() {
                        "FLUID" => RecipeItemType::Fluid,
                        "PACKAGING" => RecipeItemType::Packaging,
                        _ => RecipeItemType::Mp,
                    },
                    product_mp_id: row.get(2)?,
                    product_mp_name: row.get(3)?,
                    product_mp_code: row.get(4)?,
                    quantity: row.get(5)?,
                    unit: row.get(6)?,
                    affects_stock: row.get(7)?,
                    is_mandatory: row.get(8)?,
                    sort_order: row.get(9)?,
                })
            })
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for item in items {
            result.push(item.map_err(|e| Error::Database(e.to_string()))?);
        }
        Ok(result)
    }

    fn create_recipe_item_internal(
        &self,
        conn: &rusqlite::Connection,
        id: &str,
        recipe_id: &str,
        item: &CreateRecipeItemDto,
        sort_order: i32,
    ) -> Result<()> {
        conn.execute(
            "INSERT INTO recipe_items (
                id, recipe_id, item_type, product_mp_id, quantity, unit,
                affects_stock, is_mandatory, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                id,
                recipe_id,
                item.item_type,
                item.product_mp_id,
                item.quantity,
                item.unit,
                item.affects_stock.unwrap_or(true),
                item.is_mandatory.unwrap_or(true),
                item.sort_order.unwrap_or(sort_order),
            ],
        )
        .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    fn row_to_dto(row: &Row) -> rusqlite::Result<RecipeDto> {
        Ok(RecipeDto {
            id: row.get(0)?,
            name: row.get(1)?,
            code: row.get(2)?,
            product_pf_id: row.get(3)?,
            product_pf_name: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            product_pf_code: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            batch_weight: row.get(6)?,
            output_quantity: row.get(7)?,
            output_unit: row.get(8)?,
            loss_tolerance: row.get(9)?,
            shelf_life_days: row.get(10)?,
            is_active: row.get(11)?,
            items: Vec::new(), // Will be populated separately
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
        })
    }
}
