//! Manchengo ERP Database Layer
//!
//! Provides SQLite database access with:
//! - Connection management
//! - Schema migrations
//! - Repository pattern implementation
//! - Event log for sync

pub mod connection;
pub mod migrations;
pub mod repository;
pub mod schema;

pub use connection::{Database, DatabaseConfig};
pub use repository::Repository;
