//! Core types used throughout Manchengo ERP

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use uuid::Uuid;

// ============================================================================
// IDENTIFIERS
// ============================================================================

/// Strongly-typed entity identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct EntityId(Uuid);

impl EntityId {
    pub fn new() -> Self {
        Self(Uuid::now_v7())
    }

    pub fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid)
    }

    pub fn as_uuid(&self) -> &Uuid {
        &self.0
    }

    pub fn to_string(&self) -> String {
        self.0.to_string()
    }
}

impl Default for EntityId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for EntityId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

// ============================================================================
// MONEY & QUANTITIES
// ============================================================================

/// Monetary amount in centimes (1 DZD = 100 centimes)
/// Using integer to avoid floating point precision issues
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Default)]
#[serde(transparent)]
pub struct Money(i64);

impl Money {
    pub fn from_centimes(centimes: i64) -> Self {
        Self(centimes)
    }

    pub fn from_dzd(dzd: f64) -> Self {
        Self((dzd * 100.0).round() as i64)
    }

    pub fn centimes(&self) -> i64 {
        self.0
    }

    pub fn as_dzd(&self) -> f64 {
        self.0 as f64 / 100.0
    }

    pub fn zero() -> Self {
        Self(0)
    }

    pub fn is_zero(&self) -> bool {
        self.0 == 0
    }

    pub fn is_positive(&self) -> bool {
        self.0 > 0
    }
}

impl std::ops::Add for Money {
    type Output = Self;
    fn add(self, rhs: Self) -> Self {
        Self(self.0 + rhs.0)
    }
}

impl std::ops::Sub for Money {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self {
        Self(self.0 - rhs.0)
    }
}

impl std::ops::Mul<i64> for Money {
    type Output = Self;
    fn mul(self, rhs: i64) -> Self {
        Self(self.0 * rhs)
    }
}

/// Quantity with unit (stored as base unit value)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Quantity {
    pub value: f64,
    pub unit: UnitOfMeasure,
}

impl Quantity {
    pub fn new(value: f64, unit: UnitOfMeasure) -> Self {
        Self { value, unit }
    }

    pub fn kg(value: f64) -> Self {
        Self::new(value, UnitOfMeasure::Kilogram)
    }

    pub fn litre(value: f64) -> Self {
        Self::new(value, UnitOfMeasure::Litre)
    }

    pub fn piece(value: f64) -> Self {
        Self::new(value, UnitOfMeasure::Piece)
    }

    pub fn is_zero(&self) -> bool {
        self.value.abs() < f64::EPSILON
    }

    pub fn is_positive(&self) -> bool {
        self.value > 0.0
    }
}

/// Units of measure
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UnitOfMeasure {
    Kilogram,
    Gram,
    Litre,
    Millilitre,
    Piece,
    Carton,
    Palette,
}

impl UnitOfMeasure {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Kilogram => "KG",
            Self::Gram => "G",
            Self::Litre => "L",
            Self::Millilitre => "ML",
            Self::Piece => "PC",
            Self::Carton => "CTN",
            Self::Palette => "PAL",
        }
    }
}

// ============================================================================
// TIMESTAMPS & AUDITING
// ============================================================================

/// Standard audit fields for all entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditInfo {
    pub created_at: DateTime<Utc>,
    pub created_by: EntityId,
    pub updated_at: DateTime<Utc>,
    pub updated_by: EntityId,
}

impl AuditInfo {
    pub fn new(user_id: EntityId) -> Self {
        let now = Utc::now();
        Self {
            created_at: now,
            created_by: user_id,
            updated_at: now,
            updated_by: user_id,
        }
    }

    pub fn update(&mut self, user_id: EntityId) {
        self.updated_at = Utc::now();
        self.updated_by = user_id;
    }
}

// ============================================================================
// USER & ROLES
// ============================================================================

/// User roles in the system
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserRole {
    Admin,
    Appro,
    Production,
    Commercial,
    Comptable,
}

impl UserRole {
    pub fn can_access_module(&self, module: &str) -> bool {
        match self {
            Self::Admin => true,
            Self::Appro => matches!(module, "appro" | "stock"),
            Self::Production => matches!(module, "production" | "stock"),
            Self::Commercial => matches!(module, "commercial" | "delivery" | "stock"),
            Self::Comptable => matches!(module, "finance" | "audit"),
        }
    }

    pub fn is_readonly(&self) -> bool {
        matches!(self, Self::Comptable)
    }
}

// ============================================================================
// CLIENT TYPES
// ============================================================================

/// Client commercial category (determines pricing)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClientType {
    Distributeur,
    Grossiste,
    Superette,
    FastFood,
}

impl ClientType {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Distributeur => "DIST",
            Self::Grossiste => "GROS",
            Self::Superette => "SUP",
            Self::FastFood => "FF",
        }
    }
}

