//! Product Repository
//!
//! Data access for ProductMp and ProductPf entities.

use manchengo_core::{Error, Result};
use manchengo_database::Database;
use rusqlite::{params, Row};
use std::sync::Arc;

use crate::dto::{ProductFilter, ProductMpDto, ProductPfDto, StockStatus};

/// Product repository for MP and PF
pub struct ProductRepository {
    db: Arc<Database>,
}

impl ProductRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    // =========================================================================
    // PRODUCT MP
    // =========================================================================

    /// List all MP products with optional filters
    pub fn list_mp(&self, filter: ProductFilter) -> Result<Vec<ProductMpDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT
                    p.id, p.code, p.name, p.unit,
                    COALESCE(p.category_id, '') as category,
                    COALESCE(p.min_stock_level, 0) as min_stock,
                    COALESCE(p.reorder_point, 0) as reorder_point,
                    COALESCE(p.is_perishable, 1) as is_perishable,
                    COALESCE(p.default_shelf_life_days, 30) as shelf_life_days,
                    COALESCE(p.is_active, 1) as is_active,
                    COALESCE(
                        (SELECT SUM(CASE WHEN m.movement_type = 'IN' THEN m.quantity ELSE -m.quantity END)
                         FROM stock_movements m WHERE m.product_type = 'MP' AND m.product_id = p.id),
                        0
                    ) as current_stock
                 FROM products_mp p
                 WHERE 1=1"
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if filter.active_only.unwrap_or(false) {
                sql.push_str(" AND p.is_active = 1");
            }

            if let Some(ref category) = filter.category {
                sql.push_str(" AND p.category_id = ?");
                params_vec.push(Box::new(category.clone()));
            }

            if let Some(ref search) = filter.search {
                sql.push_str(" AND (p.name LIKE ? OR p.code LIKE ?)");
                let pattern = format!("%{}%", search);
                params_vec.push(Box::new(pattern.clone()));
                params_vec.push(Box::new(pattern));
            }

            sql.push_str(" ORDER BY p.name");

            let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

            let mut result: Vec<ProductMpDto> = Vec::new();
            if params_vec.is_empty() {
                let products = stmt.query_map([], |row| Self::row_to_mp_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for product in products {
                    result.push(product.map_err(|e| Error::Database(e.to_string()))?);
                }
            } else {
                let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
                let products = stmt.query_map(params_refs.as_slice(), |row| Self::row_to_mp_dto(row))
                    .map_err(|e| Error::Database(e.to_string()))?;
                for product in products {
                    result.push(product.map_err(|e| Error::Database(e.to_string()))?);
                }
            }
            Ok(result)
        })
    }

    /// Get single MP product by ID
    pub fn get_mp(&self, id: &str) -> Result<Option<ProductMpDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT
                    p.id, p.code, p.name, p.unit,
                    COALESCE(p.category_id, '') as category,
                    COALESCE(p.min_stock_level, 0) as min_stock,
                    COALESCE(p.reorder_point, 0) as reorder_point,
                    COALESCE(p.is_perishable, 1) as is_perishable,
                    COALESCE(p.default_shelf_life_days, 30) as shelf_life_days,
                    COALESCE(p.is_active, 1) as is_active,
                    COALESCE(
                        (SELECT SUM(CASE WHEN m.movement_type = 'IN' THEN m.quantity ELSE -m.quantity END)
                         FROM stock_movements m WHERE m.product_type = 'MP' AND m.product_id = p.id),
                        0
                    ) as current_stock
                 FROM products_mp p
                 WHERE p.id = ?"
            ).map_err(|e| Error::Database(e.to_string()))?;

            match stmt.query_row([id], |row| Self::row_to_mp_dto(row)) {
                Ok(dto) => Ok(Some(dto)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(Error::Database(e.to_string())),
            }
        })
    }

    /// Create new MP product
    pub fn create_mp(&self, product: &ProductMpDto) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO products_mp (id, code, name, unit, category, min_stock, reorder_point, is_perishable, shelf_life_days, is_active, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
                params![
                    product.id,
                    product.code,
                    product.name,
                    product.unit,
                    product.category,
                    product.min_stock,
                    product.reorder_point,
                    product.is_perishable,
                    product.shelf_life_days,
                    product.is_active
                ]
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Update MP product
    pub fn update_mp(&self, product: &ProductMpDto) -> Result<()> {
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE products_mp SET
                    code = ?, name = ?, unit = ?, category = ?,
                    min_stock = ?, reorder_point = ?, is_perishable = ?,
                    shelf_life_days = ?, is_active = ?, updated_at = datetime('now')
                 WHERE id = ?",
                params![
                    product.code,
                    product.name,
                    product.unit,
                    product.category,
                    product.min_stock,
                    product.reorder_point,
                    product.is_perishable,
                    product.shelf_life_days,
                    product.is_active,
                    product.id
                ]
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
    }

    /// Count MP products
    pub fn count_mp(&self) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM products_mp WHERE is_active = 1",
                [],
                |row| row.get(0)
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    fn row_to_mp_dto(row: &Row) -> rusqlite::Result<ProductMpDto> {
        let current_stock: f64 = row.get(10)?;
        let min_stock: f64 = row.get(5)?;
        let reorder_point: f64 = row.get(6)?;

        Ok(ProductMpDto {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            unit: row.get(3)?,
            category: row.get(4)?,
            min_stock,
            reorder_point,
            is_perishable: row.get::<_, i32>(7)? == 1,
            shelf_life_days: row.get(8)?,
            is_active: row.get::<_, i32>(9)? == 1,
            current_stock,
            stock_status: StockStatus::from_levels(current_stock, min_stock, reorder_point),
        })
    }

    // =========================================================================
    // PRODUCT PF
    // =========================================================================

    /// List all PF products with optional filters
    pub fn list_pf(&self, filter: ProductFilter) -> Result<Vec<ProductPfDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT
                    p.id, p.code, p.name, p.unit,
                    COALESCE(p.category_id, '') as category,
                    COALESCE(p.min_stock_level, 0) as min_stock,
                    p.weight_kg,
                    COALESCE(p.base_price_ht, 0) as price_ht,
                    COALESCE(p.tva_rate, 0.19) as tva_rate,
                    COALESCE(p.is_active, 1) as is_active,
                    COALESCE(
                        (SELECT SUM(CASE WHEN m.movement_type = 'IN' THEN m.quantity ELSE -m.quantity END)
                         FROM stock_movements m WHERE m.product_type = 'PF' AND m.product_id = p.id),
                        0
                    ) as current_stock
                 FROM products_pf p
                 WHERE 1=1"
            );

            if filter.active_only.unwrap_or(false) {
                sql.push_str(" AND p.is_active = 1");
            }

            sql.push_str(" ORDER BY p.name");

            let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;
            let products = stmt.query_map([], |row| Self::row_to_pf_dto(row))
                .map_err(|e| Error::Database(e.to_string()))?;

            let mut result = Vec::new();
            for product in products {
                result.push(product.map_err(|e| Error::Database(e.to_string()))?);
            }
            Ok(result)
        })
    }

    /// Get single PF product by ID
    pub fn get_pf(&self, id: &str) -> Result<Option<ProductPfDto>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT
                    p.id, p.code, p.name, p.unit,
                    COALESCE(p.category_id, '') as category,
                    COALESCE(p.min_stock_level, 0) as min_stock,
                    p.weight_kg,
                    COALESCE(p.base_price_ht, 0) as price_ht,
                    COALESCE(p.tva_rate, 0.19) as tva_rate,
                    COALESCE(p.is_active, 1) as is_active,
                    COALESCE(
                        (SELECT SUM(CASE WHEN m.movement_type = 'IN' THEN m.quantity ELSE -m.quantity END)
                         FROM stock_movements m WHERE m.product_type = 'PF' AND m.product_id = p.id),
                        0
                    ) as current_stock
                 FROM products_pf p
                 WHERE p.id = ?"
            ).map_err(|e| Error::Database(e.to_string()))?;

            match stmt.query_row([id], |row| Self::row_to_pf_dto(row)) {
                Ok(dto) => Ok(Some(dto)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(Error::Database(e.to_string())),
            }
        })
    }

    /// Count PF products
    pub fn count_pf(&self) -> Result<u64> {
        self.db.with_connection(|conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM products_pf WHERE is_active = 1",
                [],
                |row| row.get(0)
            ).map_err(|e| Error::Database(e.to_string()))?;
            Ok(count as u64)
        })
    }

    fn row_to_pf_dto(row: &Row) -> rusqlite::Result<ProductPfDto> {
        let current_stock: f64 = row.get(10)?;
        let min_stock: f64 = row.get(5)?;

        Ok(ProductPfDto {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            unit: row.get(3)?,
            category: row.get(4)?,
            min_stock,
            weight_kg: row.get(6)?,
            price_ht: row.get(7)?,
            tva_rate: row.get::<_, f64>(8).unwrap_or(0.19),
            is_active: row.get::<_, i32>(9)? == 1,
            current_stock,
            stock_status: StockStatus::from_levels(current_stock, min_stock, min_stock * 1.5),
        })
    }
}
