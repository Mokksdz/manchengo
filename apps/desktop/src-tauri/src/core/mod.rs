//! Core module - Configuration, Security, Scheduler
//!
//! This module contains foundational infrastructure components:
//! - AppConfig: Application configuration management
//! - SessionManager: User session and authentication
//! - BackgroundScheduler: Background task execution

pub mod config;
pub mod security;
pub mod scheduler;

pub use config::AppConfig;
pub use security::{AuthenticatedUser, SessionManager};
pub use scheduler::BackgroundScheduler;
