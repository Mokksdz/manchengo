import '../tables/products_pf_table.dart';
import 'base_repository.dart';

/// Product PF data model for SQLite
class ProductPfEntity {
  final int? id;
  final String code;
  final String name;
  final String unit;
  final int priceHt;
  final int minStock;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  ProductPfEntity({
    this.id,
    required this.code,
    required this.name,
    required this.unit,
    this.priceHt = 0,
    this.minStock = 0,
    this.createdAt,
    this.updatedAt,
  });
}

/// Product PF repository
class ProductPfRepository extends BaseRepository<ProductPfEntity> {
  ProductPfRepository() : super(ProductsPfTable.tableName);
  
  @override
  ProductPfEntity fromMap(Map<String, dynamic> map) {
    return ProductPfEntity(
      id: map[ProductsPfTable.colId] as int?,
      code: map[ProductsPfTable.colCode] as String,
      name: map[ProductsPfTable.colName] as String,
      unit: map[ProductsPfTable.colUnit] as String,
      priceHt: map[ProductsPfTable.colPriceHt] as int? ?? 0,
      minStock: map[ProductsPfTable.colMinStock] as int? ?? 0,
      createdAt: map[ProductsPfTable.colCreatedAt] != null 
          ? DateTime.parse(map[ProductsPfTable.colCreatedAt] as String) 
          : null,
      updatedAt: map[ProductsPfTable.colUpdatedAt] != null 
          ? DateTime.parse(map[ProductsPfTable.colUpdatedAt] as String) 
          : null,
    );
  }
  
  @override
  Map<String, dynamic> toMap(ProductPfEntity item) {
    return {
      ProductsPfTable.colCode: item.code,
      ProductsPfTable.colName: item.name,
      ProductsPfTable.colUnit: item.unit,
      ProductsPfTable.colPriceHt: item.priceHt,
      ProductsPfTable.colMinStock: item.minStock,
    };
  }
  
  /// Get product by code
  Future<ProductPfEntity?> getByCode(String code) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${ProductsPfTable.colCode} = ?',
      whereArgs: [code],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return fromMap(maps.first);
  }
}
