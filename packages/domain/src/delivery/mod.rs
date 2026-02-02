//! Delivery domain module
//!
//! Handles logistics:
//! - Delivery note management
//! - Truck loading with QR verification
//! - Proof of delivery
//! - Route management

mod delivery;
mod vehicle;

pub use delivery::*;
pub use vehicle::*;
