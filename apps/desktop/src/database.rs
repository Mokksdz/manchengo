//! SQLite database layer for offline-first storage
//!
//! Manages local SQLite database with same schema as mobile app.
//! Supports event sourcing for sync with central server.

use rusqlite::{Connection, Result, params};
use std::path::Path;
use serde_json::Value;

/// Initialize database with schema
pub fn init_database(db_path: &Path) -> Result<()> {
    let conn = Connection::open(db_path)?;
    
    // Create core tables
    conn.execute_batch(include_str!("../migrations/001_init.sql"))?;
    
    Ok(())
}

/// Execute a read query and return results as JSON
pub fn query(db_path: &str, sql: &str, params_json: &str) -> Result<String, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    let params: Vec<Value> = serde_json::from_str(params_json)
        .unwrap_or_else(|_| vec![]);
    
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    
    let column_names: Vec<String> = stmt.column_names()
        .iter()
        .map(|s| s.to_string())
        .collect();
    
    let rows = stmt.query_map([], |row| {
        let mut obj = serde_json::Map::new();
        for (i, name) in column_names.iter().enumerate() {
            let value: Value = match row.get_ref(i) {
                Ok(rusqlite::types::ValueRef::Null) => Value::Null,
                Ok(rusqlite::types::ValueRef::Integer(i)) => Value::Number(i.into()),
                Ok(rusqlite::types::ValueRef::Real(f)) => {
                    serde_json::Number::from_f64(f)
                        .map(Value::Number)
                        .unwrap_or(Value::Null)
                }
                Ok(rusqlite::types::ValueRef::Text(s)) => {
                    Value::String(String::from_utf8_lossy(s).to_string())
                }
                Ok(rusqlite::types::ValueRef::Blob(b)) => {
                    Value::String(base64::encode(b))
                }
                Err(_) => Value::Null,
            };
            obj.insert(name.clone(), value);
        }
        Ok(Value::Object(obj))
    }).map_err(|e| e.to_string())?;
    
    let results: Vec<Value> = rows.filter_map(|r| r.ok()).collect();
    serde_json::to_string(&results).map_err(|e| e.to_string())
}

/// Execute a write statement
pub fn execute(db_path: &str, sql: &str, params_json: &str) -> Result<i64, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    conn.execute(sql, []).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

/// Get pending sync events
pub fn get_pending_events(db_path: &str) -> Result<String, String> {
    query(
        db_path,
        "SELECT * FROM sync_events WHERE synced_at IS NULL ORDER BY occurred_at ASC",
        "[]",
    )
}

/// Mark events as synced
pub fn mark_events_synced(db_path: &str, event_ids: &[String]) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    let placeholders: Vec<String> = event_ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "UPDATE sync_events SET synced_at = datetime('now') WHERE id IN ({})",
        placeholders.join(", ")
    );
    
    conn.execute(&sql, rusqlite::params_from_iter(event_ids.iter()))
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Insert a sync event
pub fn insert_sync_event(
    db_path: &str,
    entity_type: &str,
    entity_id: &str,
    action: &str,
    payload: &str,
) -> Result<String, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO sync_events (id, entity_type, entity_id, action, payload, occurred_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, entity_type, entity_id, action, payload, now],
    ).map_err(|e| e.to_string())?;
    
    Ok(id)
}
