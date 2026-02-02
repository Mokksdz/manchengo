import 'package:sqflite/sqflite.dart';
import '../database.dart';

/// Base repository with common CRUD operations
abstract class BaseRepository<T> {
  final String tableName;
  
  BaseRepository(this.tableName);
  
  /// Get database instance
  Future<Database> get db async => AppDatabase.instance.database;
  
  /// Convert database row to model
  T fromMap(Map<String, dynamic> map);
  
  /// Convert model to database row
  Map<String, dynamic> toMap(T item);
  
  /// Get all records
  Future<List<T>> getAll() async {
    final database = await db;
    final maps = await database.query(tableName);
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Get record by ID
  Future<T?> getById(int id) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return fromMap(maps.first);
  }
  
  /// Insert record
  Future<int> insert(T item) async {
    final database = await db;
    final map = toMap(item);
    map['created_at'] = DateTime.now().toIso8601String();
    return await database.insert(tableName, map);
  }
  
  /// Update record
  Future<int> update(int id, T item) async {
    final database = await db;
    final map = toMap(item);
    map['updated_at'] = DateTime.now().toIso8601String();
    return await database.update(
      tableName,
      map,
      where: 'id = ?',
      whereArgs: [id],
    );
  }
  
  /// Delete record
  Future<int> delete(int id) async {
    final database = await db;
    return await database.delete(
      tableName,
      where: 'id = ?',
      whereArgs: [id],
    );
  }
  
  /// Count records
  Future<int> count() async {
    final database = await db;
    final result = await database.rawQuery('SELECT COUNT(*) as count FROM $tableName');
    return Sqflite.firstIntValue(result) ?? 0;
  }
  
  // TODO: Add sync queue entry after mutations for future sync
  // Future<void> _addToSyncQueue(String action, int entityId) async { }
}
