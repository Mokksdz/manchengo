//! Business Services Layer
//!
//! All business logic lives here. The UI is purely declarative and
//! delegates all operations to these services via Tauri commands.

pub mod stock_service;
pub mod sync_service;
pub mod production_service;
pub mod appro_service;
pub mod commercial_service;
pub mod invoice_service;

pub use stock_service::StockService;
pub use sync_service::SyncService;
pub use production_service::ProductionService;
pub use appro_service::ApproService;
pub use commercial_service::CommercialService;
pub use invoice_service::InvoiceService;
