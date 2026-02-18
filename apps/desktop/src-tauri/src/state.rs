//! Application State Management
//!
//! Enhanced AppState with all services and repositories.
//! This is the central state container passed to all Tauri commands.

use manchengo_core::EntityId;
use manchengo_database::Database;
use manchengo_sync::{EventStore, SyncQueue};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

use crate::core::{AppConfig, BackgroundScheduler, SessionManager};
use crate::repositories::{
    ClientRepository, InvoiceRepository, LotRepository, MovementRepository,
    ProductRepository, ProductionRepository, PurchaseOrderRepository, RecipeRepository,
    SupplierRepository,
};
use crate::services::{
    ApproService, CommercialService, InvoiceService, ProductionService,
    StockService, SyncService,
};

/// Global application state
///
/// Contains all services, repositories, and infrastructure components.
/// Passed to every Tauri command via State<AppState>.
pub struct AppState {
    // =========================================================================
    // INFRASTRUCTURE
    // =========================================================================

    /// Main database connection
    pub db: Arc<Database>,

    /// Event store for event sourcing
    pub event_store: Arc<EventStore>,

    /// Sync queue for pending sync operations
    pub sync_queue: Arc<SyncQueue>,

    // =========================================================================
    // SECURITY
    // =========================================================================

    /// Session manager for authentication
    pub session: Arc<SessionManager>,

    /// Unique device identifier
    pub device_id: EntityId,

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    /// Application configuration
    pub config: Arc<RwLock<AppConfig>>,

    // =========================================================================
    // SERVICES
    // =========================================================================

    /// Stock service (FIFO, receptions, adjustments)
    pub stock_service: Arc<StockService>,

    /// Sync service (push/pull)
    pub sync_service: Arc<SyncService>,

    /// Production service (recipes, orders, workflow)
    pub production_service: Arc<ProductionService>,

    /// Appro service (purchase orders, procurement)
    pub appro_service: Arc<ApproService>,

    /// Commercial service (clients, pricing)
    pub commercial_service: Arc<CommercialService>,

    /// Invoice service (invoices, payments, fiscal)
    pub invoice_service: Arc<InvoiceService>,

    // =========================================================================
    // REPOSITORIES
    // =========================================================================

    /// Product repository (MP & PF)
    pub product_repo: Arc<ProductRepository>,

    /// Lot repository (MP & PF)
    pub lot_repo: Arc<LotRepository>,

    /// Movement repository
    pub movement_repo: Arc<MovementRepository>,

    /// Supplier repository
    pub supplier_repo: Arc<SupplierRepository>,

    /// Recipe repository
    pub recipe_repo: Arc<RecipeRepository>,

    /// Production order repository
    pub production_repo: Arc<ProductionRepository>,

    /// Purchase order repository
    pub po_repo: Arc<PurchaseOrderRepository>,

    /// Client repository
    pub client_repo: Arc<ClientRepository>,

    /// Invoice repository
    pub invoice_repo: Arc<InvoiceRepository>,

    // =========================================================================
    // RUNTIME
    // =========================================================================

    /// Background task scheduler
    pub scheduler: Arc<BackgroundScheduler>,

    /// Online status flag
    pub is_online: Arc<AtomicBool>,
}

impl AppState {
    /// Create new AppState with all services initialized
    pub fn new(db: Database, config: AppConfig) -> Result<Self, String> {
        info!("Initializing AppState...");

        // Wrap database in Arc for sharing
        let db = Arc::new(db);

        let db_path = config.database_path.to_string_lossy().to_string();

        // Create event store and sync queue with dedicated connections
        let event_store = Arc::new(EventStore::new(
            Database::open(manchengo_database::DatabaseConfig {
                path: db_path.clone(),
                ..Default::default()
            }).map_err(|e| format!("Failed to open event store database: {}", e))?
        ));

        let sync_queue = Arc::new(SyncQueue::new(
            Database::open(manchengo_database::DatabaseConfig {
                path: db_path,
                ..Default::default()
            }).map_err(|e| format!("Failed to open sync queue database: {}", e))?
        ));

        // Generate or load device ID
        let device_id = Self::load_or_create_device_id(&config);

        // Configuration wrapped in RwLock
        let config = Arc::new(RwLock::new(config));

        // =====================================================================
        // INITIALIZE REPOSITORIES
        // =====================================================================

        let product_repo = Arc::new(ProductRepository::new(db.clone()));
        let lot_repo = Arc::new(LotRepository::new(db.clone()));
        let movement_repo = Arc::new(MovementRepository::new(db.clone()));
        let supplier_repo = Arc::new(SupplierRepository::new(db.clone()));
        let recipe_repo = Arc::new(RecipeRepository::new(db.clone()));
        let production_repo = Arc::new(ProductionRepository::new(db.clone()));
        let po_repo = Arc::new(PurchaseOrderRepository::new(db.clone()));
        let client_repo = Arc::new(ClientRepository::new(db.clone()));
        let invoice_repo = Arc::new(InvoiceRepository::new(db.clone()));

        // Initialize session manager
        let session = Arc::new(SessionManager::new(device_id));

        // =====================================================================
        // INITIALIZE SERVICES
        // =====================================================================

        let stock_service = Arc::new(StockService::new(
            db.clone(),
            event_store.clone(),
            product_repo.clone(),
            lot_repo.clone(),
            movement_repo.clone(),
            supplier_repo.clone(),
        ));

        let sync_service = Arc::new(SyncService::new(
            db.clone(),
            event_store.clone(),
            sync_queue.clone(),
            config.clone(),
            device_id,
        ));

        let production_service = Arc::new(ProductionService::new(
            db.clone(),
            event_store.clone(),
            recipe_repo.clone(),
            production_repo.clone(),
            product_repo.clone(),
            lot_repo.clone(),
            stock_service.clone(),
        ));

        let appro_service = Arc::new(ApproService::new(
            db.clone(),
            event_store.clone(),
            po_repo.clone(),
            supplier_repo.clone(),
            stock_service.clone(),
        ));

        let commercial_service = Arc::new(CommercialService::new(
            db.clone(),
            event_store.clone(),
            client_repo.clone(),
        ));

        let invoice_service = Arc::new(InvoiceService::new(
            db.clone(),
            event_store.clone(),
            invoice_repo.clone(),
            client_repo.clone(),
        ));

        // Initialize scheduler
        let scheduler = Arc::new(BackgroundScheduler::new());

        info!("AppState initialized with device_id: {}", device_id);

        Ok(Self {
            db,
            event_store,
            sync_queue,
            session,
            device_id,
            config,
            // Services
            stock_service,
            sync_service,
            production_service,
            appro_service,
            commercial_service,
            invoice_service,
            // Repositories
            product_repo,
            lot_repo,
            movement_repo,
            supplier_repo,
            recipe_repo,
            production_repo,
            po_repo,
            client_repo,
            invoice_repo,
            // Runtime
            scheduler,
            is_online: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Load existing device ID or create new one
    fn load_or_create_device_id(config: &AppConfig) -> EntityId {
        let device_id_path = AppConfig::data_dir().join("device_id");

        if device_id_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&device_id_path) {
                if let Ok(id) = content.trim().parse::<EntityId>() {
                    info!("Loaded existing device ID");
                    return id;
                }
            }
        }

        // Create new device ID
        let id = EntityId::new();
        if let Err(e) = std::fs::write(&device_id_path, id.to_string()) {
            error!("Failed to save device ID: {}", e);
        } else {
            info!("Created new device ID");
        }

        id
    }
}
