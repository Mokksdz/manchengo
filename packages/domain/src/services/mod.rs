//! Domain services - orchestrating complex business operations

pub mod stock_service;
pub mod production_service;
pub mod delivery_service;

pub use stock_service::StockService;
pub use production_service::ProductionService;
pub use delivery_service::DeliveryService;
