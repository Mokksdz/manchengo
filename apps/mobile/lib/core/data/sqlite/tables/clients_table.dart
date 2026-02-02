/// Clients table definition
abstract class ClientsTable {
  static const String tableName = 'clients';
  
  static const String createSql = '''
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('DISTRIBUTEUR', 'GROSSISTE', 'SUPERETTE', 'FAST_FOOD')),
      phone TEXT,
      nif TEXT,
      nis TEXT,
      address TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  ''';
  
  // Column names
  static const String colId = 'id';
  static const String colCode = 'code';
  static const String colName = 'name';
  static const String colType = 'type';
  static const String colPhone = 'phone';
  static const String colNif = 'nif';
  static const String colNis = 'nis';
  static const String colAddress = 'address';
  static const String colCreatedAt = 'created_at';
  static const String colUpdatedAt = 'updated_at';
}
