//! Repository Layer
//!
//! Data access layer for SQLite database operations.
//! All database queries are centralized here to keep services clean.

pub mod product_repo;
pub mod lot_repo;
pub mod movement_repo;
pub mod supplier_repo;
pub mod recipe_repo;
pub mod production_repo;
pub mod purchase_order_repo;
pub mod client_repo;
pub mod invoice_repo;

pub use product_repo::ProductRepository;
pub use lot_repo::LotRepository;
pub use movement_repo::MovementRepository;
pub use supplier_repo::SupplierRepository;
pub use recipe_repo::RecipeRepository;
pub use production_repo::ProductionRepository;
pub use purchase_order_repo::PurchaseOrderRepository;
pub use client_repo::ClientRepository;
pub use invoice_repo::InvoiceRepository;

use manchengo_database::Database;
use std::sync::Arc;

/// Common repository trait for CRUD operations
pub trait Repository<T, Id> {
    fn find_by_id(&self, id: Id) -> anyhow::Result<Option<T>>;
    fn find_all(&self) -> anyhow::Result<Vec<T>>;
    fn count(&self) -> anyhow::Result<u64>;
}