// ============================================================================
// ALGERIAN FISCAL IDENTIFIERS
// ============================================================================

/// Algerian fiscal identification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiscalIdentity {
    /// Numéro d'Identification Fiscale
    pub nif: String,
    /// Numéro d'Identification Statistique
    pub nis: String,
    /// Registre de Commerce
    pub rc: String,
    /// Article d'Imposition
    pub article_imposition: String,
}

impl FiscalIdentity {
    pub fn new(nif: String, nis: String, rc: String, article_imposition: String) -> Self {
        Self {
            nif,
            nis,
            rc,
            article_imposition,
        }
    }

    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();

        if self.nif.is_empty() {
            errors.push("NIF is required".to_string());
        }
        if self.nis.is_empty() {
            errors.push("NIS is required".to_string());
        }
        if self.rc.is_empty() {
            errors.push("RC is required".to_string());
        }

        errors
    }
}

/// Algerian tax rates
#[derive(Debug, Clone, Copy)]
pub struct AlgerianTaxRates;

impl AlgerianTaxRates {
    /// Standard TVA rate (19%)
    pub const TVA_STANDARD: f64 = 0.19;
    /// Reduced TVA rate (9%)
    pub const TVA_REDUCED: f64 = 0.09;
    /// Timbre fiscal (1%)
    pub const TIMBRE_FISCAL: f64 = 0.01;
}

// ============================================================================
// LOCATION / ADDRESS
// ============================================================================

/// Address with Algerian administrative divisions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Address {
    pub line1: String,
    pub line2: Option<String>,
    pub commune: String,
    pub wilaya_code: String,
    pub wilaya_name: String,
    pub postal_code: Option<String>,
}

// ============================================================================
// QR CODE DATA
// ============================================================================

/// Types of entities that can have QR codes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum QrEntityType {
    LotMp,      // Raw material lot
    LotPf,      // Finished product lot
    Order,      // Production order
    Delivery,   // Delivery note
    Location,   // Warehouse location
}

/// Data encoded in QR codes
/// Format: MCG:{TYPE}:{ID}:{REFERENCE}:{CHECKSUM}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrCodeData {
    pub entity_type: QrEntityType,
    pub entity_id: EntityId,
    pub reference: String,
    pub expiry_date: Option<NaiveDate>,
    pub checksum: String,
}

// ============================================================================
// QR CODE IMPLEMENTATION — SECURE DECODE WITH SHA256 CHECKSUM
// ============================================================================

impl QrCodeData {
    /// Secret key for checksum generation (should be loaded from env in production)
    /// In production, this should come from environment variable QR_SECRET_KEY
    const DEFAULT_SECRET: &'static str = "MCG_QR_SECRET_2024_PROD";

    /// Create a new QrCodeData with auto-generated checksum
    pub fn new(
        entity_type: QrEntityType,
        entity_id: EntityId,
        reference: String,
        expiry_date: Option<NaiveDate>,
    ) -> Self {
        let mut qr = Self {
            entity_type,
            entity_id,
            reference,
            expiry_date,
            checksum: String::new(),
        };
        qr.checksum = qr.compute_checksum(Self::DEFAULT_SECRET);
        qr
    }

    /// Create QrCodeData with custom secret key
    pub fn new_with_secret(
        entity_type: QrEntityType,
        entity_id: EntityId,
        reference: String,
        expiry_date: Option<NaiveDate>,
        secret_key: &str,
    ) -> Self {
        let mut qr = Self {
            entity_type,
            entity_id,
            reference,
            expiry_date,
            checksum: String::new(),
        };
        qr.checksum = qr.compute_checksum(secret_key);
        qr
    }

    /// Encode QR data to string format
    /// Output: MCG:{TYPE}:{ID}:{REFERENCE}:{CHECKSUM}
    pub fn encode(&self) -> String {
        format!(
            "MCG:{}:{}:{}:{}",
            self.entity_type_code(),
            self.entity_id,
            self.reference,
            self.checksum
        )
    }

    /// Decode and validate QR string with default secret
    /// Returns None if:
    /// - Format is invalid
    /// - Prefix is not "MCG"
    /// - Entity type is unknown
    /// - UUID is invalid
    /// - Checksum validation fails
    pub fn decode(data: &str) -> Option<Self> {
        Self::decode_with_secret(data, Self::DEFAULT_SECRET)
    }

