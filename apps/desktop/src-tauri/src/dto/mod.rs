//! Data Transfer Objects (DTOs)
//!
//! These types are used for serialization between Rust and the UI.
//! They provide a clean interface that doesn't expose internal domain details.

pub mod common;
pub mod stock;
pub mod production;
pub mod appro;
pub mod commercial;
pub mod invoice;

pub use common::*;
pub use stock::*;
pub use production::*;
pub use appro::*;
pub use commercial::*;
pub use invoice::*;
