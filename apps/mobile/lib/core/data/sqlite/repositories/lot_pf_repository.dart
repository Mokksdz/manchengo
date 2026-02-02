import '../tables/lots_pf_table.dart';
import 'base_repository.dart';

/// Lot PF data model for SQLite
class LotPfEntity {
  final int? id;
  final int productId;
  final String lotNumber;
  final int quantity;
  final DateTime productionDate;
  final DateTime? expiryDate;
  final int? productionOrderId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  LotPfEntity({
    this.id,
    required this.productId,
    required this.lotNumber,
    required this.quantity,
    required this.productionDate,
    this.expiryDate,
    this.productionOrderId,
    this.createdAt,
    this.updatedAt,
  });
}

/// Lot PF repository
class LotPfRepository extends BaseRepository<LotPfEntity> {
  LotPfRepository() : super(LotsPfTable.tableName);
  
  @override
  LotPfEntity fromMap(Map<String, dynamic> map) {
    return LotPfEntity(
      id: map[LotsPfTable.colId] as int?,
      productId: map[LotsPfTable.colProductId] as int,
      lotNumber: map[LotsPfTable.colLotNumber] as String,
      quantity: map[LotsPfTable.colQuantity] as int,
      productionDate: DateTime.parse(map[LotsPfTable.colProductionDate] as String),
      expiryDate: map[LotsPfTable.colExpiryDate] != null 
          ? DateTime.parse(map[LotsPfTable.colExpiryDate] as String) 
          : null,
      productionOrderId: map[LotsPfTable.colProductionOrderId] as int?,
      createdAt: map[LotsPfTable.colCreatedAt] != null 
          ? DateTime.parse(map[LotsPfTable.colCreatedAt] as String) 
          : null,
      updatedAt: map[LotsPfTable.colUpdatedAt] != null 
          ? DateTime.parse(map[LotsPfTable.colUpdatedAt] as String) 
          : null,
    );
  }
  
  @override
  Map<String, dynamic> toMap(LotPfEntity item) {
    return {
      LotsPfTable.colProductId: item.productId,
      LotsPfTable.colLotNumber: item.lotNumber,
      LotsPfTable.colQuantity: item.quantity,
      LotsPfTable.colProductionDate: item.productionDate.toIso8601String(),
      LotsPfTable.colExpiryDate: item.expiryDate?.toIso8601String(),
      LotsPfTable.colProductionOrderId: item.productionOrderId,
    };
  }
  
  /// Get lots by product ID ordered by FIFO (oldest first)
  Future<List<LotPfEntity>> getByProductIdFifo(int productId) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${LotsPfTable.colProductId} = ? AND ${LotsPfTable.colQuantity} > 0',
      whereArgs: [productId],
      orderBy: '${LotsPfTable.colProductionDate} ASC',
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Get lot by lot number
  Future<LotPfEntity?> getByLotNumber(String lotNumber) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${LotsPfTable.colLotNumber} = ?',
      whereArgs: [lotNumber],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return fromMap(maps.first);
  }
  
  /// Get all lots with stock > 0
  Future<List<LotPfEntity>> getAvailableLots() async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${LotsPfTable.colQuantity} > 0',
      orderBy: '${LotsPfTable.colProductionDate} ASC',
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Update lot quantity
  Future<void> updateQuantity(int id, int newQuantity) async {
    final database = await db;
    await database.update(
      tableName,
      {
        LotsPfTable.colQuantity: newQuantity,
        LotsPfTable.colUpdatedAt: DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }
  
  /// Calculate total stock for a product
  Future<int> getTotalStockByProductId(int productId) async {
    final database = await db;
    final result = await database.rawQuery(
      'SELECT SUM(${LotsPfTable.colQuantity}) as total FROM $tableName WHERE ${LotsPfTable.colProductId} = ?',
      [productId],
    );
    return (result.first['total'] as int?) ?? 0;
  }
}
