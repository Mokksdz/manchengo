//! Delivery domain commands

use crate::state::AppState;
use manchengo_core::Error;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct DeliveryDto {
    pub id: String,
    pub delivery_number: String,
    pub planned_date: String,
    pub status: String,
    pub vehicle_id: Option<String>,
    pub driver_name: Option<String>,
    pub total_ttc: i64,
    pub client_count: i32,
    pub qr_code: String,
}

/// List deliveries
#[tauri::command]
pub fn list_deliveries(
    state: State<Arc<AppState>>,
    _status: Option<String>,
    _date: Option<String>,
) -> Result<Vec<DeliveryDto>, String> {
    state.db.with_connection(|conn| {
        let sql = "SELECT d.id, d.delivery_number, d.planned_date, d.status,
                    d.vehicle_id, d.driver_name, d.total_ttc,
                    (SELECT COUNT(*) FROM delivery_lines dl WHERE dl.delivery_id = d.id) as client_count,
                    d.qr_code
             FROM deliveries d ORDER BY d.planned_date DESC";

        let mut stmt = conn.prepare(sql).map_err(|e| Error::Database(e.to_string()))?;

        let deliveries = stmt
            .query_map([], |row| {
                Ok(DeliveryDto {
                    id: row.get(0)?,
                    delivery_number: row.get(1)?,
                    planned_date: row.get(2)?,
                    status: row.get(3)?,
                    vehicle_id: row.get(4)?,
                    driver_name: row.get(5)?,
                    total_ttc: row.get(6)?,
                    client_count: row.get(7)?,
                    qr_code: row.get(8)?,
                })
            })
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for delivery in deliveries {
            result.push(delivery.map_err(|e: rusqlite::Error| Error::Database(e.to_string()))?);
        }

        Ok(result)
    }).map_err(|e| e.to_string())
}

/// Get a specific delivery
#[tauri::command]
pub fn get_delivery(
    state: State<Arc<AppState>>,
    id: String,
) -> Result<Option<DeliveryDto>, String> {
    state.db.with_connection(|conn| {
        let result = conn.query_row(
            "SELECT d.id, d.delivery_number, d.planned_date, d.status,
                    d.vehicle_id, d.driver_name, d.total_ttc,
                    (SELECT COUNT(*) FROM delivery_lines dl WHERE dl.delivery_id = d.id),
                    d.qr_code
             FROM deliveries d WHERE d.id = ?1",
            [&id],
            |row| {
                Ok(DeliveryDto {
                    id: row.get(0)?,
                    delivery_number: row.get(1)?,
                    planned_date: row.get(2)?,
                    status: row.get(3)?,
                    vehicle_id: row.get(4)?,
                    driver_name: row.get(5)?,
                    total_ttc: row.get(6)?,
                    client_count: row.get(7)?,
                    qr_code: row.get(8)?,
                })
            },
        );

        match result {
            Ok(delivery) => Ok(Some(delivery)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Error::Database(e.to_string())),
        }
    }).map_err(|e| e.to_string())
}
