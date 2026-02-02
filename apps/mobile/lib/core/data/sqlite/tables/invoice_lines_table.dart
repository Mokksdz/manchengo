/// Invoice lines table definition
abstract class InvoiceLinesTable {
  static const String tableName = 'invoice_lines';
  
  static const String createSql = '''
    CREATE TABLE invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      lot_id INTEGER,
      quantity INTEGER NOT NULL,
      unit_price_ht INTEGER NOT NULL,
      line_ht INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products_pf(id),
      FOREIGN KEY (lot_id) REFERENCES lots_pf(id)
    )
  ''';
  
  static const String createIndexSql = '''
    CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id)
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colInvoiceId = 'invoice_id';
  static const String colProductId = 'product_id';
  static const String colLotId = 'lot_id';
  static const String colQuantity = 'quantity';
  static const String colUnitPriceHt = 'unit_price_ht';
  static const String colLineHt = 'line_ht';
  static const String colCreatedAt = 'created_at';
}
