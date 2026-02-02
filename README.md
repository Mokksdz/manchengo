# Manchengo Smart ERP

**Offline-first industrial ERP for agro-industrial companies**

Version: 0.1.0-alpha  
Status: Foundation Phase (P1)

---

## Overview

Manchengo Smart ERP is a professional-grade Enterprise Resource Planning system designed for:
- Cheese factories (fromageries)
- Dairies (laiteries)
- Food manufacturing plants

### Key Characteristics

| Attribute | Value |
|-----------|-------|
| Architecture | Offline-first, event-sourced sync |
| Desktop | Tauri (Rust + TypeScript) |
| Mobile | Flutter (Android) |
| Local Database | SQLite |
| Central Database | PostgreSQL (future) |
| Traceability | QR Code at every transition |

---

## Monorepo Structure

```
manchengo-erp/
├── apps/
│   ├── desktop/          # Tauri application
│   └── mobile/           # Flutter application
├── packages/
│   ├── core/             # Shared Rust core library
│   ├── database/         # SQLite layer & migrations
│   ├── domain/           # Business domain models
│   └── sync/             # Event sync engine
├── docs/
│   ├── architecture/     # Technical documentation
│   ├── domain/           # Business domain docs
│   └── api/              # API specifications
├── tools/
│   └── scripts/          # Build & dev scripts
└── .github/
    └── workflows/        # CI/CD pipelines
```

---

## Domain Modules

| Module | Responsibility |
|--------|----------------|
| **appro** | Procurement, supplier management, raw material reception |
| **stock** | Inventory management, FIFO by lot, warehouse locations |
| **production** | Manufacturing orders, MP consumption, PF creation |
| **commercial** | Sales, client management, pricing by category |
| **delivery** | Truck loading, delivery notes, proof of delivery |
| **finance** | Cost calculation, payments, fiscal compliance |
| **sync** | Event sourcing, conflict resolution, central sync |
| **audit** | Activity logs, traceability reports |

---

## User Roles

| Role | Access | Platforms |
|------|--------|-----------|
| ADMIN | Full system access | Desktop + Mobile |
| APPRO | Procurement & raw material stock | Desktop + Mobile |
| PRODUCTION | Manufacturing & consumption | Desktop + Mobile |
| COMMERCIAL | Sales, delivery, payments | Desktop + Mobile |
| COMPTABLE | Audit & exports (read-only) | Desktop only |

---

## Algerian Fiscal Compliance

Required fields for all commercial entities:
- **NIF** (Numéro d'Identification Fiscale)
- **NIS** (Numéro d'Identification Statistique)
- **RC** (Registre de Commerce)
- **Article d'Imposition**
- **TVA** (19% standard rate)
- **Timbre Fiscal** (1% on invoices)

---

## Quick Start

### Prerequisites

- Rust 1.75+
- Node.js 20+
- Flutter 3.16+
- Android SDK (for mobile)

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd manchengo-erp

# Install dependencies
./tools/scripts/setup.sh

# Run desktop (development)
cd apps/desktop && cargo tauri dev

# Run mobile (development)
cd apps/mobile && flutter run
```

---

## License

Proprietary - All rights reserved.
