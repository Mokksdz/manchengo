-- Manchengo Smart ERP Desktop - SQLite Schema
-- Matches mobile app schema for offline-first operation

-- Sync state tracking
CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY,
    last_sync TEXT,
    synced_at TEXT
);

-- Sync events for event sourcing
CREATE TABLE IF NOT EXISTS sync_events (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    synced_at TEXT,
    device_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_events_synced ON sync_events(synced_at);
CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON sync_events(entity_type, entity_id);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    client_type TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    nif TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Products (Finished Products)
CREATE TABLE IF NOT EXISTS products_pf (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'KG',
    min_stock REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Products (Raw Materials)
CREATE TABLE IF NOT EXISTS products_mp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'KG',
    min_stock REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Lots (Finished Products)
CREATE TABLE IF NOT EXISTS lots_pf (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    lot_number TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    expiry_date TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products_pf(id)
);

-- Lots (Raw Materials)
CREATE TABLE IF NOT EXISTS lots_mp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    lot_number TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    expiry_date TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products_mp(id)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    total_ht INTEGER NOT NULL DEFAULT 0,
    total_tva INTEGER NOT NULL DEFAULT 0,
    timbre_fiscal INTEGER NOT NULL DEFAULT 0,
    total_ttc INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Invoice Lines
CREATE TABLE IF NOT EXISTS invoice_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit_price_ht INTEGER NOT NULL,
    line_ht INTEGER NOT NULL,
    line_tva INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (product_id) REFERENCES products_pf(id)
);

-- Price Lists
CREATE TABLE IF NOT EXISTS price_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    client_type TEXT NOT NULL,
    price_ht INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    valid_from TEXT NOT NULL,
    valid_to TEXT,
    FOREIGN KEY (product_id) REFERENCES products_pf(id)
);

-- Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_mp_id INTEGER,
    lot_pf_id INTEGER,
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    reference TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL
);

-- Local settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('server_url', 'http://localhost:3000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_sync', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('sync_interval', '300');
