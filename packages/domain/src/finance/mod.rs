//! Finance domain module
//!
//! Handles financial operations:
//! - Invoice generation
//! - Payment tracking
//! - Cost calculation
//! - Algerian fiscal compliance

mod invoice;
mod payment;
mod cost;

pub use invoice::*;
pub use payment::*;
pub use cost::*;
