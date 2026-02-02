//! Database schema migrations

use manchengo_core::{Error, Result};
use rusqlite::Connection;
use tracing::{info, warn};

/// Migration definition
pub struct Migration {
    pub version: i32,
    pub name: &'static str,
    pub up: &'static str,
    pub down: &'static str,
}

/// All migrations in order
pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "initial_schema",
        up: include_str!("../migrations/001_initial_schema.sql"),
        down: "-- Rollback not supported for initial schema",
    },
    Migration {
        version: 2,
        name: "reference_data",
        up: include_str!("../migrations/002_reference_data.sql"),
        down: "DELETE FROM ref_units; DELETE FROM ref_wilayas;",
    },
];

/// Migration manager
pub struct Migrator<'a> {
    conn: &'a Connection,
}

impl<'a> Migrator<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// Initialize migration tracking table
    fn ensure_migrations_table(&self) -> Result<()> {
        self.conn
            .execute(
                "CREATE TABLE IF NOT EXISTS _migrations (
                    version INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
                )",
                [],
            )
            .map_err(|e| Error::Database(e.to_string()))?;
        Ok(())
    }

    /// Get current schema version
    pub fn current_version(&self) -> Result<i32> {
        self.ensure_migrations_table()?;

        let version: i32 = self
            .conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM _migrations",
                [],
                |row| row.get(0),
            )
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(version)
    }

    /// Apply all pending migrations
    pub fn migrate(&self) -> Result<()> {
        self.ensure_migrations_table()?;

        let current = self.current_version()?;
        info!("Current schema version: {}", current);

        for migration in MIGRATIONS {
            if migration.version > current {
                self.apply_migration(migration)?;
            }
        }

        Ok(())
    }

    /// Apply a single migration
    fn apply_migration(&self, migration: &Migration) -> Result<()> {
        info!(
            "Applying migration {}: {}",
            migration.version, migration.name
        );

        self.conn
            .execute_batch(migration.up)
            .map_err(|e| Error::Database(format!("Migration {} failed: {}", migration.version, e)))?;

        self.conn
            .execute(
                "INSERT INTO _migrations (version, name) VALUES (?1, ?2)",
                [&migration.version.to_string(), migration.name],
            )
            .map_err(|e| Error::Database(e.to_string()))?;

        info!("Migration {} applied successfully", migration.version);
        Ok(())
    }

    /// Check if migrations are pending
    pub fn has_pending(&self) -> Result<bool> {
        let current = self.current_version()?;
        let latest = MIGRATIONS.last().map(|m| m.version).unwrap_or(0);
        Ok(current < latest)
    }

    /// List all applied migrations
    pub fn list_applied(&self) -> Result<Vec<(i32, String, String)>> {
        self.ensure_migrations_table()?;

        let mut stmt = self
            .conn
            .prepare("SELECT version, name, applied_at FROM _migrations ORDER BY version")
            .map_err(|e| Error::Database(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| Error::Database(e.to_string()))?);
        }

        Ok(result)
    }
}

/// Initialize database with all migrations
pub fn initialize_database(conn: &Connection) -> Result<()> {
    let migrator = Migrator::new(conn);
    migrator.migrate()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_migrator_version() {
        let conn = Connection::open_in_memory().unwrap();
        let migrator = Migrator::new(&conn);

        assert_eq!(migrator.current_version().unwrap(), 0);
    }
}
