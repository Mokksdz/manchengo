/// Products MP (Matières Premières) table definition
abstract class ProductsMpTable {
  static const String tableName = 'products_mp';
  
  static const String createSql = '''
    CREATE TABLE products_mp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      min_stock INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colCode = 'code';
  static const String colName = 'name';
  static const String colUnit = 'unit';
  static const String colMinStock = 'min_stock';
  static const String colCreatedAt = 'created_at';
  static const String colUpdatedAt = 'updated_at';
}
