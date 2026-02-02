//! Stock domain commands

use crate::state::AppState;
use manchengo_core::Error;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct ProductMpDto {
    pub id: String,
    pub code: String,
    pub name: String,
    pub unit: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct LotMpDto {
    pub id: String,
    pub lot_number: String,
    pub product_id: String,
    pub quantity_remaining: f64,
    pub unit: String,
    pub status: String,
    pub reception_date: String,
    pub expiry_date: Option<String>,
    pub qr_code: String,
}

/// List all raw material products
#[tauri::command]
pub fn list_products_mp(
    state: State<Arc<AppState>>,
    active_only: Option<bool>,
) -> Result<Vec<ProductMpDto>, String> {
    state.db.with_connection(|conn| {
        let active_filter = if active_only.unwrap_or(true) {
            "WHERE is_active = 1"
        } else {
            ""
        };

        let mut stmt = conn
            .prepare(&format!(
                "SELECT id, code, name, unit, is_active FROM products_mp {} ORDER BY name",
                active_filter
            ))
            .map_err(|e| Error::Database(e.to_string()))?;

        let products = stmt
            .query_map([], |row| {
                Ok(ProductMpDto {
                    id: row.get(0)?,
                    code: row.get(1)?,
                    name: row.get(2)?,
                    unit: row.get(3)?,
                    is_active: row.get::<_, i32>(4)? == 1,
                })
            })
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for p in products {
            result.push(p.map_err(|e: rusqlite::Error| Error::Database(e.to_string()))?);
        }

        Ok(result)
    }).map_err(|e| e.to_string())
}

/// Get a specific raw material product
#[tauri::command]
pub fn get_product_mp(
    state: State<Arc<AppState>>,
    id: String,
) -> Result<Option<ProductMpDto>, String> {
    state.db.with_connection(|conn| {
        let result = conn.query_row(
            "SELECT id, code, name, unit, is_active FROM products_mp WHERE id = ?1",
            [&id],
            |row| {
                Ok(ProductMpDto {
                    id: row.get(0)?,
                    code: row.get(1)?,
                    name: row.get(2)?,
                    unit: row.get(3)?,
                    is_active: row.get::<_, i32>(4)? == 1,
                })
            },
        );

        match result {
            Ok(product) => Ok(Some(product)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Error::Database(e.to_string())),
        }
    }).map_err(|e| e.to_string())
}

/// List raw material lots
#[tauri::command]
pub fn list_lots_mp(
    state: State<Arc<AppState>>,
    product_id: Option<String>,
    status: Option<String>,
) -> Result<Vec<LotMpDto>, String> {
    state.db.with_connection(|conn| {
        let mut conditions = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref pid) = product_id {
            conditions.push("product_id = ?");
            params.push(Box::new(pid.clone()));
        }

        if let Some(ref s) = status {
            conditions.push("status = ?");
            params.push(Box::new(s.clone()));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let sql = format!(
            "SELECT id, lot_number, product_id, quantity_remaining, unit, status, 
                    reception_date, expiry_date, qr_code 
             FROM lots_mp {} 
             ORDER BY reception_date ASC",
            where_clause
        );

        let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let lots = stmt
            .query_map(rusqlite::params_from_iter(param_refs), |row| {
                Ok(LotMpDto {
                    id: row.get(0)?,
                    lot_number: row.get(1)?,
                    product_id: row.get(2)?,
                    quantity_remaining: row.get(3)?,
                    unit: row.get(4)?,
                    status: row.get(5)?,
                    reception_date: row.get(6)?,
                    expiry_date: row.get(7)?,
                    qr_code: row.get(8)?,
                })
            })
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for lot in lots {
            result.push(lot.map_err(|e: rusqlite::Error| Error::Database(e.to_string()))?);
        }

        Ok(result)
    }).map_err(|e| e.to_string())
}

/// Get a specific lot
#[tauri::command]
pub fn get_lot_mp(
    state: State<Arc<AppState>>,
    id: String,
) -> Result<Option<LotMpDto>, String> {
    state.db.with_connection(|conn| {
        let result = conn.query_row(
            "SELECT id, lot_number, product_id, quantity_remaining, unit, status,
                    reception_date, expiry_date, qr_code
             FROM lots_mp WHERE id = ?1",
            [&id],
            |row| {
                Ok(LotMpDto {
                    id: row.get(0)?,
                    lot_number: row.get(1)?,
                    product_id: row.get(2)?,
                    quantity_remaining: row.get(3)?,
                    unit: row.get(4)?,
                    status: row.get(5)?,
                    reception_date: row.get(6)?,
                    expiry_date: row.get(7)?,
                    qr_code: row.get(8)?,
                })
            },
        );

        match result {
            Ok(lot) => Ok(Some(lot)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Error::Database(e.to_string())),
        }
    }).map_err(|e| e.to_string())
}
