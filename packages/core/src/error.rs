//! Error types for Manchengo ERP

use thiserror::Error;

/// Main error type for Manchengo ERP
#[derive(Error, Debug)]
pub enum Error {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Validation error: {field} - {message}")]
    Validation { field: String, message: String },

    #[error("Not found: {entity_type} with id {id}")]
    NotFound { entity_type: String, id: String },

    #[error("Business rule violation: {0}")]
    BusinessRule(String),

    #[error("Insufficient stock: {product} needs {required}, available {available}")]
    InsufficientStock {
        product: String,
        required: f64,
        available: f64,
    },

    #[error("Invalid state transition: {entity} cannot go from {from} to {to}")]
    InvalidStateTransition {
        entity: String,
        from: String,
        to: String,
    },

    #[error("Lot expired: {lot_id} expired on {expiry_date}")]
    LotExpired { lot_id: String, expiry_date: String },

    #[error("QR code error: {0}")]
    QrCode(String),

    #[error("Sync error: {0}")]
    Sync(String),

    #[error("Authorization error: {0}")]
    Authorization(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<serde_json::Error> for Error {
    fn from(err: serde_json::Error) -> Self {
        Error::Serialization(err.to_string())
    }
}

impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Error::Io(err.to_string())
    }
}

/// Result type alias using our Error
pub type Result<T> = std::result::Result<T, Error>;
