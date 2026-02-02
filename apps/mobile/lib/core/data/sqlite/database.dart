import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'tables/tables.dart';

/// SQLite database singleton for Manchengo Smart ERP.
/// 
/// Handles database initialization, versioning, and migrations.
/// Local-only storage - sync will be handled separately.
class AppDatabase {
  static const String _databaseName = 'manchengo.db';
  static const int _databaseVersion = 1;
  
  static AppDatabase? _instance;
  static Database? _database;
  
  AppDatabase._();
  
  /// Singleton instance
  static AppDatabase get instance {
    _instance ??= AppDatabase._();
    return _instance!;
  }
  
  /// Get database instance, initializing if needed
  Future<Database> get database async {
    _database ??= await _initDatabase();
    return _database!;
  }
  
  /// Initialize the database
  Future<Database> _initDatabase() async {
    final databasesPath = await getDatabasesPath();
    final path = join(databasesPath, _databaseName);
    
    return await openDatabase(
      path,
      version: _databaseVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
      onConfigure: _onConfigure,
    );
  }
  
  /// Configure database (enable foreign keys)
  Future<void> _onConfigure(Database db) async {
    await db.execute('PRAGMA foreign_keys = ON');
  }
  
  /// Create all tables on first run
  Future<void> _onCreate(Database db, int version) async {
    final batch = db.batch();
    
    // Core tables
    batch.execute(UsersTable.createSql);
    batch.execute(ProductsMpTable.createSql);
    batch.execute(ProductsPfTable.createSql);
    batch.execute(LotsMpTable.createSql);
    batch.execute(LotsPfTable.createSql);
    batch.execute(StockMovementsTable.createSql);
    batch.execute(ClientsTable.createSql);
    batch.execute(SuppliersTable.createSql);
    batch.execute(InvoicesTable.createSql);
    batch.execute(InvoiceLinesTable.createSql);
    batch.execute(PaymentsTable.createSql);
    batch.execute(ProductionOrdersTable.createSql);
    batch.execute(ProductionConsumptionsTable.createSql);
    batch.execute(SyncQueueTable.createSql);
    batch.execute(SyncEventsTable.createSql);
    
    // Create indexes
    batch.execute(LotsMpTable.createIndexSql);
    batch.execute(LotsPfTable.createIndexSql);
    batch.execute(StockMovementsTable.createIndexSql);
    batch.execute(InvoicesTable.createIndexSql);
    batch.execute(InvoiceLinesTable.createIndexSql);
    batch.execute(PaymentsTable.createIndexSql);
    batch.execute(SyncEventsTable.indexSql);
    
    await batch.commit(noResult: true);
    
    // Insert seed data
    await _insertSeedData(db);
  }
  
  /// Handle database upgrades
  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // TODO: Add migration logic when schema changes
    // Example:
    // if (oldVersion < 2) {
    //   await db.execute('ALTER TABLE ...');
    // }
  }
  
  /// Insert initial seed data
  Future<void> _insertSeedData(Database db) async {
    final now = DateTime.now().toIso8601String();
    
    // Default admin user
    await db.insert('users', {
      'code': 'USR-001',
      'email': 'admin@manchengo.dz',
      'first_name': 'Admin',
      'last_name': 'Système',
      'role': 'admin',
      'is_active': 1,
      'created_at': now,
    });
    
    // Sample products MP
    await db.insert('products_mp', {
      'code': 'MP-001',
      'name': 'Lait cru',
      'unit': 'L',
      'min_stock': 200,
      'created_at': now,
    });
    await db.insert('products_mp', {
      'code': 'MP-002',
      'name': 'Ferments lactiques',
      'unit': 'kg',
      'min_stock': 10,
      'created_at': now,
    });
    await db.insert('products_mp', {
      'code': 'MP-003',
      'name': 'Sel',
      'unit': 'kg',
      'min_stock': 20,
      'created_at': now,
    });
    
    // Sample products PF
    await db.insert('products_pf', {
      'code': 'PF-001',
      'name': 'Manchengo 500g',
      'unit': 'unité',
      'price_ht': 85000,
      'min_stock': 50,
      'created_at': now,
    });
    await db.insert('products_pf', {
      'code': 'PF-002',
      'name': 'Manchengo 1kg',
      'unit': 'unité',
      'price_ht': 160000,
      'min_stock': 30,
      'created_at': now,
    });
    await db.insert('products_pf', {
      'code': 'PF-003',
      'name': 'Fromage frais 250g',
      'unit': 'unité',
      'price_ht': 45000,
      'min_stock': 40,
      'created_at': now,
    });
    
    // Sample supplier
    await db.insert('suppliers', {
      'code': 'FOUR-001',
      'name': 'Laiterie Centrale',
      'phone': '0555123456',
      'created_at': now,
    });
    
    // Sample client
    await db.insert('clients', {
      'code': 'CLI-001',
      'name': 'Laiterie du Nord',
      'type': 'DISTRIBUTEUR',
      'nif': '001234567890123',
      'created_at': now,
    });
  }
  
  /// Close database connection
  Future<void> close() async {
    if (_database != null) {
      await _database!.close();
      _database = null;
    }
  }
  
  /// Delete database (for testing/reset)
  Future<void> deleteDatabase() async {
    final databasesPath = await getDatabasesPath();
    final path = join(databasesPath, _databaseName);
    await databaseFactory.deleteDatabase(path);
    _database = null;
  }
}
