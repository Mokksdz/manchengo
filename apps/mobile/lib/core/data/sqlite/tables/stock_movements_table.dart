/// Stock movements table definition
/// Tracks all stock changes for audit trail
abstract class StockMovementsTable {
  static const String tableName = 'stock_movements';
  
  static const String createSql = '''
    CREATE TABLE stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_type TEXT NOT NULL CHECK(movement_type IN ('IN', 'OUT', 'ADJUST')),
      product_type TEXT NOT NULL CHECK(product_type IN ('MP', 'PF')),
      product_id INTEGER NOT NULL,
      lot_id INTEGER,
      quantity INTEGER NOT NULL,
      reason TEXT NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  ''';
  
  static const String createIndexSql = '''
    CREATE INDEX idx_stock_movements_product ON stock_movements(product_type, product_id, created_at)
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colMovementType = 'movement_type';
  static const String colProductType = 'product_type';
  static const String colProductId = 'product_id';
  static const String colLotId = 'lot_id';
  static const String colQuantity = 'quantity';
  static const String colReason = 'reason';
  static const String colReferenceType = 'reference_type';
  static const String colReferenceId = 'reference_id';
  static const String colUserId = 'user_id';
  static const String colCreatedAt = 'created_at';
}
