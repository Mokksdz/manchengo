# Manchengo Smart ERP — Naming Conventions & Coding Standards

## 1. General Principles

- **Consistency over cleverness**: Follow established patterns, even if alternatives seem shorter
- **Explicitness over brevity**: Names should be self-documenting
- **Domain-driven naming**: Use business terminology (French where appropriate)

---

## 2. Database Naming Conventions

### 2.1 Tables

| Pattern | Example | Description |
|---------|---------|-------------|
| `snake_case` | `products_mp` | All lowercase with underscores |
| Plural nouns | `clients`, `lots_mp` | Tables represent collections |
| Domain prefix | `ref_*` | Reference/lookup tables |
| System prefix | `_*` | Internal system tables |

**Examples:**
```
products_mp        -- Raw material products
products_pf        -- Finished products
lots_mp           -- Raw material lots
lots_pf           -- Finished product lots
stock_movements   -- Stock movement history
production_orders -- Manufacturing orders
sales_orders      -- Client orders
delivery_lines    -- Delivery line items
ref_units         -- Units of measure reference
ref_wilayas       -- Algerian regions reference
_events           -- Event store (system)
_sync_queue       -- Sync queue (system)
```

### 2.2 Columns

| Pattern | Example | Description |
|---------|---------|-------------|
| `snake_case` | `created_at` | All lowercase |
| `_id` suffix | `client_id` | Foreign keys |
| `_at` suffix | `created_at` | Timestamps |
| `_by` suffix | `created_by` | User references |
| `is_` prefix | `is_active` | Boolean flags |
| `_count` suffix | `item_count` | Computed counts |

**Standard columns for all entities:**
```sql
id TEXT PRIMARY KEY           -- UUID v7 (time-sortable)
created_at TEXT NOT NULL      -- ISO 8601 timestamp
updated_at TEXT NOT NULL      -- ISO 8601 timestamp
created_by TEXT NOT NULL      -- User ID who created
updated_by TEXT NOT NULL      -- User ID who last updated
```

### 2.3 Indexes

```
idx_{table}_{column}          -- Single column index
idx_{table}_{col1}_{col2}     -- Composite index
```

### 2.4 Status Values

Use `SCREAMING_SNAKE_CASE` for all status/enum values:

```
DRAFT, ACTIVE, INACTIVE, DELETED
AVAILABLE, RESERVED, CONSUMED, EXPIRED, BLOCKED
PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
UNPAID, PARTIAL, PAID
```

---

## 3. Rust Code Conventions

### 3.1 Crate Naming

```
manchengo-core      -- Core utilities
manchengo-database  -- Database layer
manchengo-domain    -- Domain models
manchengo-sync      -- Sync engine
manchengo-desktop   -- Desktop app
```

### 3.2 Module Structure

```rust
// lib.rs - Public API exports
pub mod module_name;
pub use module_name::PublicType;

// mod.rs - Module organization
mod submodule;
pub use submodule::*;
```

### 3.3 Types

| Type | Convention | Example |
|------|------------|---------|
| Structs | `PascalCase` | `ProductionOrder` |
| Enums | `PascalCase` | `OrderStatus` |
| Enum variants | `PascalCase` | `InProgress` |
| Traits | `PascalCase` | `Repository` |
| Type aliases | `PascalCase` | `Result<T>` |

### 3.4 Functions & Methods

```rust
// Functions: snake_case, verb-first
fn calculate_total() -> Money
fn validate_nif(nif: &str) -> bool
fn create_lot() -> Result<LotMp>

// Getters: no 'get_' prefix
fn total(&self) -> Money
fn is_active(&self) -> bool

// Setters: 'set_' prefix
fn set_status(&mut self, status: Status)

// Builders: return Self
fn with_notes(mut self, notes: String) -> Self
```

### 3.5 Constants

```rust
// Module-level constants: SCREAMING_SNAKE_CASE
pub const MAX_RETRY_ATTEMPTS: i32 = 5;
pub const DEFAULT_PAGE_SIZE: i32 = 50;

// Associated constants
impl AlgerianTaxRates {
    pub const TVA_STANDARD: f64 = 0.19;
    pub const TIMBRE_FISCAL: f64 = 0.01;
}
```

### 3.6 Error Handling

```rust
// Error enum with thiserror
#[derive(Error, Debug)]
pub enum Error {
    #[error("Database error: {0}")]
    Database(String),
    
    #[error("Not found: {entity_type} with id {id}")]
    NotFound { entity_type: String, id: String },
}

// Result type alias
pub type Result<T> = std::result::Result<T, Error>;
```

---

## 4. Domain Event Conventions

### 4.1 Event Naming

```
{Aggregate}{Action}        -- Past tense for completed actions

LotMpCreated              -- Lot was created
LotMpQuantityReduced      -- Quantity was reduced
ProductionOrderStarted    -- Production started
DeliveryCompleted         -- Delivery completed
PaymentReceived           -- Payment received
```

### 4.2 Event Structure

```rust
pub struct LotMpCreated {
    pub lot_id: EntityId,           // Aggregate ID
    pub lot_number: String,         // Business reference
    pub product_id: EntityId,       // Related entity
    pub quantity: f64,              // Domain value
    pub unit_cost_centimes: i64,    // Money as centimes
    pub reception_date: String,     // ISO date string
}
```

---

## 5. Flutter/Dart Conventions

### 5.1 File Naming

