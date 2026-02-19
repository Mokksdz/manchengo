//! Database schema definitions and table constants

/// Core system tables
pub mod core {
    pub const MIGRATIONS: &str = "_migrations";
    pub const EVENTS: &str = "_events";
    pub const SYNC_QUEUE: &str = "_sync_queue";
    pub const CONFLICTS: &str = "_conflicts";
    pub const CONFIG: &str = "_config";
    pub const AUDIT_LOG: &str = "audit_log";
}

/// Reference data tables
pub mod reference {
    pub const UNITS: &str = "ref_units";
    pub const CATEGORIES: &str = "ref_categories";
    pub const WILAYAS: &str = "ref_wilayas";
    pub const COMMUNES: &str = "ref_communes";
}

/// Procurement domain tables
pub mod appro {
    pub const SUPPLIERS: &str = "suppliers";
    pub const PURCHASE_ORDERS: &str = "purchase_orders";
    pub const PURCHASE_ORDER_LINES: &str = "purchase_order_lines";
    pub const RECEPTION_NOTES: &str = "reception_notes";
}

/// Stock domain tables
pub mod stock {
    pub const PRODUCTS_MP: &str = "products_mp";
    pub const PRODUCTS_PF: &str = "products_pf";
    pub const LOTS_MP: &str = "lots_mp";
    pub const LOTS_PF: &str = "lots_pf";
    pub const STOCK_MOVEMENTS: &str = "stock_movements";
    pub const WAREHOUSES: &str = "warehouses";
    pub const WAREHOUSE_LOCATIONS: &str = "warehouse_locations";
}

/// Production domain tables
pub mod production {
    pub const PRODUCTION_ORDERS: &str = "production_orders";
    pub const PRODUCTION_CONSUMPTIONS: &str = "production_consumptions";
    pub const PRODUCTION_OUTPUTS: &str = "production_outputs";
    pub const RECIPES: &str = "recipes";
    pub const RECIPE_LINES: &str = "recipe_lines";
}

/// Commercial domain tables
pub mod commercial {
    pub const CLIENTS: &str = "clients";
    pub const PRICE_LISTS: &str = "price_lists";
    pub const PRICE_LIST_LINES: &str = "price_list_lines";
    pub const SALES_ORDERS: &str = "sales_orders";
    pub const SALES_ORDER_LINES: &str = "sales_order_lines";
}

/// Delivery domain tables
pub mod delivery {
    pub const DELIVERIES: &str = "deliveries";
    pub const DELIVERY_LINES: &str = "delivery_lines";
    pub const VEHICLES: &str = "vehicles";
    pub const DELIVERY_ROUTES: &str = "delivery_routes";
}

/// Finance domain tables
pub mod finance {
    pub const INVOICES: &str = "invoices";
    pub const INVOICE_LINES: &str = "invoice_lines";
    pub const PAYMENTS: &str = "payments";
    pub const COST_ENTRIES: &str = "cost_entries";
}

/// Entity status values
pub mod status {
    // Generic statuses
    pub const DRAFT: &str = "DRAFT";
    pub const ACTIVE: &str = "ACTIVE";
    pub const INACTIVE: &str = "INACTIVE";
    pub const DELETED: &str = "DELETED";

    // Lot statuses
    pub const AVAILABLE: &str = "AVAILABLE";
    pub const RESERVED: &str = "RESERVED";
    pub const CONSUMED: &str = "CONSUMED";
    pub const EXPIRED: &str = "EXPIRED";
    pub const BLOCKED: &str = "BLOCKED";

    // Order statuses
    pub const PENDING: &str = "PENDING";
    pub const CONFIRMED: &str = "CONFIRMED";
    pub const IN_PROGRESS: &str = "IN_PROGRESS";
    pub const COMPLETED: &str = "COMPLETED";
    pub const CANCELLED: &str = "CANCELLED";

    // Delivery statuses
    pub const PREPARED: &str = "PREPARED";
    pub const LOADED: &str = "LOADED";
    pub const IN_TRANSIT: &str = "IN_TRANSIT";
    pub const DELIVERED: &str = "DELIVERED";
    pub const RETURNED: &str = "RETURNED";

    // Payment statuses
    pub const UNPAID: &str = "UNPAID";
    pub const PARTIAL: &str = "PARTIAL";
    pub const PAID: &str = "PAID";
}

/// Stock movement types
pub mod movement_types {
    // Entries
    pub const RECEPTION: &str = "RECEPTION";
    pub const PRODUCTION_OUTPUT: &str = "PRODUCTION_OUTPUT";
    pub const RETURN_FROM_CLIENT: &str = "RETURN_FROM_CLIENT";
    pub const ADJUSTMENT_PLUS: &str = "ADJUSTMENT_PLUS";
    pub const TRANSFER_IN: &str = "TRANSFER_IN";

    // Exits
    pub const PRODUCTION_CONSUMPTION: &str = "PRODUCTION_CONSUMPTION";
    pub const DELIVERY: &str = "DELIVERY";
    pub const LOSS: &str = "LOSS";
    pub const ADJUSTMENT_MINUS: &str = "ADJUSTMENT_MINUS";
    pub const TRANSFER_OUT: &str = "TRANSFER_OUT";
    pub const EXPIRY: &str = "EXPIRY";
}
