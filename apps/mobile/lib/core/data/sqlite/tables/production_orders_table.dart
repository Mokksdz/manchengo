/// Production orders table definition
abstract class ProductionOrdersTable {
  static const String tableName = 'production_orders';
  
  static const String createSql = '''
    CREATE TABLE production_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL,
      planned_quantity INTEGER NOT NULL,
      produced_quantity INTEGER,
      status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED')),
      date TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (product_id) REFERENCES products_pf(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colReference = 'reference';
  static const String colProductId = 'product_id';
  static const String colPlannedQuantity = 'planned_quantity';
  static const String colProducedQuantity = 'produced_quantity';
  static const String colStatus = 'status';
  static const String colDate = 'date';
  static const String colUserId = 'user_id';
  static const String colCreatedAt = 'created_at';
  static const String colUpdatedAt = 'updated_at';
}
