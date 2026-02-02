/// Invoices table definition
abstract class InvoicesTable {
  static const String tableName = 'invoices';
  
  static const String createSql = '''
    CREATE TABLE invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL UNIQUE,
      client_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_ht INTEGER NOT NULL DEFAULT 0,
      total_tva INTEGER NOT NULL DEFAULT 0,
      total_ttc INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('ESPECES', 'CHEQUE', 'VIREMENT')),
      timbre_fiscal INTEGER NOT NULL DEFAULT 0,
      net_to_pay INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(status IN ('UNPAID', 'PARTIAL', 'PAID')),
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  ''';
  
  static const String createIndexSql = '''
    CREATE INDEX idx_invoices_client_date ON invoices(client_id, date)
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colReference = 'reference';
  static const String colClientId = 'client_id';
  static const String colDate = 'date';
  static const String colTotalHt = 'total_ht';
  static const String colTotalTva = 'total_tva';
  static const String colTotalTtc = 'total_ttc';
  static const String colPaymentMethod = 'payment_method';
  static const String colTimbreFiscal = 'timbre_fiscal';
  static const String colNetToPay = 'net_to_pay';
  static const String colStatus = 'status';
  static const String colUserId = 'user_id';
  static const String colCreatedAt = 'created_at';
  static const String colUpdatedAt = 'updated_at';
}
