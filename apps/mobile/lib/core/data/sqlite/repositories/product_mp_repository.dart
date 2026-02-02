import '../tables/products_mp_table.dart';
import 'base_repository.dart';

/// Product MP data model for SQLite
class ProductMpEntity {
  final int? id;
  final String code;
  final String name;
  final String unit;
  final int minStock;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  ProductMpEntity({
    this.id,
    required this.code,
    required this.name,
    required this.unit,
    this.minStock = 0,
    this.createdAt,
    this.updatedAt,
  });
}

/// Product MP repository
class ProductMpRepository extends BaseRepository<ProductMpEntity> {
  ProductMpRepository() : super(ProductsMpTable.tableName);
  
  @override
  ProductMpEntity fromMap(Map<String, dynamic> map) {
    return ProductMpEntity(
      id: map[ProductsMpTable.colId] as int?,
      code: map[ProductsMpTable.colCode] as String,
      name: map[ProductsMpTable.colName] as String,
      unit: map[ProductsMpTable.colUnit] as String,
      minStock: map[ProductsMpTable.colMinStock] as int? ?? 0,
      createdAt: map[ProductsMpTable.colCreatedAt] != null 
          ? DateTime.parse(map[ProductsMpTable.colCreatedAt] as String) 
          : null,
      updatedAt: map[ProductsMpTable.colUpdatedAt] != null 
          ? DateTime.parse(map[ProductsMpTable.colUpdatedAt] as String) 
          : null,
    );
  }
  
  @override
  Map<String, dynamic> toMap(ProductMpEntity item) {
    return {
      ProductsMpTable.colCode: item.code,
      ProductsMpTable.colName: item.name,
      ProductsMpTable.colUnit: item.unit,
      ProductsMpTable.colMinStock: item.minStock,
    };
  }
  
  /// Get product by code
  Future<ProductMpEntity?> getByCode(String code) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${ProductsMpTable.colCode} = ?',
      whereArgs: [code],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return fromMap(maps.first);
  }
}
