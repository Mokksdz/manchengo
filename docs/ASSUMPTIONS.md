# Manchengo Smart ERP — Assumptions & Constraints

## 1. Business Assumptions

### 1.1 Target Users
- **Primary**: Small to medium agro-industrial companies in Algeria
- **Industries**: Cheese factories, dairies, food manufacturing
- **Size**: 5-50 employees
- **Technical literacy**: Basic computer skills, smartphone proficiency

### 1.2 Operational Context
- Rural locations with unreliable internet connectivity
- Single-site operations (one factory) initially
- Fleet of 1-5 delivery vehicles
- 10-100 clients per company
- 20-200 SKUs (products)

### 1.3 Regulatory Environment
- Algerian fiscal law compliance mandatory
- NIF/NIS/RC required for all commercial entities
- TVA at 19% (standard) or 9% (reduced)
- Timbre fiscal at 1% on invoices
- French language primary, Arabic optional

---

## 2. Technical Assumptions

### 2.1 Device Capabilities
- **Desktop**: Windows 10+, macOS 11+, or modern Linux
- **Mobile**: Android 7.0+ (API 24)
- **Camera**: Required for QR scanning and OCR
- **Storage**: Minimum 500MB free for database

### 2.2 Network Conditions
- Intermittent connectivity (3G/4G mobile, unreliable WiFi)
- Sync may fail and must retry automatically
- All core operations must work fully offline
- Sync latency tolerance: hours to days

### 2.3 Data Volume
- Up to 10,000 lots per year
- Up to 1,000 production orders per year
- Up to 5,000 sales orders per year
- Up to 10,000 deliveries per year
- Database size: up to 10GB locally

---

## 3. Architectural Constraints

### 3.1 Offline-First
- SQLite is the source of truth on each device
- No operation requires network connectivity
- Events are queued locally and synced when possible
- User sees local data, not server data

### 3.2 Event Sourcing
- All mutations generate immutable events
- Events are append-only (no updates/deletes)
- State is derived from event replay
- Events enable audit trail and sync

### 3.3 Single User Per Device
- No concurrent editing on same device
- Multi-device per user is supported
- Conflicts resolved by last-write-wins (with exceptions)

### 3.4 No Real-Time Collaboration
- Changes propagate via sync, not push
- Users may work on stale data
- Business rules prevent invalid states

---

## 4. Business Rule Constraints

### 4.1 Stock Management
- **FIFO is mandatory**: Oldest lots consumed first
- **No negative stock**: System blocks consumption if insufficient
- **Lot traceability**: Every unit must trace to a lot
- **Expiry enforcement**: Expired lots cannot be consumed

### 4.2 QR Code Requirements
- Every lot (MP and PF) has a unique QR code
- Every production order has a QR code
- Every delivery has a QR code
- QR scanning required at:
  - MP reception (create lot)
  - Production consumption (consume lot)
  - Production output (create PF lot)
  - Delivery loading (verify lots)
  - Delivery completion (optional proof)

### 4.3 Fiscal Compliance
- All clients must have fiscal identity for invoicing
- Invoices must include: NIF, NIS, RC, Article d'imposition
- TVA must be calculated and shown separately
- Timbre fiscal must be applied to invoices
- Payment methods must be tracked (cash, check)

### 4.4 Pricing
- Prices vary by client type (4 categories)
- Price lists have validity periods
- Quantity-based pricing supported
- No discounts on individual lines (price list only)

---

## 5. Security Constraints

### 5.1 Data Protection
- Database encryption at rest (future: SQLCipher)
- No plain-text password storage
- Session timeout after inactivity
- PIN/biometric unlock on mobile

### 5.2 Access Control
- Role-based access (5 roles defined)
- Roles are enforced locally
- Audit log for all mutations
- No role can delete audit logs

### 5.3 Sensitive Data
- Client NIF/NIS/RC considered sensitive
- Financial data (prices, payments) restricted
- Only ADMIN and COMPTABLE see full financials

---

## 6. Integration Constraints

### 6.1 No External Dependencies in Core
- Core workflows work without internet
- No cloud service dependencies
- No third-party API requirements
- Self-hostable backend (future)

### 6.2 OCR Processing
- Runs locally on device
- No cloud OCR services
- Accuracy may vary; human validation required
- ML Kit (Google) for mobile

### 6.3 Printing
- QR labels printed via standard printers
- PDF generation for invoices/reports
- No specialized printer drivers required

---

## 7. Scalability Constraints

### 7.1 Current Scope
- Single company per installation
- Single warehouse per company
- Single currency (DZD)
- Single language (French)

### 7.2 Future Expansion (Not P1)
- Multi-company support
- Multi-warehouse support
- Multi-currency
- Arabic language
- iOS support

---

## 8. Development Constraints

### 8.1 Technology Choices (Fixed)
- Desktop: Tauri (Rust + TypeScript)
- Mobile: Flutter (Dart)
- Database: SQLite locally, PostgreSQL centrally
- Shared code: Rust (via FFI for Flutter)

### 8.2 Code Quality
- No business logic shortcuts
- Correctness over speed
- Comprehensive error handling
- Structured logging throughout

### 8.3 Testing Requirements
- Unit tests for all domain logic
- Integration tests for workflows
- No UI tests in P1
- Manual QA for releases

---

## 9. Known Limitations

### 9.1 P1 Limitations
- No UI implementation
- No central backend
- No sync functionality (structure only)
- No OCR implementation (placeholder)
- No PDF generation

### 9.2 Architectural Limitations
- Single-threaded SQLite access
- No real-time updates between devices
- Conflict resolution is simplistic (last-write-wins)
- Large databases may slow mobile devices

### 9.3 Business Limitations
- No returns/credit notes (P2)
- No inventory adjustments UI (P2)
- No multi-level pricing (P2)
- No delivery route optimization (P2)

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during sync failure | High | Event log persists locally; retry mechanism |
| Incorrect OCR parsing | Medium | Human validation mandatory |
| QR code not scannable | Medium | Manual entry fallback |
| Device theft with data | High | Database encryption; remote wipe (future) |
| Conflicting edits | Low | Last-write-wins; critical fields server-wins |
| Performance on low-end devices | Medium | Pagination; lazy loading; query optimization |
