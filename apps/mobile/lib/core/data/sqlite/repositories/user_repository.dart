import 'package:sqflite/sqflite.dart';
import '../tables/users_table.dart';
import 'base_repository.dart';

/// User data model for SQLite
class UserEntity {
  final int? id;
  final String code;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final bool isActive;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  UserEntity({
    this.id,
    required this.code,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    this.isActive = true,
    this.createdAt,
    this.updatedAt,
  });
}

/// User repository
class UserRepository extends BaseRepository<UserEntity> {
  UserRepository() : super(UsersTable.tableName);
  
  @override
  UserEntity fromMap(Map<String, dynamic> map) {
    return UserEntity(
      id: map[UsersTable.colId] as int?,
      code: map[UsersTable.colCode] as String,
      email: map[UsersTable.colEmail] as String,
      firstName: map[UsersTable.colFirstName] as String,
      lastName: map[UsersTable.colLastName] as String,
      role: map[UsersTable.colRole] as String,
      isActive: (map[UsersTable.colIsActive] as int) == 1,
      createdAt: map[UsersTable.colCreatedAt] != null 
          ? DateTime.parse(map[UsersTable.colCreatedAt] as String) 
          : null,
      updatedAt: map[UsersTable.colUpdatedAt] != null 
          ? DateTime.parse(map[UsersTable.colUpdatedAt] as String) 
          : null,
    );
  }
  
  @override
  Map<String, dynamic> toMap(UserEntity item) {
    return {
      UsersTable.colCode: item.code,
      UsersTable.colEmail: item.email,
      UsersTable.colFirstName: item.firstName,
      UsersTable.colLastName: item.lastName,
      UsersTable.colRole: item.role,
      UsersTable.colIsActive: item.isActive ? 1 : 0,
    };
  }
  
  /// Get user by email
  Future<UserEntity?> getByEmail(String email) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${UsersTable.colEmail} = ?',
      whereArgs: [email],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return fromMap(maps.first);
  }
  
  /// Get active users only
  Future<List<UserEntity>> getActiveUsers() async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${UsersTable.colIsActive} = ?',
      whereArgs: [1],
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Get first active user (for auto-login on single-user device)
  Future<UserEntity?> getFirstActiveUser() async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${UsersTable.colIsActive} = ?',
      whereArgs: [1],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return fromMap(maps.first);
  }
}
