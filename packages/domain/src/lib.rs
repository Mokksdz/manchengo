//! Manchengo ERP Domain Layer
//!
//! Contains all business domain models, services, and logic organized by module:
//! - appro: Procurement and supplier management
//! - stock: Inventory and lot management
//! - production: Manufacturing orders
//! - commercial: Sales and client management
//! - delivery: Logistics and proof of delivery
//! - finance: Invoicing and payments

pub mod appro;
pub mod commercial;
pub mod delivery;
pub mod events;
pub mod finance;
pub mod production;
pub mod stock;
pub mod services;
