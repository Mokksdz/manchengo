//! Application state management

use manchengo_database::Database;
use manchengo_sync::{EventStore, SyncQueue};
use std::sync::Mutex;

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
        // Create a new database connection for event store
        let event_db = Database::open(manchengo_database::DatabaseConfig {
            path: db.path().to_string(),
            ..Default::default()
        }).expect("Failed to open event store database");

        let sync_db = Database::open(manchengo_database::DatabaseConfig {
            path: db.path().to_string(),
            ..Default::default()
        }).expect("Failed to open sync queue database");

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
