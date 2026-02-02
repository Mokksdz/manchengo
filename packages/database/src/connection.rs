//! Database connection management

use manchengo_core::{Error, Result};
use rusqlite::{Connection, OpenFlags};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tracing::{debug, info};

/// Database configuration
#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    /// Path to SQLite database file
    pub path: String,
    /// Enable WAL mode for better concurrency
    pub wal_mode: bool,
    /// Enable foreign key constraints
    pub foreign_keys: bool,
    /// Busy timeout in milliseconds
    pub busy_timeout_ms: u32,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            path: "manchengo.db".to_string(),
            wal_mode: true,
            foreign_keys: true,
            busy_timeout_ms: 5000,
        }
    }
}

impl DatabaseConfig {
    /// Create in-memory database config (for testing)
    pub fn in_memory() -> Self {
        Self {
            path: ":memory:".to_string(),
            ..Default::default()
        }
    }
}

/// Database wrapper with connection pooling
pub struct Database {
    config: DatabaseConfig,
    connection: Arc<Mutex<Connection>>,
}

impl Database {
    /// Open or create database with given configuration
    pub fn open(config: DatabaseConfig) -> Result<Self> {
        info!("Opening database at: {}", config.path);

        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_FULL_MUTEX;

        let conn = if config.path == ":memory:" {
            Connection::open_in_memory()
        } else {
            Connection::open_with_flags(&config.path, flags)
        }
        .map_err(|e| Error::Database(e.to_string()))?;

        let db = Self {
            config: config.clone(),
            connection: Arc::new(Mutex::new(conn)),
        };

        db.apply_pragmas()?;
        debug!("Database opened successfully");

        Ok(db)
    }

    /// Apply SQLite pragmas for optimal performance
    fn apply_pragmas(&self) -> Result<()> {
        let conn = self.connection.lock().map_err(|e| Error::Database(e.to_string()))?;

        if self.config.wal_mode {
            conn.execute_batch("PRAGMA journal_mode = WAL;")
                .map_err(|e| Error::Database(e.to_string()))?;
        }

        conn.execute_batch(&format!(
            "PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = {};
             PRAGMA busy_timeout = {};
             PRAGMA cache_size = -64000;
             PRAGMA temp_store = MEMORY;",
            if self.config.foreign_keys { "ON" } else { "OFF" },
            self.config.busy_timeout_ms
        ))
        .map_err(|e| Error::Database(e.to_string()))?;

        debug!("Database pragmas applied");
        Ok(())
    }

    /// Execute a function with database connection
    pub fn with_connection<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T>,
    {
        let conn = self.connection.lock().map_err(|e| Error::Database(e.to_string()))?;
        f(&conn)
    }

    /// Execute a function with mutable database connection (for transactions)
    pub fn with_connection_mut<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&mut Connection) -> Result<T>,
    {
        let mut conn = self.connection.lock().map_err(|e| Error::Database(e.to_string()))?;
        f(&mut conn)
    }

    /// Execute within a transaction
    pub fn transaction<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&rusqlite::Transaction) -> Result<T>,
    {
        let mut conn = self.connection.lock().map_err(|e| Error::Database(e.to_string()))?;
        let tx = conn.transaction().map_err(|e| Error::Database(e.to_string()))?;

        match f(&tx) {
            Ok(result) => {
                tx.commit().map_err(|e| Error::Database(e.to_string()))?;
                Ok(result)
            }
            Err(e) => {
                // Transaction will rollback on drop
                Err(e)
            }
        }
    }

    /// Check if database file exists
    pub fn exists(path: &str) -> bool {
        if path == ":memory:" {
            return false;
        }
        Path::new(path).exists()
    }

    /// Get database path
    pub fn path(&self) -> &str {
        &self.config.path
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_in_memory() {
        let db = Database::open(DatabaseConfig::in_memory()).unwrap();
        assert_eq!(db.path(), ":memory:");
    }

    #[test]
    fn test_with_connection() {
        let db = Database::open(DatabaseConfig::in_memory()).unwrap();

        let result = db.with_connection(|conn| {
            conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY)", [])
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(42)
        });

        assert_eq!(result.unwrap(), 42);
    }

    #[test]
    fn test_transaction_commit() {
        let db = Database::open(DatabaseConfig::in_memory()).unwrap();

        db.with_connection(|conn| {
            conn.execute("CREATE TABLE test (value INTEGER)", [])
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
        .unwrap();

        db.transaction(|tx| {
            tx.execute("INSERT INTO test VALUES (1)", [])
                .map_err(|e| Error::Database(e.to_string()))?;
            Ok(())
        })
        .unwrap();

        let count: i64 = db
            .with_connection(|conn| {
                conn.query_row("SELECT COUNT(*) FROM test", [], |row| row.get(0))
                    .map_err(|e| Error::Database(e.to_string()))
            })
            .unwrap();

        assert_eq!(count, 1);
    }
}
