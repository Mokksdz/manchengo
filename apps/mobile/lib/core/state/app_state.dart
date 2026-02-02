import 'package:flutter/foundation.dart';
import '../models/models.dart';
import '../data/app_repository.dart';
import '../data/sqlite/sqlite_repository.dart';
import '../services/services.dart';
import '../sync/sync.dart' as sync;

/// Global application state.
/// 
/// Uses SQLite for local persistence via SqliteRepository.
/// Business logic is handled via service classes.
/// 
/// Flow: UI → AppState → Service → Repository → SQLite
class AppState extends ChangeNotifier {
  final AppRepository _repository;
  bool _isInitialized = false;
  
  // Services for business logic
  final ReceptionService _receptionService = ReceptionService();
  final StockService _stockService = StockService();
  final SalesService _salesService = SalesService();
  
  User? _currentUser;
  SyncStatus _syncStatus = SyncStatus.synced;
  DateTime? _lastSync;
  List<SyncQueueItem> _syncQueue = [];
  
  // Data collections loaded from SQLite
  List<Supplier> _suppliers = [];
  List<Client> _clients = [];
  List<Product> _productsMp = [];
  List<Product> _productsPf = [];
  List<Lot> _lotsMp = [];
  List<Lot> _lotsPf = [];
  List<ProductionOrder> _productionOrders = [];
  List<Invoice> _invoices = [];
  List<ActivityItem> _recentActivity = [];

  /// Create AppState with SQLite repository
  AppState() : _repository = SqliteRepository();
  
  /// Create AppState with custom repository (for testing)
  AppState.withRepository(this._repository);
  
  /// Check if data has been loaded
  bool get isInitialized => _isInitialized;
  
  // ────────────────────────────────────────────────────────────────────────────
  // DATABASE OPERATIONS
  // ────────────────────────────────────────────────────────────────────────────
  
  /// Initialize and load all data from SQLite
  Future<void> loadFromDatabase() async {
    try {
      // Initialize database
      if (_repository is SqliteRepository) {
        await (_repository as SqliteRepository).initialize();
      }
      
      // Load user
      _currentUser = await _repository.getCurrentUser();
      
      // Load master data
      _suppliers = await _repository.getSuppliers();
      _clients = await _repository.getClients();
      _productsMp = await _repository.getProductsMp();
      _productsPf = await _repository.getProductsPf();
      
      // Load lots
      _lotsMp = await _repository.getLotsMp();
      _lotsPf = await _repository.getLotsPf();
      
      // Load transactional data
      _productionOrders = await _repository.getProductionOrders();
      _invoices = await _repository.getInvoices();
      
      // Load sync queue
      _syncQueue = await _repository.getPendingSyncItems();
      
      // TODO: Load recent activity from a dedicated table
      _recentActivity = [];
      
      _lastSync = DateTime.now();
      _isInitialized = true;
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading from database: $e');
      rethrow;
    }
  }
  
  /// Refresh data from database
  Future<void> refreshData() async {
    await loadFromDatabase();
  }

  // Getters
  User? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;
  SyncStatus get syncStatus => _syncStatus;
  DateTime? get lastSync => _lastSync;
  List<SyncQueueItem> get syncQueue => _syncQueue;
  List<SyncQueueItem> get pendingSyncItems => 
      _syncQueue.where((i) => !i.hasError).toList();
  List<SyncQueueItem> get errorSyncItems => 
      _syncQueue.where((i) => i.hasError).toList();

  List<Supplier> get suppliers => _suppliers;
  List<Client> get clients => _clients;
  List<Product> get productsMp => _productsMp;
  List<Product> get productsPf => _productsPf;
  List<Lot> get lotsMp => _lotsMp;
  List<Lot> get lotsPf => _lotsPf;
  List<ProductionOrder> get productionOrders => _productionOrders;
  List<Invoice> get invoices => _invoices;
  List<ActivityItem> get recentActivity => _recentActivity;

  // Stats for dashboard (calculated from real data)
  int get todayReceptions => 0; // TODO: Query from stock_movements
  int get todayProductions => _productionOrders.where((o) => 
      o.date.day == DateTime.now().day).length;
  int get todaySales => _invoices.where((i) => 
      i.date.day == DateTime.now().day).length;
  int get todayInvoicesAmount => _invoices
      .where((i) => i.date.day == DateTime.now().day)
      .fold(0, (sum, i) => sum + i.totalTtc);

