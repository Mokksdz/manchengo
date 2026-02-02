/// Lots PF (Produits Finis) table definition
/// FIFO ordering by production_date
abstract class LotsPfTable {
  static const String tableName = 'lots_pf';
  
  static const String createSql = '''
    CREATE TABLE lots_pf (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      lot_number TEXT NOT NULL UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 0,
      production_date TEXT NOT NULL,
      expiry_date TEXT,
      production_order_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (product_id) REFERENCES products_pf(id),
      FOREIGN KEY (production_order_id) REFERENCES production_orders(id)
    )
  ''';
  
  static const String createIndexSql = '''
    CREATE INDEX idx_lots_pf_product_date ON lots_pf(product_id, production_date)
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colProductId = 'product_id';
  static const String colLotNumber = 'lot_number';
  static const String colQuantity = 'quantity';
  static const String colProductionDate = 'production_date';
  static const String colExpiryDate = 'expiry_date';
  static const String colProductionOrderId = 'production_order_id';
  static const String colCreatedAt = 'created_at';
  static const String colUpdatedAt = 'updated_at';
}
