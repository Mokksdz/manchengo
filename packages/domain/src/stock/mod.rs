//! Stock domain module
//!
//! Handles inventory management including:
//! - Raw material lots (MP)
//! - Finished product lots (PF)
//! - FIFO stock consumption
//! - Stock movements

mod lot_mp;
mod lot_pf;
mod product;
mod movement;

pub use lot_mp::*;
pub use lot_pf::*;
pub use product::*;
pub use movement::*;