  // Auth methods
  void login(User user) {
    _currentUser = user;
    notifyListeners();
  }

  void logout() {
    _currentUser = null;
    notifyListeners();
  }

  // Sync methods
  void setSyncStatus(SyncStatus status) {
    _syncStatus = status;
    if (status == SyncStatus.synced) {
      _lastSync = DateTime.now();
    }
    notifyListeners();
  }

  /// Push local sync events to server
  /// 
  /// Triggered manually from sync screen or automatically on app resume.
  /// Safe to call multiple times (idempotent).
  Future<sync.SyncResult> pushSync() async {
    setSyncStatus(SyncStatus.syncing);
    
    try {
      final result = await sync.SyncService().pushSync();
      
      // Update status based on result
      switch (result.status) {
        case sync.SyncStatus.success:
          setSyncStatus(SyncStatus.synced);
          break;
        case sync.SyncStatus.partialSuccess:
          setSyncStatus(SyncStatus.pending);
          break;
        case sync.SyncStatus.offline:
          setSyncStatus(SyncStatus.offline);
          break;
        case sync.SyncStatus.error:
          setSyncStatus(SyncStatus.error);
          break;
        default:
          setSyncStatus(SyncStatus.pending);
      }
      
      debugPrint('Push sync: ${result.status} - ${result.syncedCount} synced, ${result.pendingCount} pending');
      return result;
    } catch (e) {
      debugPrint('Push sync error: $e');
      setSyncStatus(SyncStatus.error);
      return sync.SyncResult(
        status: sync.SyncStatus.error,
        errorMessage: e.toString(),
      );
    }
  }

  /// Get count of pending sync events
  Future<int> getPendingSyncCount() async {
    return await sync.SyncService().getPendingCount();
  }

  /// Pull remote events and apply locally
  /// 
  /// Fetches events from server since last sync.
  /// Applies them to local SQLite with conflict resolution.
  Future<sync.SyncResult> pullSync() async {
    setSyncStatus(SyncStatus.syncing);
    
    try {
      final result = await sync.SyncService().pullSync();
      
      switch (result.status) {
        case sync.SyncStatus.success:
          setSyncStatus(SyncStatus.synced);
          // Refresh local data after pull
          await refreshData();
          break;
        case sync.SyncStatus.offline:
          setSyncStatus(SyncStatus.offline);
          break;
        case sync.SyncStatus.error:
          setSyncStatus(SyncStatus.error);
          break;
        default:
          setSyncStatus(SyncStatus.pending);
      }
      
      debugPrint('Pull sync: ${result.status} - ${result.syncedCount} applied');
      return result;
    } catch (e) {
      debugPrint('Pull sync error: $e');
      setSyncStatus(SyncStatus.error);
      return sync.SyncResult(
        status: sync.SyncStatus.error,
        errorMessage: e.toString(),
      );
    }
  }

  /// Full bidirectional sync: push then pull
  /// 
  /// Ensures local changes are sent before receiving remote changes.
  /// Refreshes local data after successful sync.
  Future<sync.SyncResult> syncAll() async {
    setSyncStatus(SyncStatus.syncing);
    
    try {
      final result = await sync.SyncService().syncAll();
      
      switch (result.status) {
        case sync.SyncStatus.success:
          setSyncStatus(SyncStatus.synced);
          await refreshData();
          break;
        case sync.SyncStatus.partialSuccess:
          setSyncStatus(SyncStatus.pending);
          await refreshData();
          break;
        case sync.SyncStatus.offline:
          setSyncStatus(SyncStatus.offline);
          break;
        case sync.SyncStatus.error:
          setSyncStatus(SyncStatus.error);
          break;
        default:
          setSyncStatus(SyncStatus.pending);
      }
      
      debugPrint('Full sync: ${result.status} - ${result.syncedCount} total');
      return result;
    } catch (e) {
      debugPrint('Full sync error: $e');
      setSyncStatus(SyncStatus.error);
      return sync.SyncResult(
        status: sync.SyncStatus.error,
        errorMessage: e.toString(),
      );
    }
  }

  /// Get last successful sync time
  Future<DateTime?> getLastSyncTime() async {
    return await sync.SyncService().getLastSyncTime();
  }

