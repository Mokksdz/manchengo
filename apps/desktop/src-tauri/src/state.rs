//! Application state management

use manchengo_database::Database;
use manchengo_sync::{EventStore, SyncQueue};
use std::sync::Mutex;
use tracing::error;

/// Global application state
pub struct AppState {
    pub db: Database,
    pub event_store: EventStore,
    pub sync_queue: SyncQueue,
    pub current_user_id: Mutex<Option<manchengo_core::EntityId>>,
    pub device_id: manchengo_core::EntityId,
}

impl AppState {
    pub fn new(db: Database) -> Self {
        let db_path = db.path().to_string();

        let event_db = match Database::open(manchengo_database::DatabaseConfig {
            path: db_path.clone(),
            ..Default::default()
        }) {
            Ok(db) => db,
            Err(e) => {
                error!("Failed to open event store database: {}", e);
                eprintln!("Error: Could not open event store database: {}", e);
                std::process::exit(1);
            }
        };

        let sync_db = match Database::open(manchengo_database::DatabaseConfig {
            path: db_path,
            ..Default::default()
        }) {
            Ok(db) => db,
            Err(e) => {
                error!("Failed to open sync queue database: {}", e);
                eprintln!("Error: Could not open sync queue database: {}", e);
                std::process::exit(1);
            }
        };

        Self {
            db,
            event_store: EventStore::new(event_db),
            sync_queue: SyncQueue::new(sync_db),
            current_user_id: Mutex::new(None),
            device_id: manchengo_core::EntityId::new(),
        }
    }

    pub fn set_current_user(&self, user_id: manchengo_core::EntityId) {
        let mut current = self.current_user_id.lock().unwrap();
        *current = Some(user_id);
    }

    pub fn get_current_user(&self) -> Option<manchengo_core::EntityId> {
        self.current_user_id.lock().unwrap().clone()
    }

    pub fn require_user(&self) -> Result<manchengo_core::EntityId, String> {
        self.get_current_user()
            .ok_or_else(|| "No user logged in".to_string())
    }
}
