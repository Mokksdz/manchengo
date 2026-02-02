import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'dart:async';

/// SQLite database manager for offline-first architecture
class OfflineDatabase {
  static const String _databaseName = 'manchengo_offline.db';
  static const int _databaseVersion = 1;

  static Database? _database;
  static final OfflineDatabase instance = OfflineDatabase._internal();

  OfflineDatabase._internal();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _databaseName);

    return await openDatabase(
      path,
      version: _databaseVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
      onConfigure: _onConfigure,
    );
  }

  Future<void> _onConfigure(Database db) async {
    await db.execute('PRAGMA foreign_keys = ON');
    await db.execute('PRAGMA journal_mode = WAL');
  }

  Future<void> _onCreate(Database db, int version) async {
    // ═══════════════════════════════════════════════════════════════════════════
    // SYNC QUEUE - Events waiting to be pushed to server
    // ═══════════════════════════════════════════════════════════════════════════
    await db.execute('''
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        checksum TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        batch_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        sent_at TEXT,
        acked_at TEXT
      )
    ''');
    await db.execute('CREATE INDEX idx_sync_queue_status ON sync_queue(status)');
    await db.execute('CREATE INDEX idx_sync_queue_occurred ON sync_queue(occurred_at)');
    await db.execute('CREATE INDEX idx_sync_queue_batch ON sync_queue(batch_id)');

    // ═══════════════════════════════════════════════════════════════════════════
    // SYNC META - Synchronization metadata
    // ═══════════════════════════════════════════════════════════════════════════
    await db.execute('''
      CREATE TABLE sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    ''');

    // Initialize default values
    final now = DateTime.now().toUtc().toIso8601String();
    await db.insert('sync_meta', {'key': 'last_pull_at', 'value': '1970-01-01T00:00:00Z', 'updated_at': now});
    await db.insert('sync_meta', {'key': 'last_push_at', 'value': '1970-01-01T00:00:00Z', 'updated_at': now});
    await db.insert('sync_meta', {'key': 'device_id', 'value': '', 'updated_at': now});
    await db.insert('sync_meta', {'key': 'server_time_offset', 'value': '0', 'updated_at': now});
    await db.insert('sync_meta', {'key': 'sync_version', 'value': '1', 'updated_at': now});

    // ═══════════════════════════════════════════════════════════════════════════
    // LOCAL AUDIT LOG - Append-only audit trail
    // ═══════════════════════════════════════════════════════════════════════════
    await db.execute('''
      CREATE TABLE local_audit_log (
        id TEXT PRIMARY KEY,
        event_id TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        device_id TEXT NOT NULL,
        payload_hash TEXT,
        context TEXT,
        synced INTEGER DEFAULT 0
      )
    ''');
    await db.execute('CREATE INDEX idx_audit_synced ON local_audit_log(synced)');
    await db.execute('CREATE INDEX idx_audit_occurred ON local_audit_log(occurred_at)');

    // ═══════════════════════════════════════════════════════════════════════════
    // CACHE TABLES - Server data cached locally (read-only)
    // ═══════════════════════════════════════════════════════════════════════════

    // Products PF (Finished Products)
    await db.execute('''
      CREATE TABLE cache_products_pf (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        short_name TEXT,
        unit TEXT NOT NULL,
        price_ht INTEGER NOT NULL,
        min_stock INTEGER DEFAULT 0,
        weight_grams INTEGER,
        brand_name TEXT,
        family_name TEXT,
        is_active INTEGER DEFAULT 1,
        updated_at TEXT,
        cache_expires TEXT
      )
    ''');
    await db.execute('CREATE INDEX idx_products_code ON cache_products_pf(code)');
    await db.execute('CREATE INDEX idx_products_active ON cache_products_pf(is_active)');

    // Clients
    await db.execute('''
      CREATE TABLE cache_clients (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        wilaya TEXT,
        commune TEXT,
        nif TEXT,
        rc TEXT,
        ai TEXT,
        is_active INTEGER DEFAULT 1,
        updated_at TEXT,
        cache_expires TEXT
      )
    ''');
    await db.execute('CREATE INDEX idx_clients_code ON cache_clients(code)');
    await db.execute('CREATE INDEX idx_clients_type ON cache_clients(type)');

    // Pending Deliveries
    await db.execute('''
      CREATE TABLE cache_deliveries_pending (
        id TEXT PRIMARY KEY,
        reference TEXT NOT NULL,
        invoice_id INTEGER NOT NULL,
        invoice_ref TEXT,
        client_id INTEGER NOT NULL,
        client_name TEXT NOT NULL,
        client_address TEXT,
        total_ttc INTEGER NOT NULL,
        scheduled_date TEXT,
        delivery_address TEXT,
        qr_code TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        updated_at TEXT,
        cache_expires TEXT
      )
    ''');
    await db.execute('CREATE INDEX idx_deliveries_status ON cache_deliveries_pending(status)');
    await db.execute('CREATE INDEX idx_deliveries_client ON cache_deliveries_pending(client_id)');
    await db.execute('CREATE INDEX idx_deliveries_date ON cache_deliveries_pending(scheduled_date)');

    // Stock PF (read-only cache)
    await db.execute('''
      CREATE TABLE cache_stock_pf (
        product_id INTEGER PRIMARY KEY,
        product_code TEXT NOT NULL,
        product_name TEXT NOT NULL,
        current_stock REAL NOT NULL,
        min_stock REAL NOT NULL,
        unit TEXT NOT NULL,
        status TEXT,
        updated_at TEXT,
        cache_expires TEXT
      )
    ''');

    // ═══════════════════════════════════════════════════════════════════════════
    // DRAFT TABLES - Local drafts not yet synced
    // ═══════════════════════════════════════════════════════════════════════════

    // Draft Invoices
    await db.execute('''
      CREATE TABLE draft_invoices (
        id TEXT PRIMARY KEY,
        client_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        total_ht INTEGER DEFAULT 0,
        total_tva INTEGER DEFAULT 0,
        total_ttc INTEGER DEFAULT 0,
        timbre_fiscal INTEGER DEFAULT 0,
        net_to_pay INTEGER DEFAULT 0,
        payment_method TEXT DEFAULT 'ESPECES',
        status TEXT DEFAULT 'DRAFT',
        sync_event_id TEXT,
        server_invoice_id INTEGER,
        server_reference TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      )
    ''');
    await db.execute('CREATE INDEX idx_draft_invoices_status ON draft_invoices(status)');
    await db.execute('CREATE INDEX idx_draft_invoices_client ON draft_invoices(client_id)');

    // Draft Invoice Lines
    await db.execute('''
      CREATE TABLE draft_invoice_lines (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        product_code TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price_ht INTEGER NOT NULL,
        line_ht INTEGER NOT NULL,
        tva_rate REAL DEFAULT 0.19,
        FOREIGN KEY (invoice_id) REFERENCES draft_invoices(id) ON DELETE CASCADE
      )
    ''');
    await db.execute('CREATE INDEX idx_draft_lines_invoice ON draft_invoice_lines(invoice_id)');

    // Pending Delivery Validations
    await db.execute('''
      CREATE TABLE pending_delivery_validations (
        id TEXT PRIMARY KEY,
        delivery_id TEXT NOT NULL,
        qr_scanned TEXT NOT NULL,
        validated_at TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        signature_path TEXT,
        photo_path TEXT,
        recipient_name TEXT,
        notes TEXT,
        status TEXT DEFAULT 'PENDING',
        sync_event_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    ''');
    await db.execute('CREATE INDEX idx_validations_status ON pending_delivery_validations(status)');
    await db.execute('CREATE INDEX idx_validations_delivery ON pending_delivery_validations(delivery_id)');

    // Pending Payments
    await db.execute('''
      CREATE TABLE pending_payments (
        id TEXT PRIMARY KEY,
        invoice_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        payment_method TEXT NOT NULL,
        received_at TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        sync_event_id TEXT,
        server_payment_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    ''');
    await db.execute('CREATE INDEX idx_payments_status ON pending_payments(status)');
    await db.execute('CREATE INDEX idx_payments_invoice ON pending_payments(invoice_id)');

    // ═══════════════════════════════════════════════════════════════════════════
    // USER SESSION - Authentication state
    // ═══════════════════════════════════════════════════════════════════════════
    await db.execute('''
      CREATE TABLE user_session (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL,
        token_expires TEXT,
        last_auth_at TEXT,
        offline_pin_hash TEXT,
        device_id TEXT NOT NULL
      )
    ''');

    // ═══════════════════════════════════════════════════════════════════════════
    // FRAUD ATTEMPTS - Security tracking
    // ═══════════════════════════════════════════════════════════════════════════
    await db.execute('''
      CREATE TABLE fraud_attempts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        details TEXT,
        occurred_at TEXT NOT NULL,
        user_id TEXT,
        device_id TEXT NOT NULL,
        synced INTEGER DEFAULT 0
      )
    ''');
    await db.execute('CREATE INDEX idx_fraud_synced ON fraud_attempts(synced)');
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // Handle migrations here
    if (oldVersion < 2) {
      // Migration for version 2
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC META OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<String?> getMeta(String key) async {
    final db = await database;
    final result = await db.query(
      'sync_meta',
      columns: ['value'],
      where: 'key = ?',
      whereArgs: [key],
    );
    return result.isEmpty ? null : result.first['value'] as String?;
  }

  Future<void> setMeta(String key, String value) async {
    final db = await database;
    await db.insert(
      'sync_meta',
      {
        'key': key,
        'value': value,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<DateTime?> getLastPullAt() async {
    final value = await getMeta('last_pull_at');
    return value != null ? DateTime.parse(value) : null;
  }

  Future<void> setLastPullAt(DateTime time) async {
    await setMeta('last_pull_at', time.toUtc().toIso8601String());
  }

  Future<DateTime?> getLastPushAt() async {
    final value = await getMeta('last_push_at');
    return value != null ? DateTime.parse(value) : null;
  }

  Future<void> setLastPushAt(DateTime time) async {
    await setMeta('last_push_at', time.toUtc().toIso8601String());
  }

  Future<String?> getDeviceId() async {
    return await getMeta('device_id');
  }

  Future<void> setDeviceId(String deviceId) async {
    await setMeta('device_id', deviceId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> clearAllData() async {
    final db = await database;
    await db.transaction((txn) async {
      await txn.delete('sync_queue');
      await txn.delete('local_audit_log');
      await txn.delete('cache_products_pf');
      await txn.delete('cache_clients');
      await txn.delete('cache_deliveries_pending');
      await txn.delete('cache_stock_pf');
      await txn.delete('draft_invoices');
      await txn.delete('draft_invoice_lines');
      await txn.delete('pending_delivery_validations');
      await txn.delete('pending_payments');
      await txn.delete('user_session');
      await txn.delete('fraud_attempts');
      
      // Reset sync meta to defaults
      await txn.update(
        'sync_meta',
        {'value': '1970-01-01T00:00:00Z'},
        where: 'key IN (?, ?)',
        whereArgs: ['last_pull_at', 'last_push_at'],
      );
    });
  }

  Future<void> clearCache() async {
    final db = await database;
    await db.transaction((txn) async {
      await txn.delete('cache_products_pf');
      await txn.delete('cache_clients');
      await txn.delete('cache_deliveries_pending');
      await txn.delete('cache_stock_pf');
    });
  }

  Future<int> getPendingEventCount() async {
    final db = await database;
    final result = await db.rawQuery(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'PENDING'",
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  Future<void> close() async {
    if (_database != null) {
      await _database!.close();
      _database = null;
    }
  }
}
