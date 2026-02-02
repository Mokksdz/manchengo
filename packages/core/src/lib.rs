//! Manchengo ERP Core Library
//!
//! This crate provides foundational types and utilities shared across
//! all Manchengo ERP components.

pub mod error;
pub mod fiscal;
pub mod types;
pub mod utils;

pub use error::{Error, Result};
pub use fiscal::{
    calculate_timbre_fiscal, calculate_timbre_fiscal_centimes, calculate_ttc, calculate_tva,
    PaymentMethod, TVA_REDUCED, TVA_STANDARD,
};
pub use types::*;
