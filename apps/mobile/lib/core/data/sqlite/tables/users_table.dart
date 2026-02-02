/// Users table definition
abstract class UsersTable {
  static const String tableName = 'users';
  
  static const String createSql = '''
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'appro', 'production', 'commercial', 'comptable')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colCode = 'code';
  static const String colEmail = 'email';
  static const String colFirstName = 'first_name';
  static const String colLastName = 'last_name';
  static const String colRole = 'role';
  static const String colIsActive = 'is_active';
  static const String colCreatedAt = 'created_at';
  static const String colUpdatedAt = 'updated_at';
}
