/// Suppliers table definition
abstract class SuppliersTable {
  static const String tableName = 'suppliers';
  
  static const String createSql = '''
    CREATE TABLE suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      nif TEXT,
      address TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colCode = 'code';
  static const String colName = 'name';
  static const String colPhone = 'phone';
  static const String colNif = 'nif';
  static const String colAddress = 'address';
  static const String colCreatedAt = 'created_at';
  static const String colUpdatedAt = 'updated_at';
}
