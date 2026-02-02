//! Generic repository pattern for database access

use manchengo_core::{EntityId, Error, Result};
use rusqlite::{params, Connection, Row};
use serde::{de::DeserializeOwned, Serialize};

/// Generic repository trait for CRUD operations
pub trait Repository<T> {
    /// Table name for this entity
    fn table_name() -> &'static str;

    /// Convert database row to entity
    fn from_row(row: &Row) -> rusqlite::Result<T>;

    /// Get columns for INSERT (excluding auto-generated)
    fn insert_columns() -> &'static [&'static str];

    /// Get values for INSERT as params
    fn to_params(&self) -> Vec<Box<dyn rusqlite::ToSql>>;
}

/// Repository operations helper
pub struct RepositoryOps;

impl RepositoryOps {
    /// Find entity by ID
    pub fn find_by_id<T: Repository<T>>(conn: &Connection, id: &EntityId) -> Result<Option<T>> {
        let sql = format!("SELECT * FROM {} WHERE id = ?1", T::table_name());

        let result = conn.query_row(&sql, [id.to_string()], T::from_row);

        match result {
            Ok(entity) => Ok(Some(entity)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(Error::Database(e.to_string())),
        }
    }

    /// Find all entities
    pub fn find_all<T: Repository<T>>(conn: &Connection) -> Result<Vec<T>> {
        let sql = format!("SELECT * FROM {}", T::table_name());

        let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

        let rows = stmt
            .query_map([], T::from_row)
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| Error::Database(e.to_string()))?);
        }

        Ok(result)
    }

    /// Find entities with WHERE clause
    pub fn find_where<T: Repository<T>>(
        conn: &Connection,
        where_clause: &str,
        params: &[&dyn rusqlite::ToSql],
    ) -> Result<Vec<T>> {
        let sql = format!("SELECT * FROM {} WHERE {}", T::table_name(), where_clause);

        let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

        let rows = stmt
            .query_map(rusqlite::params_from_iter(params), T::from_row)
            .map_err(|e| Error::Database(e.to_string()))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| Error::Database(e.to_string()))?);
        }

        Ok(result)
    }

    /// Count entities with optional WHERE clause
    pub fn count<T: Repository<T>>(conn: &Connection, where_clause: Option<&str>) -> Result<i64> {
        let sql = match where_clause {
            Some(w) => format!("SELECT COUNT(*) FROM {} WHERE {}", T::table_name(), w),
            None => format!("SELECT COUNT(*) FROM {}", T::table_name()),
        };

        conn.query_row(&sql, [], |row| row.get(0))
            .map_err(|e| Error::Database(e.to_string()))
    }

    /// Delete entity by ID
    pub fn delete<T: Repository<T>>(conn: &Connection, id: &EntityId) -> Result<bool> {
        let sql = format!("DELETE FROM {} WHERE id = ?1", T::table_name());

        let affected = conn
            .execute(&sql, [id.to_string()])
            .map_err(|e| Error::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// Check if entity exists
    pub fn exists<T: Repository<T>>(conn: &Connection, id: &EntityId) -> Result<bool> {
        let sql = format!("SELECT 1 FROM {} WHERE id = ?1 LIMIT 1", T::table_name());

        let result = conn.query_row(&sql, [id.to_string()], |_| Ok(true));

        match result {
            Ok(_) => Ok(true),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
            Err(e) => Err(Error::Database(e.to_string())),
        }
    }
}

/// Paginated query result
#[derive(Debug, Clone)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
    pub total_pages: i32,
}

impl<T> Page<T> {
    pub fn new(items: Vec<T>, total: i64, page: i32, page_size: i32) -> Self {
        let total_pages = ((total as f64) / (page_size as f64)).ceil() as i32;
        Self {
            items,
            total,
            page,
            page_size,
            total_pages,
        }
    }

    pub fn has_next(&self) -> bool {
        self.page < self.total_pages
    }

    pub fn has_previous(&self) -> bool {
        self.page > 1
    }
}

/// Query builder for complex queries
pub struct QueryBuilder {
    select: String,
    from: String,
    joins: Vec<String>,
    where_clauses: Vec<String>,
    order_by: Option<String>,
    limit: Option<i32>,
    offset: Option<i32>,
}

impl QueryBuilder {
    pub fn new(table: &str) -> Self {
        Self {
            select: "*".to_string(),
            from: table.to_string(),
            joins: Vec::new(),
            where_clauses: Vec::new(),
            order_by: None,
            limit: None,
            offset: None,
        }
    }

    pub fn select(mut self, columns: &str) -> Self {
        self.select = columns.to_string();
        self
    }

    pub fn join(mut self, join: &str) -> Self {
        self.joins.push(join.to_string());
        self
    }

    pub fn where_clause(mut self, clause: &str) -> Self {
        self.where_clauses.push(clause.to_string());
        self
    }

    pub fn order_by(mut self, order: &str) -> Self {
        self.order_by = Some(order.to_string());
        self
    }

    pub fn limit(mut self, limit: i32) -> Self {
        self.limit = Some(limit);
        self
    }

    pub fn offset(mut self, offset: i32) -> Self {
        self.offset = Some(offset);
        self
    }

    pub fn paginate(mut self, page: i32, page_size: i32) -> Self {
        self.limit = Some(page_size);
        self.offset = Some((page - 1) * page_size);
        self
    }

    pub fn build(&self) -> String {
        let mut sql = format!("SELECT {} FROM {}", self.select, self.from);

        for join in &self.joins {
            sql.push_str(&format!(" {}", join));
        }

        if !self.where_clauses.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&self.where_clauses.join(" AND "));
        }

        if let Some(ref order) = self.order_by {
            sql.push_str(&format!(" ORDER BY {}", order));
        }

        if let Some(limit) = self.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }

        if let Some(offset) = self.offset {
            sql.push_str(&format!(" OFFSET {}", offset));
        }

        sql
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_builder() {
        let query = QueryBuilder::new("products_mp")
            .select("id, name, unit")
            .where_clause("status = 'ACTIVE'")
            .order_by("name ASC")
            .limit(10)
            .build();

        assert!(query.contains("SELECT id, name, unit"));
        assert!(query.contains("FROM products_mp"));
        assert!(query.contains("WHERE status = 'ACTIVE'"));
        assert!(query.contains("ORDER BY name ASC"));
        assert!(query.contains("LIMIT 10"));
    }

    #[test]
    fn test_query_builder_pagination() {
        let query = QueryBuilder::new("clients")
            .paginate(2, 20)
            .build();

        assert!(query.contains("LIMIT 20"));
        assert!(query.contains("OFFSET 20"));
    }
}
