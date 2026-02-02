//! Utility functions for Manchengo ERP

use chrono::{DateTime, Utc};

/// Generate a reference code with prefix and date
pub fn generate_reference(prefix: &str, sequence: u32) -> String {
    let now = Utc::now();
    format!(
        "{}-{}{:02}{:02}-{:05}",
        prefix,
        now.format("%y"),
        now.format("%m"),
        now.format("%d"),
        sequence
    )
}

/// Validate Algerian NIF format
pub fn validate_nif(nif: &str) -> bool {
    // NIF should be 15 digits
    nif.len() == 15 && nif.chars().all(|c| c.is_ascii_digit())
}

/// Validate Algerian NIS format
pub fn validate_nis(nis: &str) -> bool {
    // NIS should be 11 digits
    nis.len() == 11 && nis.chars().all(|c| c.is_ascii_digit())
}

/// Calculate checksum for QR code data
pub fn calculate_checksum(data: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    format!("{:08x}", hasher.finish() & 0xFFFFFFFF)
}

/// Parse ISO 8601 datetime string
pub fn parse_datetime(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_reference() {
        let ref1 = generate_reference("BL", 1);
        assert!(ref1.starts_with("BL-"));
        assert!(ref1.ends_with("-00001"));
    }

    #[test]
    fn test_validate_nif() {
        assert!(validate_nif("123456789012345"));
        assert!(!validate_nif("12345")); // Too short
        assert!(!validate_nif("12345678901234A")); // Contains letter
    }

    #[test]
    fn test_validate_nis() {
        assert!(validate_nis("12345678901"));
        assert!(!validate_nis("123")); // Too short
    }
}
