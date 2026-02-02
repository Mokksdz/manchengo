//! Manchengo ERP Sync Engine
//!
//! Event-based synchronization for offline-first operation:
//! - Event log management
//! - Sync queue processing
//! - Conflict resolution
//! - Central server communication

pub mod event_store;
pub mod sync_queue;
pub mod conflict;
pub mod protocol;

pub use event_store::EventStore;
pub use sync_queue::SyncQueue;
pub use conflict::ConflictResolver;
