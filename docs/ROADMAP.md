# Manchengo Smart ERP — Development Roadmap

## Phase 1: Foundation (Current) ✅

**Objective**: Technical foundation and architecture

### Deliverables
- [x] Monorepo structure (Rust workspace + Flutter)
- [x] Core library with shared types
- [x] Database layer with migrations
- [x] Domain models for all modules
- [x] Event sourcing infrastructure
- [x] Sync engine foundation
- [x] Desktop app skeleton (Tauri)
- [x] Mobile app skeleton (Flutter)
- [x] Naming conventions documented

### Constraints
- No UI implementation
- No external integrations
- No deployment infrastructure

---

## Phase 2: Core Workflows

**Objective**: Implement primary business flows without UI

### 2.1 Stock Management
- [ ] Product MP CRUD operations
- [ ] Product PF CRUD operations
- [ ] Lot MP creation and management
- [ ] Lot PF creation and management
- [ ] FIFO consumption logic
- [ ] Stock movement recording
- [ ] Expiry date monitoring
- [ ] Stock level alerts

### 2.2 Production
- [ ] Recipe management
- [ ] Production order lifecycle
- [ ] MP consumption recording
- [ ] PF output creation
- [ ] Cost calculation per lot
- [ ] Production reports

### 2.3 Reception (Appro)
- [ ] Supplier management
- [ ] Reception note creation
- [ ] OCR integration (placeholder)
- [ ] Lot creation from reception
- [ ] Supplier BL photo storage

### 2.4 QR Code System
- [ ] QR code generation
- [ ] QR code parsing
- [ ] Scan event recording
- [ ] Validation at transitions

---

## Phase 3: Commercial & Delivery

**Objective**: Sales, pricing, and logistics

### 3.1 Commercial
- [ ] Client management with fiscal identity
- [ ] Price list management by client type
- [ ] Sales order creation
- [ ] Sales order confirmation workflow
- [ ] Client balance tracking

### 3.2 Delivery
- [ ] Delivery note creation
- [ ] Lot allocation (FIFO)
- [ ] QR-verified loading
- [ ] Route management
- [ ] Proof of delivery (signature/photo)
- [ ] Payment collection

### 3.3 Invoicing
- [ ] Invoice generation from delivery
- [ ] Algerian fiscal compliance (TVA, timbre)
- [ ] Payment recording
- [ ] Invoice PDF generation

---

## Phase 4: Desktop UI

**Objective**: Full desktop application

### 4.1 Framework Setup
- [ ] Vue 3 or SolidJS setup
- [ ] Component library
- [ ] Routing
- [ ] State management
- [ ] Tauri IPC integration

### 4.2 Core Screens
- [ ] Login / Authentication
- [ ] Dashboard with KPIs
- [ ] Product management
- [ ] Lot management
- [ ] Stock overview

### 4.3 Module Screens
- [ ] Reception workflow
- [ ] Production orders
- [ ] Sales orders
- [ ] Delivery management
- [ ] Client management
- [ ] Invoice management

### 4.4 Admin Screens
- [ ] User management
- [ ] Role configuration
- [ ] System settings
- [ ] Sync status

---

## Phase 5: Mobile UI

**Objective**: Field operations mobile app

### 5.1 Authentication
- [ ] Login screen
- [ ] PIN/biometric unlock
- [ ] Session management

### 5.2 QR Operations
- [ ] Universal QR scanner
- [ ] Lot lookup
- [ ] Production scanning
- [ ] Delivery loading

### 5.3 Reception
- [ ] Photo capture
- [ ] OCR processing
- [ ] Reception validation
- [ ] Lot creation

### 5.4 Delivery
- [ ] Assigned deliveries list
- [ ] Client navigation
- [ ] Delivery confirmation
- [ ] Signature capture
- [ ] Payment collection

---

## Phase 6: Sync & Backend

**Objective**: Central server and synchronization

### 6.1 Backend API
- [ ] Rust/Go API server
- [ ] PostgreSQL schema
- [ ] Authentication/JWT
- [ ] Role-based access

### 6.2 Sync Protocol
- [ ] Event push/pull
- [ ] Conflict detection
- [ ] Resolution strategies
- [ ] Sync status reporting

### 6.3 Reporting
- [ ] Stock reports
- [ ] Sales reports
- [ ] Production reports
- [ ] Financial reports

---

## Phase 7: Advanced Features

**Objective**: Polish and optimization

### 7.1 OCR Enhancement
- [ ] ML Kit integration
- [ ] Document template recognition
- [ ] Auto-fill from scan

### 7.2 Analytics
- [ ] Dashboard KPIs
- [ ] Trend analysis
- [ ] Alerts and notifications

### 7.3 Integrations
- [ ] Printer integration (QR labels)
- [ ] SMS notifications
- [ ] Email reports

### 7.4 Security
- [ ] SQLCipher encryption
- [ ] Audit log viewer
- [ ] Data export/import

---

## Technical Debt & Improvements

### Ongoing
- [ ] Unit test coverage > 80%
- [ ] Integration tests
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Documentation updates

### Future Considerations
- iOS mobile support
- Web client (read-only reports)
- Multi-company support
- Multi-currency support
- Arabic language support

---

## Release Milestones

| Version | Description | Target |
|---------|-------------|--------|
| 0.1.0 | Foundation complete | ✅ |
| 0.2.0 | Core workflows | TBD |
| 0.3.0 | Commercial & delivery | TBD |
| 0.4.0 | Desktop UI alpha | TBD |
| 0.5.0 | Mobile UI alpha | TBD |
| 0.6.0 | Sync & backend | TBD |
| 1.0.0 | Production release | TBD |