    /// Decode and validate QR string with custom secret key
    /// Full validation including SHA256 checksum verification
    pub fn decode_with_secret(data: &str, secret_key: &str) -> Option<Self> {
        // Split by colon delimiter
        let parts: Vec<&str> = data.split(':').collect();

        // Validate segment count: MCG:TYPE:ID:REFERENCE:CHECKSUM = 5 parts
        if parts.len() != 5 {
            tracing::warn!("QR decode failed: expected 5 segments, got {}", parts.len());
            return None;
        }

        // Validate MCG prefix
        if parts[0] != "MCG" {
            tracing::warn!("QR decode failed: invalid prefix '{}'", parts[0]);
            return None;
        }

        // Parse entity type
        let entity_type = match parts[1] {
            "LMP" => QrEntityType::LotMp,
            "LPF" => QrEntityType::LotPf,
            "ORD" => QrEntityType::Order,
            "DLV" => QrEntityType::Delivery,
            "LOC" => QrEntityType::Location,
            unknown => {
                tracing::warn!("QR decode failed: unknown entity type '{}'", unknown);
                return None;
            }
        };

        // Parse UUID
        let uuid = match Uuid::parse_str(parts[2]) {
            Ok(u) => u,
            Err(e) => {
                tracing::warn!("QR decode failed: invalid UUID '{}': {}", parts[2], e);
                return None;
            }
        };
        let entity_id = EntityId::from_uuid(uuid);

        // Extract reference and checksum
        let reference = parts[3].to_string();
        let received_checksum = parts[4].to_string();

        // Validate reference is not empty
        if reference.is_empty() {
            tracing::warn!("QR decode failed: empty reference");
            return None;
        }

        // Build QR data (without checksum initially)
        let qr_data = Self {
            entity_type,
            entity_id,
            reference,
            expiry_date: None, // Not encoded in QR string
            checksum: received_checksum.clone(),
        };

        // CRITICAL: Verify checksum
        let expected_checksum = qr_data.compute_checksum(secret_key);
        if !constant_time_compare(&received_checksum, &expected_checksum) {
            tracing::warn!(
                "QR decode failed: checksum mismatch for entity {}",
                qr_data.entity_id
            );
            return None;
        }

        tracing::debug!(
            "QR decode success: type={:?}, id={}, ref={}",
            qr_data.entity_type,
            qr_data.entity_id,
            qr_data.reference
        );

        Some(qr_data)
    }

    /// Compute SHA256 checksum for this QR data
    /// Input: {ENTITY_ID}:{REFERENCE}:{SECRET_KEY}
    /// Output: First 16 chars of hex-encoded SHA256 hash
    fn compute_checksum(&self, secret_key: &str) -> String {
        let input = format!(
            "{}:{}:{}",
            self.entity_id,
            self.reference,
            secret_key
        );

        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        let result = hasher.finalize();

        // Return first 16 characters of hex-encoded hash (64 bits of entropy)
        hex::encode(&result[..8])
    }

    /// Verify if this QR data has a valid checksum
    pub fn verify_checksum(&self, secret_key: &str) -> bool {
        let expected = self.compute_checksum(secret_key);
        constant_time_compare(&self.checksum, &expected)
    }

    /// Get the entity type code for encoding
    fn entity_type_code(&self) -> &'static str {
        match self.entity_type {
            QrEntityType::LotMp => "LMP",
            QrEntityType::LotPf => "LPF",
            QrEntityType::Order => "ORD",
            QrEntityType::Delivery => "DLV",
            QrEntityType::Location => "LOC",
        }
    }

    /// Check if this is a delivery QR code
    pub fn is_delivery(&self) -> bool {
        matches!(self.entity_type, QrEntityType::Delivery)
    }

    /// Get entity ID as string
    pub fn entity_id_string(&self) -> String {
        self.entity_id.to_string()
    }
}

/// Constant-time string comparison to prevent timing attacks
fn constant_time_compare(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }

    let mut result = 0u8;
    for (x, y) in a.bytes().zip(b.bytes()) {
        result |= x ^ y;
    }
    result == 0
}

// ============================================================================
// QR CODE VALIDATION RESULT
// ============================================================================

/// Result of QR code validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrValidationResult {
    pub is_valid: bool,
    pub entity_type: Option<QrEntityType>,
    pub entity_id: Option<String>,
    pub reference: Option<String>,
    pub error: Option<QrValidationError>,
}

/// Possible QR validation errors
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum QrValidationError {
    InvalidFormat,
    InvalidPrefix,
    UnknownEntityType,
    InvalidUuid,
    EmptyReference,
    ChecksumMismatch,
    ExpiredQr,
}

impl QrValidationResult {
    pub fn success(qr: &QrCodeData) -> Self {
        Self {
            is_valid: true,
            entity_type: Some(qr.entity_type),
            entity_id: Some(qr.entity_id.to_string()),
            reference: Some(qr.reference.clone()),
            error: None,
        }
    }

    pub fn failure(error: QrValidationError) -> Self {
        Self {
            is_valid: false,
            entity_type: None,
            entity_id: None,
            reference: None,
            error: Some(error),
        }
    }
}

// ============================================================================
// DEVICE & SYNC
// ============================================================================

/// Device identification for sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub device_id: EntityId,
    pub device_name: String,
    pub device_type: DeviceType,
    pub last_sync_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DeviceType {
    Desktop,
    Mobile,
}
