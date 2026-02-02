import '../tables/clients_table.dart';
import 'base_repository.dart';

/// Client data model for SQLite
class ClientEntity {
  final int? id;
  final String code;
  final String name;
  final String type;
  final String? phone;
  final String? nif;
  final String? nis;
  final String? address;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  ClientEntity({
    this.id,
    required this.code,
    required this.name,
    required this.type,
    this.phone,
    this.nif,
    this.nis,
    this.address,
    this.createdAt,
    this.updatedAt,
  });
}

/// Client repository
class ClientRepository extends BaseRepository<ClientEntity> {
  ClientRepository() : super(ClientsTable.tableName);
  
  @override
  ClientEntity fromMap(Map<String, dynamic> map) {
    return ClientEntity(
      id: map[ClientsTable.colId] as int?,
      code: map[ClientsTable.colCode] as String,
      name: map[ClientsTable.colName] as String,
      type: map[ClientsTable.colType] as String,
      phone: map[ClientsTable.colPhone] as String?,
      nif: map[ClientsTable.colNif] as String?,
      nis: map[ClientsTable.colNis] as String?,
      address: map[ClientsTable.colAddress] as String?,
      createdAt: map[ClientsTable.colCreatedAt] != null 
          ? DateTime.parse(map[ClientsTable.colCreatedAt] as String) 
          : null,
      updatedAt: map[ClientsTable.colUpdatedAt] != null 
          ? DateTime.parse(map[ClientsTable.colUpdatedAt] as String) 
          : null,
    );
  }
  
  @override
  Map<String, dynamic> toMap(ClientEntity item) {
    return {
      ClientsTable.colCode: item.code,
      ClientsTable.colName: item.name,
      ClientsTable.colType: item.type,
      ClientsTable.colPhone: item.phone,
      ClientsTable.colNif: item.nif,
      ClientsTable.colNis: item.nis,
      ClientsTable.colAddress: item.address,
    };
  }
  
  /// Get client by code
  Future<ClientEntity?> getByCode(String code) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${ClientsTable.colCode} = ?',
      whereArgs: [code],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return fromMap(maps.first);
  }
  
  /// Get clients by type
  Future<List<ClientEntity>> getByType(String type) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${ClientsTable.colType} = ?',
      whereArgs: [type],
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Search clients by name
  Future<List<ClientEntity>> searchByName(String query) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${ClientsTable.colName} LIKE ?',
      whereArgs: ['%$query%'],
    );
    return maps.map((map) => fromMap(map)).toList();
  }
}
