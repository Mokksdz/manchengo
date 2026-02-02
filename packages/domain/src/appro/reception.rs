//! Raw material reception with OCR support

use chrono::{DateTime, NaiveDate, Utc};
use manchengo_core::{AuditInfo, EntityId, Error, Money, Result, UnitOfMeasure};
use serde::{Deserialize, Serialize};

/// Reception status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReceptionStatus {
    Draft,      // OCR parsed, pending validation
    Validated,  // Human validated
    Cancelled,
}

/// Raw material reception note
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceptionNote {
    pub id: EntityId,
    pub reception_number: String,
    pub supplier_id: EntityId,
    pub reception_date: NaiveDate,

    // Source document
    pub bl_number: Option<String>,        // Bon de livraison number
    pub bl_photo_path: Option<String>,    // Path to photo
    pub ocr_raw_text: Option<String>,     // Raw OCR output
    pub ocr_confidence: Option<f64>,      // OCR confidence score

    // Lines
    pub lines: Vec<ReceptionLine>,

    // Status
    pub status: ReceptionStatus,

    // Validation
    pub validated_at: Option<DateTime<Utc>>,
    pub validated_by: Option<EntityId>,

    // Metadata
    pub notes: Option<String>,
    pub audit: AuditInfo,
}

/// Reception line item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceptionLine {
    pub id: EntityId,
    pub reception_id: EntityId,
    pub product_mp_id: EntityId,
    pub quantity: f64,
    pub unit: UnitOfMeasure,
    pub unit_cost: Money,
    pub total_cost: Money,

    // OCR extracted values (before validation)
    pub ocr_quantity: Option<f64>,
    pub ocr_unit_cost: Option<Money>,

    // Lot to be created
    pub lot_id: Option<EntityId>,
    pub expiry_date: Option<NaiveDate>,
}

impl ReceptionNote {
    pub fn new(
        reception_number: String,
        supplier_id: EntityId,
        reception_date: NaiveDate,
        user_id: EntityId,
    ) -> Self {
        Self {
            id: EntityId::new(),
            reception_number,
            supplier_id,
            reception_date,
            bl_number: None,
            bl_photo_path: None,
            ocr_raw_text: None,
            ocr_confidence: None,
            lines: Vec::new(),
            status: ReceptionStatus::Draft,
            validated_at: None,
            validated_by: None,
            notes: None,
            audit: AuditInfo::new(user_id),
        }
    }

    /// Create from OCR scan
    pub fn from_ocr(
        reception_number: String,
        supplier_id: EntityId,
        reception_date: NaiveDate,
        bl_photo_path: String,
        ocr_text: String,
        confidence: f64,
        user_id: EntityId,
    ) -> Self {
        let mut note = Self::new(reception_number, supplier_id, reception_date, user_id);
        note.bl_photo_path = Some(bl_photo_path);
        note.ocr_raw_text = Some(ocr_text);
        note.ocr_confidence = Some(confidence);
        note
    }

    /// Add a line to the reception
    pub fn add_line(
        &mut self,
        product_mp_id: EntityId,
        quantity: f64,
        unit: UnitOfMeasure,
        unit_cost: Money,
        user_id: EntityId,
    ) -> Result<()> {
        if self.status != ReceptionStatus::Draft {
            return Err(Error::BusinessRule(
                "Can only add lines to draft receptions".to_string(),
            ));
        }

        let total_cost = Money::from_centimes((quantity * unit_cost.centimes() as f64) as i64);

        self.lines.push(ReceptionLine {
            id: EntityId::new(),
            reception_id: self.id,
            product_mp_id,
            quantity,
            unit,
            unit_cost,
            total_cost,
            ocr_quantity: None,
            ocr_unit_cost: None,
            lot_id: None,
            expiry_date: None,
        });

        self.audit.update(user_id);
        Ok(())
    }

    /// Add a line with OCR comparison
    pub fn add_line_with_ocr(
        &mut self,
        product_mp_id: EntityId,
        quantity: f64,
        unit: UnitOfMeasure,
        unit_cost: Money,
        ocr_quantity: f64,
        ocr_unit_cost: Money,
        user_id: EntityId,
    ) -> Result<()> {
        self.add_line(product_mp_id, quantity, unit, unit_cost, user_id)?;

        if let Some(line) = self.lines.last_mut() {
            line.ocr_quantity = Some(ocr_quantity);
            line.ocr_unit_cost = Some(ocr_unit_cost);
        }

        Ok(())
    }

    /// Validate the reception (human confirmation)
    pub fn validate(&mut self, user_id: EntityId) -> Result<()> {
        if self.status != ReceptionStatus::Draft {
            return Err(Error::InvalidStateTransition {
                entity: "ReceptionNote".to_string(),
                from: format!("{:?}", self.status),
                to: "VALIDATED".to_string(),
            });
        }

        if self.lines.is_empty() {
            return Err(Error::Validation {
                field: "lines".to_string(),
                message: "Reception must have at least one line".to_string(),
            });
        }

        self.status = ReceptionStatus::Validated;
        self.validated_at = Some(Utc::now());
        self.validated_by = Some(user_id);
        self.audit.update(user_id);

        Ok(())
    }

    /// Cancel the reception
    pub fn cancel(&mut self, user_id: EntityId) -> Result<()> {
        if self.status != ReceptionStatus::Draft {
            return Err(Error::BusinessRule(
                "Can only cancel draft receptions".to_string(),
            ));
        }

        self.status = ReceptionStatus::Cancelled;
        self.audit.update(user_id);
        Ok(())
    }

    /// Get total cost of reception
    pub fn total_cost(&self) -> Money {
        self.lines.iter().fold(Money::zero(), |acc, l| acc + l.total_cost)
    }

    /// Check if there are OCR discrepancies
    pub fn has_ocr_discrepancies(&self) -> bool {
        self.lines.iter().any(|l| {
            if let (Some(ocr_qty), Some(ocr_cost)) = (l.ocr_quantity, l.ocr_unit_cost) {
                (l.quantity - ocr_qty).abs() > 0.01
                    || l.unit_cost.centimes() != ocr_cost.centimes()
            } else {
                false
            }
        })
    }
}
