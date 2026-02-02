import '../tables/production_orders_table.dart';
import '../tables/production_consumptions_table.dart';
import 'base_repository.dart';

/// Production order data model for SQLite
class ProductionOrderEntity {
  final int? id;
  final String reference;
  final int productId;
  final int plannedQuantity;
  final int? producedQuantity;
  final String status;
  final DateTime date;
  final int userId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  ProductionOrderEntity({
    this.id,
    required this.reference,
    required this.productId,
    required this.plannedQuantity,
    this.producedQuantity,
    this.status = 'PLANNED',
    required this.date,
    required this.userId,
    this.createdAt,
    this.updatedAt,
  });
}

/// Production consumption data model
class ProductionConsumptionEntity {
  final int? id;
  final int productionOrderId;
  final int lotMpId;
  final int quantity;
  final DateTime? createdAt;

  ProductionConsumptionEntity({
    this.id,
    required this.productionOrderId,
    required this.lotMpId,
    required this.quantity,
    this.createdAt,
  });
}

/// Production order repository
class ProductionOrderRepository extends BaseRepository<ProductionOrderEntity> {
  ProductionOrderRepository() : super(ProductionOrdersTable.tableName);
  
  @override
  ProductionOrderEntity fromMap(Map<String, dynamic> map) {
    return ProductionOrderEntity(
      id: map[ProductionOrdersTable.colId] as int?,
      reference: map[ProductionOrdersTable.colReference] as String,
      productId: map[ProductionOrdersTable.colProductId] as int,
      plannedQuantity: map[ProductionOrdersTable.colPlannedQuantity] as int,
      producedQuantity: map[ProductionOrdersTable.colProducedQuantity] as int?,
      status: map[ProductionOrdersTable.colStatus] as String,
      date: DateTime.parse(map[ProductionOrdersTable.colDate] as String),
      userId: map[ProductionOrdersTable.colUserId] as int,
      createdAt: map[ProductionOrdersTable.colCreatedAt] != null 
          ? DateTime.parse(map[ProductionOrdersTable.colCreatedAt] as String) 
          : null,
      updatedAt: map[ProductionOrdersTable.colUpdatedAt] != null 
          ? DateTime.parse(map[ProductionOrdersTable.colUpdatedAt] as String) 
          : null,
    );
  }
  
  @override
  Map<String, dynamic> toMap(ProductionOrderEntity item) {
    return {
      ProductionOrdersTable.colReference: item.reference,
      ProductionOrdersTable.colProductId: item.productId,
      ProductionOrdersTable.colPlannedQuantity: item.plannedQuantity,
      ProductionOrdersTable.colProducedQuantity: item.producedQuantity,
      ProductionOrdersTable.colStatus: item.status,
      ProductionOrdersTable.colDate: item.date.toIso8601String(),
      ProductionOrdersTable.colUserId: item.userId,
    };
  }
  
  /// Get order by reference
  Future<ProductionOrderEntity?> getByReference(String reference) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${ProductionOrdersTable.colReference} = ?',
      whereArgs: [reference],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return fromMap(maps.first);
  }
  
  /// Get orders by status
  Future<List<ProductionOrderEntity>> getByStatus(String status) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${ProductionOrdersTable.colStatus} = ?',
      whereArgs: [status],
      orderBy: '${ProductionOrdersTable.colDate} DESC',
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Get active orders (not completed)
  Future<List<ProductionOrderEntity>> getActiveOrders() async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${ProductionOrdersTable.colStatus} != ?',
      whereArgs: ['COMPLETED'],
      orderBy: '${ProductionOrdersTable.colDate} DESC',
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Update order status
  Future<void> updateStatus(int id, String status, {int? producedQuantity}) async {
    final database = await db;
    final updates = <String, dynamic>{
      ProductionOrdersTable.colStatus: status,
      ProductionOrdersTable.colUpdatedAt: DateTime.now().toIso8601String(),
    };
    if (producedQuantity != null) {
      updates[ProductionOrdersTable.colProducedQuantity] = producedQuantity;
    }
    await database.update(tableName, updates, where: 'id = ?', whereArgs: [id]);
  }
  
  /// Get consumptions for an order
  Future<List<ProductionConsumptionEntity>> getConsumptions(int orderId) async {
    final database = await db;
    final maps = await database.query(
      ProductionConsumptionsTable.tableName,
      where: '${ProductionConsumptionsTable.colProductionOrderId} = ?',
      whereArgs: [orderId],
    );
    return maps.map((map) => _consumptionFromMap(map)).toList();
  }
  
  /// Insert consumption
  Future<int> insertConsumption(ProductionConsumptionEntity consumption) async {
    final database = await db;
    return await database.insert(ProductionConsumptionsTable.tableName, {
      ProductionConsumptionsTable.colProductionOrderId: consumption.productionOrderId,
      ProductionConsumptionsTable.colLotMpId: consumption.lotMpId,
      ProductionConsumptionsTable.colQuantity: consumption.quantity,
      ProductionConsumptionsTable.colCreatedAt: DateTime.now().toIso8601String(),
    });
  }
  
  ProductionConsumptionEntity _consumptionFromMap(Map<String, dynamic> map) {
    return ProductionConsumptionEntity(
      id: map[ProductionConsumptionsTable.colId] as int?,
      productionOrderId: map[ProductionConsumptionsTable.colProductionOrderId] as int,
      lotMpId: map[ProductionConsumptionsTable.colLotMpId] as int,
      quantity: map[ProductionConsumptionsTable.colQuantity] as int,
      createdAt: map[ProductionConsumptionsTable.colCreatedAt] != null 
          ? DateTime.parse(map[ProductionConsumptionsTable.colCreatedAt] as String) 
          : null,
    );
  }
}
