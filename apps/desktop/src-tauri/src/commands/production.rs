//! Production domain commands

use crate::state::AppState;
use manchengo_core::Error;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct ProductionOrderDto {
    pub id: String,
    pub order_number: String,
    pub product_pf_id: String,
    pub planned_quantity: f64,
    pub actual_quantity: Option<f64>,
    pub status: String,
    pub planned_date: String,
    pub qr_code: String,
}

/// List production orders
#[tauri::command]
pub fn list_production_orders(
    state: State<Arc<AppState>>,
    _status: Option<String>,
) -> Result<Vec<ProductionOrderDto>, String> {
    state.db.with_connection(|conn| {
        let sql = "SELECT id, order_number, product_pf_id, planned_quantity, actual_quantity,
                    status, planned_date, qr_code
             FROM production_orders ORDER BY planned_date DESC";

        let mut stmt = conn.prepare(sql).map_err(|e| Error::Database(e.to_string()))?;

        let orders = stmt
            .query_map([], |row| {
                Ok(ProductionOrderDto {
                    id: row.get(0)?,
                    order_number: row.get(1)?,
                    product_pf_id: row.get(2)?,
                    planned_quantity: row.get(3)?,
                    actual_quantity: row.get(4)?,
                    status: row.get(5)?,
                    planned_date: row.get(6)?,
                    qr_code: row.get(7)?,
                })
            })
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for order in orders {
            result.push(order.map_err(|e: rusqlite::Error| Error::Database(e.to_string()))?);
        }

        Ok(result)
    }).map_err(|e| e.to_string())
}

/// Get a specific production order
#[tauri::command]
pub fn get_production_order(
    state: State<Arc<AppState>>,
    id: String,
) -> Result<Option<ProductionOrderDto>, String> {
    state.db.with_connection(|conn| {
        let result = conn.query_row(
            "SELECT id, order_number, product_pf_id, planned_quantity, actual_quantity,
                    status, planned_date, qr_code
             FROM production_orders WHERE id = ?1",
            [&id],
            |row| {
                Ok(ProductionOrderDto {
                    id: row.get(0)?,
                    order_number: row.get(1)?,
                    product_pf_id: row.get(2)?,
                    planned_quantity: row.get(3)?,
                    actual_quantity: row.get(4)?,
                    status: row.get(5)?,
                    planned_date: row.get(6)?,
                    qr_code: row.get(7)?,
                })
            },
        );

        match result {
            Ok(order) => Ok(Some(order)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Error::Database(e.to_string())),
        }
    }).map_err(|e| e.to_string())
}
