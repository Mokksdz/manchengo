//! Procurement (Approvisionnement) domain module
//!
//! Handles procurement operations:
//! - Supplier management
//! - Raw material reception
//! - OCR-assisted document intake
//! - Purchase order management

mod supplier;
mod reception;

pub use supplier::*;
pub use reception::*;
