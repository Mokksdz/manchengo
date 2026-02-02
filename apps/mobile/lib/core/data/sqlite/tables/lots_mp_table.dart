/// Lots MP (Matières Premières) table definition
/// FIFO ordering by production_date
abstract class LotsMpTable {
  static const String tableName = 'lots_mp';
  
  static const String createSql = '''
    CREATE TABLE lots_mp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      lot_number TEXT NOT NULL UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 0,
      production_date TEXT NOT NULL,
      expiry_date TEXT,
      supplier_id INTEGER,
      reception_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (product_id) REFERENCES products_mp(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )
  ''';
  
  static const String createIndexSql = '''
    CREATE INDEX idx_lots_mp_product_date ON lots_mp(product_id, production_date)
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colProductId = 'product_id';
  static const String colLotNumber = 'lot_number';
  static const String colQuantity = 'quantity';
  static const String colProductionDate = 'production_date';
  static const String colExpiryDate = 'expiry_date';
  static const String colSupplierId = 'supplier_id';
  static const String colReceptionId = 'reception_id';
  static const String colCreatedAt = 'created_at';
  static const String colUpdatedAt = 'updated_at';
}
