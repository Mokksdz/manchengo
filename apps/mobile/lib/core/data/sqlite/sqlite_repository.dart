import '../app_repository.dart';
import '../../models/models.dart';
import 'database.dart';
import 'repositories/repositories.dart';

/// SQLite implementation of AppRepository
class SqliteRepository implements AppRepository {
  final UserRepository _userRepo = UserRepository();
  final ProductMpRepository _productMpRepo = ProductMpRepository();
  final ProductPfRepository _productPfRepo = ProductPfRepository();
  final LotMpRepository _lotMpRepo = LotMpRepository();
  final LotPfRepository _lotPfRepo = LotPfRepository();
  final ClientRepository _clientRepo = ClientRepository();
  final SupplierRepository _supplierRepo = SupplierRepository();
  final InvoiceRepository _invoiceRepo = InvoiceRepository();
  final ProductionOrderRepository _productionOrderRepo = ProductionOrderRepository();
  final SyncQueueRepository _syncQueueRepo = SyncQueueRepository();

  /// Initialize database
  Future<void> initialize() async {
    await AppDatabase.instance.database;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AUTH
  // ──────────────────────────────────────────────────────────────────────────
  
  @override
  Future<User?> authenticate(String email, String password) async {
    // TODO: Implement real authentication with password hash
    final entity = await _userRepo.getByEmail(email);
    if (entity == null || !entity.isActive) return null;
    return _mapUserEntityToModel(entity);
  }
  
  @override
  Future<User?> getCurrentUser() async {
    final entity = await _userRepo.getFirstActiveUser();
    if (entity == null) return null;
    return _mapUserEntityToModel(entity);
  }
  
  @override
  Future<void> saveUserSession(User user) async {
    // TODO: Implement session persistence
  }
  
  @override
  Future<void> clearUserSession() async {
    // TODO: Implement session clearing
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SUPPLIERS
  // ──────────────────────────────────────────────────────────────────────────
  
  @override
  Future<List<Supplier>> getSuppliers() async {
    final entities = await _supplierRepo.getAll();
    return entities.map(_mapSupplierEntityToModel).toList();
  }
  
  @override
  Future<Supplier?> getSupplierById(String id) async {
    final entity = await _supplierRepo.getById(int.parse(id));
    if (entity == null) return null;
    return _mapSupplierEntityToModel(entity);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CLIENTS
  // ──────────────────────────────────────────────────────────────────────────
  
  @override
  Future<List<Client>> getClients() async {
    final entities = await _clientRepo.getAll();
    return entities.map(_mapClientEntityToModel).toList();
  }
  
  @override
  Future<Client?> getClientById(String id) async {
    final entity = await _clientRepo.getById(int.parse(id));
    if (entity == null) return null;
    return _mapClientEntityToModel(entity);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRODUCTS
  // ──────────────────────────────────────────────────────────────────────────
  
  @override
  Future<List<Product>> getProductsMp() async {
    final entities = await _productMpRepo.getAll();
    final products = <Product>[];
    for (final e in entities) {
      final stock = await _lotMpRepo.getTotalStockByProductId(e.id!);
      products.add(_mapProductMpEntityToModel(e, stock));
    }
    return products;
  }
  
  @override
  Future<List<Product>> getProductsPf() async {
    final entities = await _productPfRepo.getAll();
    final products = <Product>[];
    for (final e in entities) {
      final stock = await _lotPfRepo.getTotalStockByProductId(e.id!);
      products.add(_mapProductPfEntityToModel(e, stock));
    }
    return products;
  }
  
  @override
  Future<Product?> getProductById(String id) async {
    // Try PF first, then MP
    var entityPf = await _productPfRepo.getById(int.parse(id));
    if (entityPf != null) {
      final stock = await _lotPfRepo.getTotalStockByProductId(entityPf.id!);
      return _mapProductPfEntityToModel(entityPf, stock);
    }
    var entityMp = await _productMpRepo.getById(int.parse(id));
    if (entityMp != null) {
      final stock = await _lotMpRepo.getTotalStockByProductId(entityMp.id!);
      return _mapProductMpEntityToModel(entityMp, stock);
    }
    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LOTS
  // ──────────────────────────────────────────────────────────────────────────
  
  @override
  Future<List<Lot>> getLotsMp({String? productId}) async {
    final entities = productId != null
        ? await _lotMpRepo.getByProductIdFifo(int.parse(productId))
        : await _lotMpRepo.getAvailableLots();
    return entities.map(_mapLotMpEntityToModel).toList();
  }
  
  @override
  Future<List<Lot>> getLotsPf({String? productId}) async {
    final entities = productId != null
        ? await _lotPfRepo.getByProductIdFifo(int.parse(productId))
        : await _lotPfRepo.getAvailableLots();
    return entities.map(_mapLotPfEntityToModel).toList();
  }
  
  @override
  Future<Lot> createLot(Lot lot) async {
    // TODO: Determine MP vs PF and insert accordingly
    throw UnimplementedError('createLot not implemented');
  }
  
  @override
  Future<void> updateLotQuantity(String lotId, int newQuantity) async {
    // TODO: Determine MP vs PF and update accordingly
    throw UnimplementedError('updateLotQuantity not implemented');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RECEPTION
  // ──────────────────────────────────────────────────────────────────────────
  
  @override
  Future<ReceptionNote> createReception(ReceptionNote reception) async {
    // TODO: Implement reception creation with lot creation
    throw UnimplementedError('createReception not implemented');
  }
  
  @override
  Future<ReceptionNote?> getReceptionById(String id) async {
    // TODO: Implement
    throw UnimplementedError('getReceptionById not implemented');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRODUCTION
  // ──────────────────────────────────────────────────────────────────────────
  
  @override
  Future<List<ProductionOrder>> getProductionOrders({ProductionStatus? status}) async {
    List<ProductionOrderEntity> entities;
    if (status != null) {
      entities = await _productionOrderRepo.getByStatus(_mapProductionStatusToDb(status));
    } else {
      entities = await _productionOrderRepo.getAll();
    }
    
    final orders = <ProductionOrder>[];
    for (final e in entities) {
      final product = await _productPfRepo.getById(e.productId);
      final consumptionEntities = await _productionOrderRepo.getConsumptions(e.id!);
      final consumptions = await _mapConsumptionsToModel(consumptionEntities);
      orders.add(_mapProductionOrderEntityToModel(e, product?.name ?? '', consumptions));
    }
    return orders;
  }
  
  @override
  Future<ProductionOrder?> getProductionOrderById(String id) async {
    final entity = await _productionOrderRepo.getById(int.parse(id));
    if (entity == null) return null;
    final product = await _productPfRepo.getById(entity.productId);
    final consumptionEntities = await _productionOrderRepo.getConsumptions(entity.id!);
    final consumptions = await _mapConsumptionsToModel(consumptionEntities);
    return _mapProductionOrderEntityToModel(entity, product?.name ?? '', consumptions);
  }
  
  @override
  Future<ProductionOrder> createProductionOrder(ProductionOrder order) async {
    // TODO: Implement
    throw UnimplementedError('createProductionOrder not implemented');
  }
  
  @override
  Future<void> recordConsumption(String orderId, List<MpConsumption> consumptions) async {
    // TODO: Implement
    throw UnimplementedError('recordConsumption not implemented');
  }
  
  @override
  Future<void> completeProduction(String orderId, int producedQuantity) async {
    await _productionOrderRepo.updateStatus(
      int.parse(orderId), 
      'COMPLETED', 
      producedQuantity: producedQuantity,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SALES & INVOICES
  // ──────────────────────────────────────────────────────────────────────────
  
  @override
  Future<SalesOrder> createSalesOrder(SalesOrder order) async {
    // TODO: Implement
    throw UnimplementedError('createSalesOrder not implemented');
  }
  
  @override
  Future<List<Invoice>> getInvoices({InvoiceStatus? status}) async {
    List<InvoiceEntity> entities;
    if (status != null) {
      entities = await _invoiceRepo.getByStatus(_mapInvoiceStatusToDb(status));
    } else {
      entities = await _invoiceRepo.getRecent();
    }
    
    final invoices = <Invoice>[];
    for (final e in entities) {
      final client = await _clientRepo.getById(e.clientId);
      final lineEntities = await _invoiceRepo.getLines(e.id!);
      final lines = await _mapInvoiceLinesToModel(lineEntities);
      invoices.add(_mapInvoiceEntityToModel(e, client, lines));
    }
    return invoices;
  }
  
  @override
  Future<Invoice?> getInvoiceById(String id) async {
    final entity = await _invoiceRepo.getById(int.parse(id));
    if (entity == null) return null;
    final client = await _clientRepo.getById(entity.clientId);
    final lineEntities = await _invoiceRepo.getLines(entity.id!);
    final lines = await _mapInvoiceLinesToModel(lineEntities);
    return _mapInvoiceEntityToModel(entity, client, lines);
  }
  
  @override
  Future<Invoice> createInvoice(Invoice invoice) async {
    // TODO: Implement
    throw UnimplementedError('createInvoice not implemented');
  }
  
  @override
  Future<void> recordPayment(String invoiceId, int amount) async {
    // TODO: Implement payment recording and status update
    throw UnimplementedError('recordPayment not implemented');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SYNC
  // ──────────────────────────────────────────────────────────────────────────
  
  @override
  Future<List<SyncQueueItem>> getPendingSyncItems() async {
    final pending = await _syncQueueRepo.getPending();
    final errors = await _syncQueueRepo.getErrors();
    return [...pending, ...errors].map(_mapSyncQueueEntityToModel).toList();
  }
  
  @override
  Future<void> addToSyncQueue(SyncQueueItem item) async {
    await _syncQueueRepo.insert(SyncQueueEntity(
      entityType: item.type,
      entityId: int.parse(item.id),
      action: 'CREATE',
    ));
  }
  
  @override
  Future<void> markSynced(String itemId) async {
    await _syncQueueRepo.markSynced(int.parse(itemId));
  }
  
  @override
  Future<void> markSyncFailed(String itemId, String error) async {
    await _syncQueueRepo.markError(int.parse(itemId), error);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MAPPERS
  // ──────────────────────────────────────────────────────────────────────────
  
  User _mapUserEntityToModel(UserEntity e) {
    return User(
      id: e.id.toString(),
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      role: _mapRoleFromDb(e.role),
      isActive: e.isActive,
    );
  }
  
  UserRole _mapRoleFromDb(String role) {
    switch (role) {
      case 'admin': return UserRole.admin;
      case 'appro': return UserRole.appro;
      case 'production': return UserRole.production;
      case 'commercial': return UserRole.commercial;
      case 'comptable': return UserRole.comptable;
      default: return UserRole.admin;
    }
  }
  
  Supplier _mapSupplierEntityToModel(SupplierEntity e) {
    return Supplier(
      id: e.id.toString(),
      code: e.code,
      name: e.name,
      phone: e.phone,
      nif: e.nif,
    );
  }
  
  Client _mapClientEntityToModel(ClientEntity e) {
    return Client(
      id: e.id.toString(),
      code: e.code,
      name: e.name,
      type: e.type,
      phone: e.phone,
      nif: e.nif,
    );
  }
  
  Product _mapProductMpEntityToModel(ProductMpEntity e, int stock) {
    return Product(
      id: e.id.toString(),
      code: e.code,
      name: e.name,
      unit: e.unit,
      isMp: true,
      currentStock: stock,
      minStock: e.minStock,
    );
  }
  
  Product _mapProductPfEntityToModel(ProductPfEntity e, int stock) {
    return Product(
      id: e.id.toString(),
      code: e.code,
      name: e.name,
      unit: e.unit,
      isMp: false,
      currentStock: stock,
      minStock: e.minStock,
      priceHt: e.priceHt,
    );
  }
  
  Lot _mapLotMpEntityToModel(LotMpEntity e) {
    return Lot(
      id: e.id.toString(),
      productId: e.productId.toString(),
      lotNumber: e.lotNumber,
      quantity: e.quantity,
      productionDate: e.productionDate,
      expiryDate: e.expiryDate,
    );
  }
  
  Lot _mapLotPfEntityToModel(LotPfEntity e) {
    return Lot(
      id: e.id.toString(),
      productId: e.productId.toString(),
      lotNumber: e.lotNumber,
      quantity: e.quantity,
      productionDate: e.productionDate,
      expiryDate: e.expiryDate,
    );
  }
  
  ProductionOrder _mapProductionOrderEntityToModel(
    ProductionOrderEntity e, 
    String productName,
    List<MpConsumption> consumptions,
  ) {
    return ProductionOrder(
      id: e.id.toString(),
      reference: e.reference,
      productId: e.productId.toString(),
      productName: productName,
      plannedQuantity: e.plannedQuantity,
      producedQuantity: e.producedQuantity,
      status: _mapProductionStatusFromDb(e.status),
      date: e.date,
      consumptions: consumptions,
    );
  }
  
  ProductionStatus _mapProductionStatusFromDb(String status) {
    switch (status) {
      case 'PLANNED': return ProductionStatus.planned;
      case 'IN_PROGRESS': return ProductionStatus.inProgress;
      case 'COMPLETED': return ProductionStatus.completed;
      default: return ProductionStatus.planned;
    }
  }
  
  String _mapProductionStatusToDb(ProductionStatus status) {
    switch (status) {
      case ProductionStatus.planned: return 'PLANNED';
      case ProductionStatus.inProgress: return 'IN_PROGRESS';
      case ProductionStatus.completed: return 'COMPLETED';
    }
  }
  
  Future<List<MpConsumption>> _mapConsumptionsToModel(
    List<ProductionConsumptionEntity> entities,
  ) async {
    final consumptions = <MpConsumption>[];
    for (final e in entities) {
      final lot = await _lotMpRepo.getById(e.lotMpId);
      if (lot != null) {
        final product = await _productMpRepo.getById(lot.productId);
        consumptions.add(MpConsumption(
          lotId: e.lotMpId.toString(),
          lotNumber: lot.lotNumber,
          productName: product?.name ?? '',
          quantity: e.quantity,
          unit: product?.unit ?? '',
        ));
      }
    }
    return consumptions;
  }
  
  Invoice _mapInvoiceEntityToModel(
    InvoiceEntity e, 
    ClientEntity? client,
    List<SalesLine> lines,
  ) {
    return Invoice(
      id: e.id.toString(),
      reference: e.reference,
      clientId: e.clientId.toString(),
      clientName: client?.name ?? '',
      clientNif: client?.nif,
      date: e.date,
      lines: lines,
      totalHt: e.totalHt,
      totalTva: e.totalTva,
      totalTtc: e.totalTtc,
      paymentMethod: _mapPaymentMethodFromDb(e.paymentMethod),
      timbreFiscal: e.timbreFiscal,
      netToPay: e.netToPay,
      status: _mapInvoiceStatusFromDb(e.status),
    );
  }
  
  PaymentMethod _mapPaymentMethodFromDb(String method) {
    switch (method) {
      case 'ESPECES': return PaymentMethod.especes;
      case 'CHEQUE': return PaymentMethod.cheque;
      case 'VIREMENT': return PaymentMethod.virement;
      default: return PaymentMethod.especes;
    }
  }
  
  InvoiceStatus _mapInvoiceStatusFromDb(String status) {
    switch (status) {
      case 'UNPAID': return InvoiceStatus.unpaid;
      case 'PARTIAL': return InvoiceStatus.partial;
      case 'PAID': return InvoiceStatus.paid;
      default: return InvoiceStatus.unpaid;
    }
  }
  
  String _mapInvoiceStatusToDb(InvoiceStatus status) {
    switch (status) {
      case InvoiceStatus.unpaid: return 'UNPAID';
      case InvoiceStatus.partial: return 'PARTIAL';
      case InvoiceStatus.paid: return 'PAID';
    }
  }
  
  Future<List<SalesLine>> _mapInvoiceLinesToModel(List<InvoiceLineEntity> entities) async {
    final lines = <SalesLine>[];
    for (final e in entities) {
      final product = await _productPfRepo.getById(e.productId);
      lines.add(SalesLine(
        productId: e.productId.toString(),
        productName: product?.name ?? '',
        quantity: e.quantity,
        unitPriceHt: e.unitPriceHt,
        lineHt: e.lineHt,
      ));
    }
    return lines;
  }
  
  SyncQueueItem _mapSyncQueueEntityToModel(SyncQueueEntity e) {
    return SyncQueueItem(
      id: e.id.toString(),
      type: e.entityType,
      reference: '${e.entityType}-${e.entityId}',
      createdAt: e.createdAt ?? DateTime.now(),
      hasError: e.status == 'ERROR',
      errorMessage: e.errorMessage,
    );
  }
}
