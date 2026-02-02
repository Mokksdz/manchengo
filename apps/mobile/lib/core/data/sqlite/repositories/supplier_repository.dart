import '../tables/suppliers_table.dart';
import 'base_repository.dart';

/// Supplier data model for SQLite
class SupplierEntity {
  final int? id;
  final String code;
  final String name;
  final String? phone;
  final String? nif;
  final String? address;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  SupplierEntity({
    this.id,
    required this.code,
    required this.name,
    this.phone,
    this.nif,
    this.address,
    this.createdAt,
    this.updatedAt,
  });
}

/// Supplier repository
class SupplierRepository extends BaseRepository<SupplierEntity> {
  SupplierRepository() : super(SuppliersTable.tableName);
  
  @override
  SupplierEntity fromMap(Map<String, dynamic> map) {
    return SupplierEntity(
      id: map[SuppliersTable.colId] as int?,
      code: map[SuppliersTable.colCode] as String,
      name: map[SuppliersTable.colName] as String,
      phone: map[SuppliersTable.colPhone] as String?,
      nif: map[SuppliersTable.colNif] as String?,
      address: map[SuppliersTable.colAddress] as String?,
      createdAt: map[SuppliersTable.colCreatedAt] != null 
          ? DateTime.parse(map[SuppliersTable.colCreatedAt] as String) 
          : null,
      updatedAt: map[SuppliersTable.colUpdatedAt] != null 
          ? DateTime.parse(map[SuppliersTable.colUpdatedAt] as String) 
          : null,
    );
  }
  
  @override
  Map<String, dynamic> toMap(SupplierEntity item) {
    return {
      SuppliersTable.colCode: item.code,
      SuppliersTable.colName: item.name,
      SuppliersTable.colPhone: item.phone,
      SuppliersTable.colNif: item.nif,
      SuppliersTable.colAddress: item.address,
    };
  }
  
  /// Get supplier by code
  Future<SupplierEntity?> getByCode(String code) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${SuppliersTable.colCode} = ?',
      whereArgs: [code],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return fromMap(maps.first);
  }
  
  /// Search suppliers by name
  Future<List<SupplierEntity>> searchByName(String query) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${SuppliersTable.colName} LIKE ?',
      whereArgs: ['%$query%'],
    );
    return maps.map((map) => fromMap(map)).toList();
  }
}
