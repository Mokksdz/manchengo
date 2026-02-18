//! Tauri API Commands
//!
//! All Tauri commands are defined here. Commands delegate to services
//! and return DTOs. No business logic in commands - they are just glue.

pub mod stock;
pub mod system;
pub mod sync;
pub mod production;
pub mod appro;
pub mod commercial;
pub mod invoice;

// Re-export all commands for easy registration
pub use stock::*;
pub use system::*;
pub use sync::*;
pub use production::*;
pub use appro::*;
pub use commercial::*;
pub use invoice::*;
