/// Production consumptions table definition
/// Tracks MP consumed for each production order
abstract class ProductionConsumptionsTable {
  static const String tableName = 'production_consumptions';
  
  static const String createSql = '''
    CREATE TABLE production_consumptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      production_order_id INTEGER NOT NULL,
      lot_mp_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (lot_mp_id) REFERENCES lots_mp(id)
    )
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colProductionOrderId = 'production_order_id';
  static const String colLotMpId = 'lot_mp_id';
  static const String colQuantity = 'quantity';
  static const String colCreatedAt = 'created_at';
}
