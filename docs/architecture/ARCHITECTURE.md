# Manchengo Smart ERP — Technical Architecture

## 1. Architectural Principles

### 1.1 Offline-First Design

The ERP operates fully offline. Network connectivity is optional and used only for:
- Synchronization with central server
- Software updates
- Optional cloud backup

**Implications:**
- SQLite is the source of truth on each device
- All business operations complete locally
- Sync is eventual, not real-time
- Conflict resolution is deterministic

### 1.2 Event Sourcing for Sync

All state mutations generate immutable events. These events:
- Are stored locally in an event log
- Are replayed to central server when online
- Enable full audit trail
- Support offline conflict resolution

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Command   │───▶│   Handler   │───▶│   Event     │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                   ┌─────────────────────────┼─────────────────────────┐
                   │                         │                         │
                   ▼                         ▼                         ▼
            ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
            │ Local State │          │ Event Log   │          │ Sync Queue  │
            │ (SQLite)    │          │ (SQLite)    │          │ (SQLite)    │
            └─────────────┘          └─────────────┘          └─────────────┘
```

### 1.3 QR Code Traceability

Every physical transition requires QR code scanning:

```
[Raw Material Lot] ──QR──▶ [Production Order] ──QR──▶ [Finished Product] ──QR──▶ [Delivery]
```

QR codes encode:
- Entity type (LOT_MP, LOT_PF, ORDER, DELIVERY)
- Unique identifier (UUID)
- Optional: batch reference, expiry date

### 1.4 Multi-Platform Code Sharing

```
┌────────────────────────────────────────────────────────────────┐
│                        SHARED CORE (Rust)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Domain     │  │   Database   │  │   Sync       │         │
│  │   Models     │  │   Layer      │  │   Engine     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────────────────────────────────────────┘
         │                                      │
         ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│   Tauri Desktop     │              │   Flutter FFI       │
│   (direct Rust)     │              │   (via flutter_rust │
│                     │              │    _bridge)         │
└─────────────────────┘              └─────────────────────┘
```

---

## 2. Technology Stack

### 2.1 Desktop Application (Tauri)

| Layer | Technology |
|-------|------------|
| Shell | Tauri 2.x |
| Backend | Rust |
| Frontend | TypeScript + Vue 3 (or SolidJS) |
| Database | rusqlite |
| IPC | Tauri Commands |

### 2.2 Mobile Application (Flutter)

| Layer | Technology |
|-------|------------|
| Framework | Flutter 3.16+ |
| Language | Dart |
| Native Bridge | flutter_rust_bridge |
| Database | SQLite via Rust core |
| Camera/QR | mobile_scanner |

### 2.3 Shared Core (Rust)

| Component | Crate |
|-----------|-------|
| Database | rusqlite, diesel (optional) |
| Serialization | serde, serde_json |
| DateTime | chrono |
| UUID | uuid |
| Validation | validator |
| Error Handling | thiserror, anyhow |

### 2.4 Future Central Backend

| Component | Technology |
|-----------|------------|
| API | Rust (Axum) or Go |
| Database | PostgreSQL 15+ |
| Sync Protocol | Custom event-based |
| Auth | JWT + role-based |

---

## 3. Database Architecture

### 3.1 SQLite Configuration

```sql
-- Performance pragmas (applied on connection)
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

### 3.2 Schema Organization

```
┌─────────────────────────────────────────────────────────┐
│                    SQLite Database                      │
├─────────────────────────────────────────────────────────┤
│  CORE TABLES                                            │
│  ├── _migrations          (schema versioning)           │
│  ├── _events              (event log for sync)          │
│  ├── _sync_queue          (pending sync items)          │
│  └── _config              (app configuration)           │
├─────────────────────────────────────────────────────────┤
│  REFERENCE DATA                                         │
│  ├── ref_units            (units of measure)            │
│  ├── ref_categories       (product categories)          │
│  ├── ref_wilayas          (Algerian regions)            │
│  └── ref_communes         (Algerian municipalities)     │
├─────────────────────────────────────────────────────────┤
│  DOMAIN TABLES                                          │
│  ├── suppliers            (fournisseurs)                │
│  ├── clients              (clients)                     │
│  ├── products_mp          (raw materials)               │
│  ├── products_pf          (finished products)           │
│  ├── lots_mp              (raw material lots)           │
│  ├── lots_pf              (finished product lots)       │
│  ├── stock_movements      (all stock entries/exits)     │
│  ├── production_orders    (ordres de fabrication)       │
│  ├── production_consumptions (MP consumed)              │
│  ├── sales_orders         (commandes clients)           │
│  ├── sales_order_lines    (lignes de commande)          │
│  ├── deliveries           (bons de livraison)           │
│  ├── delivery_lines       (lignes de livraison)         │
│  ├── payments             (règlements)                  │
│  └── invoices             (factures)                    │
├─────────────────────────────────────────────────────────┤
│  AUDIT TABLES                                           │
│  ├── audit_log            (all user actions)            │
│  └── qr_scans             (all QR scan events)          │
└─────────────────────────────────────────────────────────┘
```