  /// Legacy forceSync - now calls syncAll
  Future<void> forceSync() async {
    await syncAll();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // BUSINESS OPERATIONS (A2)
  // ────────────────────────────────────────────────────────────────────────────

  /// Receive MP from supplier
  /// 
  /// Creates a new lot and records the stock movement.
  /// Requires role: ADMIN or APPRO
  /// 
  /// Throws: [UnauthorizedRoleError], [InvalidQuantityError], [EntityNotFoundError]
  Future<Lot> receiveMp({
    required String supplierId,
    required String productMpId,
    required int quantity,
  }) async {
    // Check role authorization
    final role = _currentUser?.role;
    if (role != UserRole.admin && role != UserRole.appro) {
      throw UnauthorizedRoleError(
        role: role?.label ?? 'NONE',
        operation: 'Reception MP',
      );
    }

    // Get user ID
    final userId = int.tryParse(_currentUser?.id ?? '0') ?? 1;

    // Execute business logic
    final lot = await _receptionService.receiveMp(
      supplierId: int.parse(supplierId),
      productMpId: int.parse(productMpId),
      quantity: quantity,
      userId: userId,
    );

    // Refresh stock data
    await _refreshStock();

    // Add to recent activity
    _addActivity(
      type: 'Réception',
      reference: lot.lotNumber,
    );

    notifyListeners();
    return lot;
  }

  /// Load current stock levels
  /// 
  /// Reloads all products and lots with current quantities.
  Future<void> loadCurrentStock() async {
    _productsMp = await _stockService.loadProductsMp();
    _productsPf = await _stockService.loadProductsPf();
    _lotsMp = await _stockService.loadLotsMp();
    _lotsPf = await _stockService.loadLotsPf();
    notifyListeners();
  }

  /// Create a sale with FIFO stock consumption
  /// 
  /// Consumes stock from oldest lots first.
  /// Requires role: ADMIN or COMMERCIAL
  /// 
  /// Throws: [UnauthorizedRoleError], [StockInsufficientError], [InvalidQuantityError]
  Future<Invoice> createSale({
    required String clientId,
    required List<SaleLineInput> lines,
    required PaymentMethod paymentMethod,
  }) async {
    // Check role authorization
    final role = _currentUser?.role;
    if (role != UserRole.admin && role != UserRole.commercial) {
      throw UnauthorizedRoleError(
        role: role?.label ?? 'NONE',
        operation: 'Vente PF',
      );
    }

    // Get user ID
    final userId = int.tryParse(_currentUser?.id ?? '0') ?? 1;

    // Execute business logic with FIFO
    final invoice = await _salesService.createSale(
      clientId: int.parse(clientId),
      lines: lines,
      paymentMethod: paymentMethod,
      userId: userId,
    );

    // Add invoice to list
    _invoices.insert(0, invoice);

    // Refresh stock data (quantities changed)
    await _refreshStock();

    // Add to recent activity
    _addActivity(
      type: 'Vente',
      reference: invoice.reference,
    );

    notifyListeners();
    return invoice;
  }

  /// Check if sufficient stock exists for a PF product
  Future<bool> hasSufficientStockPf(String productId, int quantity) async {
    return await _stockService.hasSufficientStockPf(
      int.parse(productId),
      quantity,
    );
  }

  /// Get available stock for a PF product
  Future<int> getAvailableStockPf(String productId) async {
    return await _stockService.getAvailableStockPf(int.parse(productId));
  }

  // ────────────────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ────────────────────────────────────────────────────────────────────────────

  /// Refresh stock data after mutations
  Future<void> _refreshStock() async {
    _productsMp = await _stockService.loadProductsMp();
    _productsPf = await _stockService.loadProductsPf();
    _lotsMp = await _stockService.loadLotsMp();
    _lotsPf = await _stockService.loadLotsPf();
  }

  /// Add item to recent activity
  void _addActivity({
    required String type,
    required String reference,
    bool isCompleted = true,
  }) {
    _recentActivity.insert(0, ActivityItem(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      type: type,
      reference: reference,
      timestamp: DateTime.now(),
      userName: _currentUser?.firstName ?? 'Système',
      isCompleted: isCompleted,
    ));

    // Keep only last 20 activities
    if (_recentActivity.length > 20) {
      _recentActivity = _recentActivity.take(20).toList();
    }
  }
}
