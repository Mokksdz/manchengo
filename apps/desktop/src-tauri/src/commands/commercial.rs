//! Commercial domain commands

use crate::state::AppState;
use manchengo_core::Error;
use serde::Serialize;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct ClientDto {
    pub id: String,
    pub code: String,
    pub name: String,
    pub client_type: String,
    pub phone: Option<String>,
    pub current_balance: i64,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct SalesOrderDto {
    pub id: String,
    pub order_number: String,
    pub client_id: String,
    pub client_name: String,
    pub order_date: String,
    pub status: String,
    pub total_ttc: i64,
    pub payment_status: String,
}

/// List clients
#[tauri::command]
pub fn list_clients(
    state: State<Arc<AppState>>,
    _client_type: Option<String>,
    _active_only: Option<bool>,
) -> Result<Vec<ClientDto>, String> {
    state.db.with_connection(|conn| {
        let sql = "SELECT id, code, name, client_type, phone, current_balance, is_active
             FROM clients ORDER BY name";

        let mut stmt = conn.prepare(sql).map_err(|e| Error::Database(e.to_string()))?;

        let clients = stmt
            .query_map([], |row| {
                Ok(ClientDto {
                    id: row.get(0)?,
                    code: row.get(1)?,
                    name: row.get(2)?,
                    client_type: row.get(3)?,
                    phone: row.get(4)?,
                    current_balance: row.get(5)?,
                    is_active: row.get::<_, i32>(6)? == 1,
                })
            })
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for client in clients {
            result.push(client.map_err(|e: rusqlite::Error| Error::Database(e.to_string()))?);
        }

        Ok(result)
    }).map_err(|e| e.to_string())
}

/// Get a specific client
#[tauri::command]
pub fn get_client(
    state: State<Arc<AppState>>,
    id: String,
) -> Result<Option<ClientDto>, String> {
    state.db.with_connection(|conn| {
        let result = conn.query_row(
            "SELECT id, code, name, client_type, phone, current_balance, is_active
             FROM clients WHERE id = ?1",
            [&id],
            |row| {
                Ok(ClientDto {
                    id: row.get(0)?,
                    code: row.get(1)?,
                    name: row.get(2)?,
                    client_type: row.get(3)?,
                    phone: row.get(4)?,
                    current_balance: row.get(5)?,
                    is_active: row.get::<_, i32>(6)? == 1,
                })
            },
        );

        match result {
            Ok(client) => Ok(Some(client)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Error::Database(e.to_string())),
        }
    }).map_err(|e| e.to_string())
}

/// List sales orders
#[tauri::command]
pub fn list_sales_orders(
    state: State<Arc<AppState>>,
    _client_id: Option<String>,
    _status: Option<String>,
) -> Result<Vec<SalesOrderDto>, String> {
    state.db.with_connection(|conn| {
        let sql = "SELECT so.id, so.order_number, so.client_id, c.name, so.order_date,
                    so.status, so.total_ttc, so.payment_status
             FROM sales_orders so
             JOIN clients c ON so.client_id = c.id
             ORDER BY so.order_date DESC";

        let mut stmt = conn.prepare(sql).map_err(|e| Error::Database(e.to_string()))?;

        let orders = stmt
            .query_map([], |row| {
                Ok(SalesOrderDto {
                    id: row.get(0)?,
                    order_number: row.get(1)?,
                    client_id: row.get(2)?,
                    client_name: row.get(3)?,
                    order_date: row.get(4)?,
                    status: row.get(5)?,
                    total_ttc: row.get(6)?,
                    payment_status: row.get(7)?,
                })
            })
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for order in orders {
            result.push(order.map_err(|e| Error::Database(e.to_string()))?);
        }

        Ok(result)
    }).map_err(|e| e.to_string())
}
