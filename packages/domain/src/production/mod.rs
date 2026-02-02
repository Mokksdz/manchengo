//! Production domain module
//!
//! Handles manufacturing orders:
//! - Recipe definitions
//! - Production order management
//! - MP consumption tracking
//! - PF output creation
//! - Cost calculation

mod recipe;
mod order;

pub use recipe::*;
pub use order::*;
