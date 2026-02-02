-- Manchengo ERP - Initial Schema Migration
-- Version: 1
-- Description: Core tables for all domain modules

-- ============================================================================
-- CORE SYSTEM TABLES
-- ============================================================================

-- Event log for sync (event sourcing)
CREATE TABLE IF NOT EXISTS _events (
    id TEXT PRIMARY KEY,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,  -- JSON
    occurred_at TEXT NOT NULL,
    user_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_aggregate ON _events(aggregate_type, aggregate_id);
CREATE INDEX idx_events_synced ON _events(synced, occurred_at);
CREATE INDEX idx_events_type ON _events(event_type);

-- Sync queue for pending uploads
CREATE TABLE IF NOT EXISTS _sync_queue (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES _events(id),
    priority INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sync_queue_priority ON _sync_queue(priority DESC, created_at ASC);

-- Application configuration
CREATE TABLE IF NOT EXISTS _config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit log for all user actions
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_value TEXT,  -- JSON
    new_value TEXT,  -- JSON
    ip_address TEXT,
    device_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- QR code scan history
CREATE TABLE IF NOT EXISTS qr_scans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    qr_data TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    scan_context TEXT NOT NULL,  -- RECEPTION, PRODUCTION, DELIVERY, etc.
    location_lat REAL,
    location_lon REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_qr_scans_entity ON qr_scans(entity_type, entity_id);

-- ============================================================================
-- REFERENCE DATA TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ref_units (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    base_unit TEXT,
    conversion_factor REAL DEFAULT 1.0,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ref_categories (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES ref_categories(id),
    category_type TEXT NOT NULL,  -- MP, PF
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ref_wilayas (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT
);

CREATE TABLE IF NOT EXISTS ref_communes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT,
    wilaya_code TEXT NOT NULL REFERENCES ref_wilayas(code),
    postal_code TEXT
);

CREATE INDEX idx_communes_wilaya ON ref_communes(wilaya_code);

-- ============================================================================
-- USER & ACCESS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,  -- ADMIN, APPRO, PRODUCTION, COMMERCIAL, COMPTABLE
    email TEXT,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL,  -- DESKTOP, MOBILE
    last_sync_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- PROCUREMENT DOMAIN (APPRO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    commune TEXT,
    wilaya_code TEXT REFERENCES ref_wilayas(code),
    -- Fiscal identity
    nif TEXT,
    nis TEXT,
    rc TEXT,
    article_imposition TEXT,
    -- Metadata
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_suppliers_code ON suppliers(code);
CREATE INDEX idx_suppliers_name ON suppliers(name);

-- ============================================================================
-- STOCK DOMAIN
-- ============================================================================

-- Raw materials (Matières Premières)
CREATE TABLE IF NOT EXISTS products_mp (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id TEXT REFERENCES ref_categories(id),
    unit TEXT NOT NULL REFERENCES ref_units(code),
    min_stock_level REAL DEFAULT 0,
    reorder_point REAL DEFAULT 0,
    is_perishable INTEGER NOT NULL DEFAULT 1,
    default_shelf_life_days INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_products_mp_code ON products_mp(code);
CREATE INDEX idx_products_mp_category ON products_mp(category_id);

-- Finished products (Produits Finis)
CREATE TABLE IF NOT EXISTS products_pf (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_id TEXT REFERENCES ref_categories(id),
    unit TEXT NOT NULL REFERENCES ref_units(code),
    weight_kg REAL,  -- For delivery planning
    min_stock_level REAL DEFAULT 0,
    is_perishable INTEGER NOT NULL DEFAULT 1,
    default_shelf_life_days INTEGER,
    -- Pricing (base prices, actual prices in price_lists)
    base_price_ht INTEGER NOT NULL DEFAULT 0,  -- centimes
    tva_rate REAL NOT NULL DEFAULT 0.19,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_products_pf_code ON products_pf(code);
CREATE INDEX idx_products_pf_category ON products_pf(category_id);

-- Raw material lots
CREATE TABLE IF NOT EXISTS lots_mp (
    id TEXT PRIMARY KEY,
    lot_number TEXT NOT NULL UNIQUE,
    product_id TEXT NOT NULL REFERENCES products_mp(id),
    supplier_id TEXT REFERENCES suppliers(id),
    -- Quantities
    quantity_initial REAL NOT NULL,
    quantity_remaining REAL NOT NULL,
    unit TEXT NOT NULL REFERENCES ref_units(code),
    -- Dates
    reception_date TEXT NOT NULL,
    production_date TEXT,
    expiry_date TEXT,
    -- Cost
    unit_cost INTEGER NOT NULL DEFAULT 0,  -- centimes
    total_cost INTEGER NOT NULL DEFAULT 0,  -- centimes
    -- Traceability
    supplier_lot_number TEXT,
    supplier_bl_number TEXT,  -- Bon de livraison
    bl_photo_path TEXT,
    -- Status
    status TEXT NOT NULL DEFAULT 'AVAILABLE',  -- AVAILABLE, RESERVED, CONSUMED, EXPIRED, BLOCKED
    blocked_reason TEXT,
    -- QR
    qr_code TEXT NOT NULL,
    -- Metadata
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_lots_mp_product ON lots_mp(product_id, status);
CREATE INDEX idx_lots_mp_fifo ON lots_mp(product_id, reception_date, expiry_date);
CREATE INDEX idx_lots_mp_expiry ON lots_mp(expiry_date);
CREATE INDEX idx_lots_mp_qr ON lots_mp(qr_code);

-- Finished product lots
CREATE TABLE IF NOT EXISTS lots_pf (
    id TEXT PRIMARY KEY,
    lot_number TEXT NOT NULL UNIQUE,
    product_id TEXT NOT NULL REFERENCES products_pf(id),
    production_order_id TEXT,  -- Will reference production_orders
    -- Quantities
    quantity_initial REAL NOT NULL,
    quantity_remaining REAL NOT NULL,
    unit TEXT NOT NULL REFERENCES ref_units(code),
    -- Dates
    production_date TEXT NOT NULL,
    expiry_date TEXT,
    -- Cost
    unit_cost INTEGER NOT NULL DEFAULT 0,  -- centimes (calculated from production)
    total_cost INTEGER NOT NULL DEFAULT 0,  -- centimes
    -- Status
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    blocked_reason TEXT,
    -- QR
    qr_code TEXT NOT NULL,
    -- Metadata
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_lots_pf_product ON lots_pf(product_id, status);
CREATE INDEX idx_lots_pf_fifo ON lots_pf(product_id, production_date, expiry_date);
CREATE INDEX idx_lots_pf_expiry ON lots_pf(expiry_date);
CREATE INDEX idx_lots_pf_qr ON lots_pf(qr_code);

-- Stock movements (all entries and exits)
CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    -- What moved
    product_type TEXT NOT NULL,  -- MP, PF
    product_id TEXT NOT NULL,
    lot_id TEXT NOT NULL,
    -- Movement details
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,  -- Positive for entries, negative for exits
    unit TEXT NOT NULL REFERENCES ref_units(code),
    -- Reference to source document
    reference_type TEXT,  -- RECEPTION, PRODUCTION_ORDER, SALES_ORDER, DELIVERY, ADJUSTMENT
    reference_id TEXT,
    -- Balance after movement
    quantity_before REAL NOT NULL,
    quantity_after REAL NOT NULL,
    -- Metadata
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_type, product_id);
CREATE INDEX idx_stock_movements_lot ON stock_movements(lot_id);
CREATE INDEX idx_stock_movements_ref ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(created_at);

-- Warehouse locations (optional for P2)
CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- PRODUCTION DOMAIN
-- ============================================================================

-- Recipes (Fiches techniques)
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    product_pf_id TEXT NOT NULL REFERENCES products_pf(id),
    output_quantity REAL NOT NULL,
    output_unit TEXT NOT NULL REFERENCES ref_units(code),
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_recipes_product ON recipes(product_pf_id);

-- Recipe ingredients
CREATE TABLE IF NOT EXISTS recipe_lines (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    product_mp_id TEXT NOT NULL REFERENCES products_mp(id),
    quantity REAL NOT NULL,
    unit TEXT NOT NULL REFERENCES ref_units(code),
    is_optional INTEGER NOT NULL DEFAULT 0,
    notes TEXT
);

CREATE INDEX idx_recipe_lines_recipe ON recipe_lines(recipe_id);

-- Production orders (Ordres de fabrication)
CREATE TABLE IF NOT EXISTS production_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    recipe_id TEXT NOT NULL REFERENCES recipes(id),
    product_pf_id TEXT NOT NULL REFERENCES products_pf(id),
    -- Quantities
    planned_quantity REAL NOT NULL,
    actual_quantity REAL,
    unit TEXT NOT NULL REFERENCES ref_units(code),
    -- Dates
    planned_date TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    -- Status
    status TEXT NOT NULL DEFAULT 'DRAFT',  -- DRAFT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
    -- Cost tracking
    total_mp_cost INTEGER DEFAULT 0,  -- centimes
    additional_costs INTEGER DEFAULT 0,  -- centimes
    total_cost INTEGER DEFAULT 0,  -- centimes
    -- QR
    qr_code TEXT NOT NULL,
    -- Metadata
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_production_orders_status ON production_orders(status, planned_date);
CREATE INDEX idx_production_orders_product ON production_orders(product_pf_id);
CREATE INDEX idx_production_orders_qr ON production_orders(qr_code);

-- Production consumptions (MP used in production)
CREATE TABLE IF NOT EXISTS production_consumptions (
    id TEXT PRIMARY KEY,
    production_order_id TEXT NOT NULL REFERENCES production_orders(id),
    lot_mp_id TEXT NOT NULL REFERENCES lots_mp(id),
    product_mp_id TEXT NOT NULL REFERENCES products_mp(id),
    quantity REAL NOT NULL,
    unit TEXT NOT NULL REFERENCES ref_units(code),
    unit_cost INTEGER NOT NULL,  -- centimes
    total_cost INTEGER NOT NULL,  -- centimes
    consumed_at TEXT NOT NULL DEFAULT (datetime('now')),
    consumed_by TEXT NOT NULL
);

CREATE INDEX idx_production_consumptions_order ON production_consumptions(production_order_id);
CREATE INDEX idx_production_consumptions_lot ON production_consumptions(lot_mp_id);

-- Production outputs (PF created from production)
CREATE TABLE IF NOT EXISTS production_outputs (
    id TEXT PRIMARY KEY,
    production_order_id TEXT NOT NULL REFERENCES production_orders(id),
    lot_pf_id TEXT NOT NULL REFERENCES lots_pf(id),
    product_pf_id TEXT NOT NULL REFERENCES products_pf(id),
    quantity REAL NOT NULL,
    unit TEXT NOT NULL REFERENCES ref_units(code),
    produced_at TEXT NOT NULL DEFAULT (datetime('now')),
    produced_by TEXT NOT NULL
);

CREATE INDEX idx_production_outputs_order ON production_outputs(production_order_id);

-- ============================================================================
-- COMMERCIAL DOMAIN
-- ============================================================================

-- Clients
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    client_type TEXT NOT NULL,  -- DISTRIBUTEUR, GROSSISTE, SUPERETTE, FAST_FOOD
    contact_name TEXT,
    phone TEXT,
    phone_secondary TEXT,
    email TEXT,
    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    commune TEXT,
    wilaya_code TEXT REFERENCES ref_wilayas(code),
    gps_lat REAL,
    gps_lon REAL,
    -- Fiscal identity
    nif TEXT,
    nis TEXT,
    rc TEXT,
    article_imposition TEXT,
    -- Commercial terms
    payment_terms_days INTEGER DEFAULT 0,
    credit_limit INTEGER DEFAULT 0,  -- centimes
    current_balance INTEGER DEFAULT 0,  -- centimes (positive = they owe us)
    -- Metadata
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_clients_code ON clients(code);
CREATE INDEX idx_clients_type ON clients(client_type);
CREATE INDEX idx_clients_wilaya ON clients(wilaya_code);

-- Price lists by client type
CREATE TABLE IF NOT EXISTS price_lists (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    client_type TEXT NOT NULL,  -- DISTRIBUTEUR, GROSSISTE, SUPERETTE, FAST_FOOD
    valid_from TEXT NOT NULL,
    valid_until TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_price_lists_type ON price_lists(client_type, is_active);

-- Price list lines
CREATE TABLE IF NOT EXISTS price_list_lines (
    id TEXT PRIMARY KEY,
    price_list_id TEXT NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    product_pf_id TEXT NOT NULL REFERENCES products_pf(id),
    price_ht INTEGER NOT NULL,  -- centimes
    min_quantity REAL DEFAULT 1,
    UNIQUE(price_list_id, product_pf_id, min_quantity)
);

CREATE INDEX idx_price_list_lines_list ON price_list_lines(price_list_id);
CREATE INDEX idx_price_list_lines_product ON price_list_lines(product_pf_id);

-- Sales orders (Commandes client)
CREATE TABLE IF NOT EXISTS sales_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL REFERENCES clients(id),
    -- Dates
    order_date TEXT NOT NULL,
    requested_date TEXT,
    -- Status
    status TEXT NOT NULL DEFAULT 'DRAFT',  -- DRAFT, CONFIRMED, PREPARED, DELIVERED, CANCELLED
    -- Amounts
    total_ht INTEGER NOT NULL DEFAULT 0,  -- centimes
    total_tva INTEGER NOT NULL DEFAULT 0,  -- centimes
    total_ttc INTEGER NOT NULL DEFAULT 0,  -- centimes
    -- Payment
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',  -- UNPAID, PARTIAL, PAID
    amount_paid INTEGER NOT NULL DEFAULT 0,  -- centimes
    -- Metadata
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_sales_orders_client ON sales_orders(client_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status, order_date);
CREATE INDEX idx_sales_orders_payment ON sales_orders(payment_status);

-- Sales order lines
CREATE TABLE IF NOT EXISTS sales_order_lines (
    id TEXT PRIMARY KEY,
    sales_order_id TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_pf_id TEXT NOT NULL REFERENCES products_pf(id),
    quantity REAL NOT NULL,
    unit TEXT NOT NULL REFERENCES ref_units(code),
    unit_price_ht INTEGER NOT NULL,  -- centimes
    tva_rate REAL NOT NULL DEFAULT 0.19,
    total_ht INTEGER NOT NULL,  -- centimes
    total_tva INTEGER NOT NULL,  -- centimes
    total_ttc INTEGER NOT NULL,  -- centimes
    -- For delivery tracking
    quantity_delivered REAL DEFAULT 0,
    notes TEXT
);

CREATE INDEX idx_sales_order_lines_order ON sales_order_lines(sales_order_id);

-- ============================================================================
-- DELIVERY DOMAIN
-- ============================================================================

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    license_plate TEXT NOT NULL,
    capacity_kg REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Deliveries (Bons de livraison)
CREATE TABLE IF NOT EXISTS deliveries (
    id TEXT PRIMARY KEY,
    delivery_number TEXT NOT NULL UNIQUE,
    -- Vehicle and driver
    vehicle_id TEXT REFERENCES vehicles(id),
    driver_name TEXT,
    driver_phone TEXT,
    -- Date and time
    planned_date TEXT NOT NULL,
    departure_at TEXT,
    completed_at TEXT,
    -- Status
    status TEXT NOT NULL DEFAULT 'DRAFT',  -- DRAFT, PREPARED, LOADED, IN_TRANSIT, DELIVERED, PARTIAL, RETURNED
    -- Totals
    total_ht INTEGER NOT NULL DEFAULT 0,
    total_tva INTEGER NOT NULL DEFAULT 0,
    total_ttc INTEGER NOT NULL DEFAULT 0,
    total_weight_kg REAL DEFAULT 0,
    -- QR
    qr_code TEXT NOT NULL,
    -- Metadata
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_deliveries_status ON deliveries(status, planned_date);
CREATE INDEX idx_deliveries_vehicle ON deliveries(vehicle_id);
CREATE INDEX idx_deliveries_qr ON deliveries(qr_code);

-- Delivery lines (one per client per delivery)
CREATE TABLE IF NOT EXISTS delivery_lines (
    id TEXT PRIMARY KEY,
    delivery_id TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES clients(id),
    sales_order_id TEXT REFERENCES sales_orders(id),
    -- Sequence for route
    sequence_number INTEGER NOT NULL DEFAULT 0,
    -- Status for this client
    status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, DELIVERED, PARTIAL, REFUSED
    delivered_at TEXT,
    -- Amounts for this client
    total_ht INTEGER NOT NULL DEFAULT 0,
    total_ttc INTEGER NOT NULL DEFAULT 0,
    -- Proof
    signature_path TEXT,
    photo_path TEXT,
    -- Payment collected
    payment_collected INTEGER DEFAULT 0,  -- centimes
    payment_method TEXT,  -- CASH, CHECK
    -- Metadata
    notes TEXT,
    refusal_reason TEXT
);

CREATE INDEX idx_delivery_lines_delivery ON delivery_lines(delivery_id);
CREATE INDEX idx_delivery_lines_client ON delivery_lines(client_id);
CREATE INDEX idx_delivery_lines_order ON delivery_lines(sales_order_id);

-- Delivery line items (products in each delivery line)
CREATE TABLE IF NOT EXISTS delivery_line_items (
    id TEXT PRIMARY KEY,
    delivery_line_id TEXT NOT NULL REFERENCES delivery_lines(id) ON DELETE CASCADE,
    product_pf_id TEXT NOT NULL REFERENCES products_pf(id),
    lot_pf_id TEXT NOT NULL REFERENCES lots_pf(id),
    quantity_planned REAL NOT NULL,
    quantity_delivered REAL DEFAULT 0,
    unit TEXT NOT NULL REFERENCES ref_units(code),
    unit_price_ht INTEGER NOT NULL,
    total_ht INTEGER NOT NULL,
    -- QR scanned at loading
    qr_scanned_at TEXT,
    qr_scanned_by TEXT
);

CREATE INDEX idx_delivery_line_items_line ON delivery_line_items(delivery_line_id);
CREATE INDEX idx_delivery_line_items_lot ON delivery_line_items(lot_pf_id);

-- ============================================================================
-- FINANCE DOMAIN
-- ============================================================================

-- Invoices (Factures)
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL REFERENCES clients(id),
    delivery_id TEXT REFERENCES deliveries(id),
    -- Dates
    invoice_date TEXT NOT NULL,
    due_date TEXT,
    -- Amounts
    total_ht INTEGER NOT NULL,
    total_tva INTEGER NOT NULL,
    timbre_fiscal INTEGER NOT NULL DEFAULT 0,
    total_ttc INTEGER NOT NULL,
    -- Payment
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    amount_paid INTEGER NOT NULL DEFAULT 0,
    -- Status
    status TEXT NOT NULL DEFAULT 'DRAFT',  -- DRAFT, VALIDATED, SENT, PAID, CANCELLED
    -- Metadata
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status, invoice_date);
CREATE INDEX idx_invoices_payment ON invoices(payment_status);

-- Invoice lines
CREATE TABLE IF NOT EXISTS invoice_lines (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_pf_id TEXT NOT NULL REFERENCES products_pf(id),
    description TEXT,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    unit_price_ht INTEGER NOT NULL,
    tva_rate REAL NOT NULL,
    total_ht INTEGER NOT NULL,
    total_tva INTEGER NOT NULL,
    total_ttc INTEGER NOT NULL
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- Payments (Règlements)
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    payment_number TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL REFERENCES clients(id),
    invoice_id TEXT REFERENCES invoices(id),
    -- Payment details
    amount INTEGER NOT NULL,  -- centimes
    payment_date TEXT NOT NULL,
    payment_method TEXT NOT NULL,  -- CASH, CHECK, TRANSFER, OTHER
    -- Check details (if applicable)
    check_number TEXT,
    check_bank TEXT,
    check_date TEXT,
    -- Status
    status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, VALIDATED, REJECTED
    -- Metadata
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL
);

CREATE INDEX idx_payments_client ON payments(client_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- Cost entries for cost tracking
CREATE TABLE IF NOT EXISTS cost_entries (
    id TEXT PRIMARY KEY,
    cost_type TEXT NOT NULL,  -- MP, PRODUCTION, TRANSPORT, OTHER
    reference_type TEXT,
    reference_id TEXT,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,  -- centimes
    cost_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL
);

CREATE INDEX idx_cost_entries_type ON cost_entries(cost_type, cost_date);
CREATE INDEX idx_cost_entries_ref ON cost_entries(reference_type, reference_id);
