import '../tables/lots_mp_table.dart';
import 'base_repository.dart';

/// Lot MP data model for SQLite
class LotMpEntity {
  final int? id;
  final int productId;
  final String lotNumber;
  final int quantity;
  final DateTime productionDate;
  final DateTime? expiryDate;
  final int? supplierId;
  final int? receptionId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  LotMpEntity({
    this.id,
    required this.productId,
    required this.lotNumber,
    required this.quantity,
    required this.productionDate,
    this.expiryDate,
    this.supplierId,
    this.receptionId,
    this.createdAt,
    this.updatedAt,
  });
}

/// Lot MP repository
class LotMpRepository extends BaseRepository<LotMpEntity> {
  LotMpRepository() : super(LotsMpTable.tableName);
  
  @override
  LotMpEntity fromMap(Map<String, dynamic> map) {
    return LotMpEntity(
      id: map[LotsMpTable.colId] as int?,
      productId: map[LotsMpTable.colProductId] as int,
      lotNumber: map[LotsMpTable.colLotNumber] as String,
      quantity: map[LotsMpTable.colQuantity] as int,
      productionDate: DateTime.parse(map[LotsMpTable.colProductionDate] as String),
      expiryDate: map[LotsMpTable.colExpiryDate] != null 
          ? DateTime.parse(map[LotsMpTable.colExpiryDate] as String) 
          : null,
      supplierId: map[LotsMpTable.colSupplierId] as int?,
      receptionId: map[LotsMpTable.colReceptionId] as int?,
      createdAt: map[LotsMpTable.colCreatedAt] != null 
          ? DateTime.parse(map[LotsMpTable.colCreatedAt] as String) 
          : null,
      updatedAt: map[LotsMpTable.colUpdatedAt] != null 
          ? DateTime.parse(map[LotsMpTable.colUpdatedAt] as String) 
          : null,
    );
  }
  
  @override
  Map<String, dynamic> toMap(LotMpEntity item) {
    return {
      LotsMpTable.colProductId: item.productId,
      LotsMpTable.colLotNumber: item.lotNumber,
      LotsMpTable.colQuantity: item.quantity,
      LotsMpTable.colProductionDate: item.productionDate.toIso8601String(),
      LotsMpTable.colExpiryDate: item.expiryDate?.toIso8601String(),
      LotsMpTable.colSupplierId: item.supplierId,
      LotsMpTable.colReceptionId: item.receptionId,
    };
  }
  
  /// Get lots by product ID ordered by FIFO (oldest first)
  Future<List<LotMpEntity>> getByProductIdFifo(int productId) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${LotsMpTable.colProductId} = ? AND ${LotsMpTable.colQuantity} > 0',
      whereArgs: [productId],
      orderBy: '${LotsMpTable.colProductionDate} ASC',
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Get lot by lot number
  Future<LotMpEntity?> getByLotNumber(String lotNumber) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${LotsMpTable.colLotNumber} = ?',
      whereArgs: [lotNumber],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return fromMap(maps.first);
  }
  
  /// Get all lots with stock > 0
  Future<List<LotMpEntity>> getAvailableLots() async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${LotsMpTable.colQuantity} > 0',
      orderBy: '${LotsMpTable.colProductionDate} ASC',
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Update lot quantity
  Future<void> updateQuantity(int id, int newQuantity) async {
    final database = await db;
    await database.update(
      tableName,
      {
        LotsMpTable.colQuantity: newQuantity,
        LotsMpTable.colUpdatedAt: DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }
  
  /// Calculate total stock for a product
  Future<int> getTotalStockByProductId(int productId) async {
    final database = await db;
    final result = await database.rawQuery(
      'SELECT SUM(${LotsMpTable.colQuantity}) as total FROM $tableName WHERE ${LotsMpTable.colProductId} = ?',
      [productId],
    );
    return (result.first['total'] as int?) ?? 0;
  }
}