```
snake_case.dart           -- All Dart files
{feature}_screen.dart     -- Screen widgets
{feature}_provider.dart   -- Riverpod providers
{entity}_model.dart       -- Data models
{entity}_repository.dart  -- Repository classes
```

### 5.2 Directory Structure

```
lib/
├── core/
│   ├── database/
│   ├── router/
│   └── theme/
├── features/
│   ├── auth/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   ├── stock/
│   ├── production/
│   └── delivery/
└── shared/
    ├── widgets/
    └── utils/
```

### 5.3 Class Naming

```dart
// Widgets: descriptive, PascalCase
class StockListScreen extends StatelessWidget
class LotMpCard extends StatelessWidget

// Providers: camelCase with 'Provider' suffix
final stockProvider = Provider<StockRepository>((ref) => ...);
final lotsProvider = FutureProvider<List<LotMp>>((ref) => ...);

// Models: PascalCase, immutable with freezed
@freezed
class LotMp with _$LotMp {
  const factory LotMp({...}) = _LotMp;
}
```

---

## 6. API & IPC Conventions

### 6.1 Tauri Commands

```rust
// Command naming: snake_case, verb_noun pattern
#[tauri::command]
pub fn list_products_mp(state: State<AppState>) -> Result<Vec<ProductDto>>

#[tauri::command]
pub fn get_product_mp(state: State<AppState>, id: String) -> Result<Option<ProductDto>>

#[tauri::command]
pub fn create_lot_mp(state: State<AppState>, data: CreateLotDto) -> Result<LotDto>
```

### 6.2 DTOs (Data Transfer Objects)

```rust
// DTO naming: {Entity}Dto for responses, {Action}{Entity}Dto for requests
pub struct ProductMpDto { ... }        // Response
pub struct CreateLotMpDto { ... }      // Create request
pub struct UpdateLotMpDto { ... }      // Update request
```

---

## 7. QR Code Format

### 7.1 Encoding

```
MCG:{TYPE}:{ID}:{REFERENCE}:{CHECKSUM}

MCG:LMP:01234567-89ab-cdef:LOT-240115-00001:a1b2c3d4
MCG:LPF:01234567-89ab-cdef:PF-OF001-240115-01:e5f6g7h8
MCG:ORD:01234567-89ab-cdef:OF-240115-00001:i9j0k1l2
MCG:DLV:01234567-89ab-cdef:BL-240115-00001:m3n4o5p6
```

### 7.2 Type Codes

| Code | Entity | Description |
|------|--------|-------------|
| `LMP` | LotMp | Raw material lot |
| `LPF` | LotPf | Finished product lot |
| `ORD` | ProductionOrder | Production order |
| `DLV` | Delivery | Delivery note |
| `LOC` | Location | Warehouse location |

---

## 8. Reference Number Formats

### 8.1 Patterns

```
{PREFIX}-{YYMMDD}-{SEQUENCE}

LOT-240115-00001      -- Raw material lot
PF-OF001-240115-01    -- Finished product lot (from order OF001)
OF-240115-00001       -- Production order (Ordre de Fabrication)
CMD-240115-00001      -- Sales order (Commande)
BL-240115-00001       -- Delivery note (Bon de Livraison)
FAC-240115-00001      -- Invoice (Facture)
REG-240115-00001      -- Payment (Règlement)
REC-240115-00001      -- Reception note
```

### 8.2 Prefixes

| Prefix | Entity | French Term |
|--------|--------|-------------|
| `LOT` | Raw material lot | Lot MP |
| `PF` | Finished product lot | Lot PF |
| `OF` | Production order | Ordre de Fabrication |
| `CMD` | Sales order | Commande |
| `BL` | Delivery note | Bon de Livraison |
| `FAC` | Invoice | Facture |
| `REG` | Payment | Règlement |
| `REC` | Reception | Réception |

---

## 9. Money & Quantities

### 9.1 Money Storage

- **Always store in centimes** (integer, not float)
- 1 DZD = 100 centimes
- Use `i64` in Rust, `int` in Dart
- Display formatting at presentation layer only

```rust
// Correct
let price = Money::from_centimes(15000); // 150.00 DZD

// Incorrect
let price = 150.00; // Never store money as float
```

### 9.2 Quantities

- Store as `f64` for flexibility
- Always pair with unit of measure
- Use Quantity struct for type safety

```rust
pub struct Quantity {
    pub value: f64,
    pub unit: UnitOfMeasure,
}
```

---

## 10. Logging & Tracing

### 10.1 Log Levels

| Level | Usage |
|-------|-------|
| `error` | Failures requiring attention |
| `warn` | Unexpected but handled conditions |
| `info` | Significant business events |
| `debug` | Detailed operational info |
| `trace` | Very detailed debugging |

### 10.2 Structured Logging

```rust
use tracing::{info, debug, error};

info!(lot_id = %lot.id, quantity = lot.quantity, "Lot created");
debug!(user_id = %user_id, "Processing request");
error!(error = %e, "Database query failed");
```

---

## 11. Git Conventions

### 11.1 Branch Naming

```
main                    -- Production-ready code
develop                 -- Integration branch
feature/{ticket}-{desc} -- Feature branches
bugfix/{ticket}-{desc}  -- Bug fixes
release/{version}       -- Release preparation
```

### 11.2 Commit Messages

```
type(scope): description

feat(stock): add FIFO lot selection
fix(sync): resolve conflict detection bug
docs(api): update command documentation
refactor(domain): extract pricing service
test(production): add order workflow tests
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`