### 3.3 FIFO Stock Management

Lots are consumed in First-In-First-Out order based on:
1. Reception date (primary)
2. Expiry date (secondary, for perishables)

```sql
-- FIFO lot selection query pattern
SELECT id, quantity_remaining, reception_date, expiry_date
FROM lots_mp
WHERE product_id = ? AND quantity_remaining > 0 AND status = 'AVAILABLE'
ORDER BY reception_date ASC, expiry_date ASC
LIMIT ?;
```

---

## 4. Sync Architecture

### 4.1 Event Structure

```rust
pub struct DomainEvent {
    pub id: Uuid,
    pub aggregate_type: String,    // "Lot", "Order", "Delivery"
    pub aggregate_id: Uuid,
    pub event_type: String,        // "LotCreated", "OrderConfirmed"
    pub payload: serde_json::Value,
    pub occurred_at: DateTime<Utc>,
    pub user_id: Uuid,
    pub device_id: Uuid,
    pub version: i64,              // For optimistic concurrency
    pub synced: bool,
}
```

### 4.2 Sync Flow

```
LOCAL DEVICE                           CENTRAL SERVER
─────────────                          ──────────────
    │                                        │
    │  1. Collect unsynced events            │
    │──────────────────────────────────────▶│
    │     POST /sync/push                    │
    │     [Event1, Event2, ...]              │
    │                                        │
    │  2. Server validates & stores          │
    │                                        │
    │  3. Return confirmation + new events   │
    │◀──────────────────────────────────────│
    │     { synced: [...], new: [...] }      │
    │                                        │
    │  4. Apply new events locally           │
    │  5. Mark local events as synced        │
    │                                        │
```

### 4.3 Conflict Resolution

Strategy: **Last-Write-Wins with Business Rules Override**

1. Timestamp-based for simple fields
2. Business rule validation for critical operations (stock < 0 → reject)
3. Manual resolution queue for unresolvable conflicts

---

## 5. Security Model

### 5.1 Local Security

- SQLite database encryption (SQLCipher)
- User session with inactivity timeout
- Role-based access control (RBAC)
- PIN or biometric unlock on mobile

### 5.2 Data Sensitivity

| Data Type | Classification | Protection |
|-----------|---------------|------------|
| Client NIF/NIS/RC | Sensitive | Encrypted at rest |
| Financial data | Sensitive | Encrypted, audit logged |
| Stock quantities | Business | Standard protection |
| Production data | Business | Standard protection |

---

## 6. Module Dependencies

```
                    ┌─────────┐
                    │  core   │
                    └────┬────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌──────────┐    ┌─────────┐
    │ database│    │  domain  │    │  sync   │
    └────┬────┘    └────┬─────┘    └────┬────┘
         │              │               │
         └──────────────┴───────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
            ▼                       ▼
       ┌─────────┐            ┌──────────┐
       │ desktop │            │  mobile  │
       └─────────┘            └──────────┘
```

---

## 7. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Offline operation | 100% functionality without network |
| Data sync latency | < 5 seconds when online |
| Cold start time | < 3 seconds |
| Database size | Support up to 10GB local |
| Concurrent users | 1 per device (multi-device per user OK) |
| Supported Android | API 24+ (Android 7.0+) |
| Supported Desktop | Windows 10+, macOS 11+, Linux |

---

## 8. Assumptions & Constraints

### Assumptions

1. Each device operates independently (no real-time collaboration)
2. Central server is optional for first phase
3. Network connectivity is unreliable (rural locations)
4. Users have basic technical literacy
5. Barcode printers are available for QR labels

### Constraints

1. No proprietary cloud dependencies (must be self-hostable)
2. Must comply with Algerian fiscal law
3. French language UI (Arabic optional later)
4. Data must never be lost due to sync failures
5. No internet-dependent features in core workflows
