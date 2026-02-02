/// Payments table definition
abstract class PaymentsTable {
  static const String tableName = 'payments';
  
  static const String createSql = '''
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('ESPECES', 'CHEQUE', 'VIREMENT')),
      reference TEXT,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  ''';
  
  static const String createIndexSql = '''
    CREATE INDEX idx_payments_invoice ON payments(invoice_id)
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colInvoiceId = 'invoice_id';
  static const String colAmount = 'amount';
  static const String colPaymentMethod = 'payment_method';
  static const String colReference = 'reference';
  static const String colUserId = 'user_id';
  static const String colCreatedAt = 'created_at';
}
