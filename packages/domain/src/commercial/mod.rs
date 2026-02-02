//! Commercial domain module
//!
//! Handles sales operations:
//! - Client management
//! - Price lists by client type
//! - Sales orders
//! - Client balance tracking

mod client;
mod price_list;
mod sales_order;

pub use client::*;
pub use price_list::*;
pub use sales_order::*;
