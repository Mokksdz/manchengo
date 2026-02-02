import '../models/models.dart';

/// Abstract repository interface for future SQLite/backend integration.
/// 
/// This interface defines the contract for data persistence.
/// Implementations will be created when SQLite is integrated.
/// 
/// Usage:
/// - Mock implementation for testing
/// - SQLite implementation for production
/// - Remote API implementation for sync
abstract class AppRepository {
  // ──────────────────────────────────────────────────────────────────────────
  // AUTH
  // ──────────────────────────────────────────────────────────────────────────
  
  /// TODO: Authenticate user with credentials
  Future<User?> authenticate(String email, String password);
  
  /// TODO: Get current logged-in user from local storage
  Future<User?> getCurrentUser();
  
  /// TODO: Persist user session
  Future<void> saveUserSession(User user);
  
  /// TODO: Clear user session on logout
  Future<void> clearUserSession();

  // ──────────────────────────────────────────────────────────────────────────
  // SUPPLIERS
  // ──────────────────────────────────────────────────────────────────────────
  
  /// TODO: Get all suppliers
  Future<List<Supplier>> getSuppliers();
  
  /// TODO: Get supplier by ID
  Future<Supplier?> getSupplierById(String id);

  // ──────────────────────────────────────────────────────────────────────────
  // CLIENTS
  // ──────────────────────────────────────────────────────────────────────────
  
  /// TODO: Get all clients
  Future<List<Client>> getClients();
  
  /// TODO: Get client by ID
  Future<Client?> getClientById(String id);

  // ──────────────────────────────────────────────────────────────────────────
  // PRODUCTS
  // ──────────────────────────────────────────────────────────────────────────
  
  /// TODO: Get all MP products
  Future<List<Product>> getProductsMp();
  
  /// TODO: Get all PF products
  Future<List<Product>> getProductsPf();
  
  /// TODO: Get product by ID
  Future<Product?> getProductById(String id);

  // ──────────────────────────────────────────────────────────────────────────
  // LOTS
  // ──────────────────────────────────────────────────────────────────────────
  
  /// TODO: Get MP lots (ordered by FIFO)
  Future<List<Lot>> getLotsMp({String? productId});
  
  /// TODO: Get PF lots (ordered by FIFO)
  Future<List<Lot>> getLotsPf({String? productId});
  
  /// TODO: Create new lot
  Future<Lot> createLot(Lot lot);
  
  /// TODO: Update lot quantity (after consumption/sale)
  Future<void> updateLotQuantity(String lotId, int newQuantity);

  // ──────────────────────────────────────────────────────────────────────────
  // RECEPTION
  // ──────────────────────────────────────────────────────────────────────────
  
  /// TODO: Create reception note
  Future<ReceptionNote> createReception(ReceptionNote reception);
  
  /// TODO: Get reception by ID
  Future<ReceptionNote?> getReceptionById(String id);

  // ──────────────────────────────────────────────────────────────────────────
  // PRODUCTION
  // ──────────────────────────────────────────────────────────────────────────
  
  /// TODO: Get production orders
  Future<List<ProductionOrder>> getProductionOrders({ProductionStatus? status});
  
  /// TODO: Get production order by ID
  Future<ProductionOrder?> getProductionOrderById(String id);
  
  /// TODO: Create production order
  Future<ProductionOrder> createProductionOrder(ProductionOrder order);
  
  /// TODO: Record MP consumption
  Future<void> recordConsumption(String orderId, List<MpConsumption> consumptions);
  
  /// TODO: Complete production order
  Future<void> completeProduction(String orderId, int producedQuantity);

  // ──────────────────────────────────────────────────────────────────────────
  // SALES & INVOICES
  // ──────────────────────────────────────────────────────────────────────────
  
  /// TODO: Create sales order
  Future<SalesOrder> createSalesOrder(SalesOrder order);
  
  /// TODO: Get invoices
  Future<List<Invoice>> getInvoices({InvoiceStatus? status});
  
  /// TODO: Get invoice by ID
  Future<Invoice?> getInvoiceById(String id);
  
  /// TODO: Create invoice from sales order
  Future<Invoice> createInvoice(Invoice invoice);
  
  /// TODO: Record payment
  Future<void> recordPayment(String invoiceId, int amount);

  // ──────────────────────────────────────────────────────────────────────────
  // SYNC
  // ──────────────────────────────────────────────────────────────────────────
  
  /// TODO: Get pending sync items
  Future<List<SyncQueueItem>> getPendingSyncItems();
  
  /// TODO: Add item to sync queue
  Future<void> addToSyncQueue(SyncQueueItem item);
  
  /// TODO: Mark sync item as completed
  Future<void> markSynced(String itemId);
  
  /// TODO: Mark sync item as failed
  Future<void> markSyncFailed(String itemId, String error);
}
