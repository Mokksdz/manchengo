import '../tables/invoices_table.dart';
import '../tables/invoice_lines_table.dart';
import '../database.dart';
import 'base_repository.dart';

/// Invoice data model for SQLite
class InvoiceEntity {
  final int? id;
  final String reference;
  final int clientId;
  final DateTime date;
  final int totalHt;
  final int totalTva;
  final int totalTtc;
  final String paymentMethod;
  final int timbreFiscal;
  final int netToPay;
  final String status;
  final int userId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  InvoiceEntity({
    this.id,
    required this.reference,
    required this.clientId,
    required this.date,
    required this.totalHt,
    required this.totalTva,
    required this.totalTtc,
    required this.paymentMethod,
    required this.timbreFiscal,
    required this.netToPay,
    this.status = 'UNPAID',
    required this.userId,
    this.createdAt,
    this.updatedAt,
  });
}

/// Invoice line data model
class InvoiceLineEntity {
  final int? id;
  final int invoiceId;
  final int productId;
  final int? lotId;
  final int quantity;
  final int unitPriceHt;
  final int lineHt;
  final DateTime? createdAt;

  InvoiceLineEntity({
    this.id,
    required this.invoiceId,
    required this.productId,
    this.lotId,
    required this.quantity,
    required this.unitPriceHt,
    required this.lineHt,
    this.createdAt,
  });
}

/// Invoice repository
class InvoiceRepository extends BaseRepository<InvoiceEntity> {
  InvoiceRepository() : super(InvoicesTable.tableName);
  
  @override
  InvoiceEntity fromMap(Map<String, dynamic> map) {
    return InvoiceEntity(
      id: map[InvoicesTable.colId] as int?,
      reference: map[InvoicesTable.colReference] as String,
      clientId: map[InvoicesTable.colClientId] as int,
      date: DateTime.parse(map[InvoicesTable.colDate] as String),
      totalHt: map[InvoicesTable.colTotalHt] as int,
      totalTva: map[InvoicesTable.colTotalTva] as int,
      totalTtc: map[InvoicesTable.colTotalTtc] as int,
      paymentMethod: map[InvoicesTable.colPaymentMethod] as String,
      timbreFiscal: map[InvoicesTable.colTimbreFiscal] as int,
      netToPay: map[InvoicesTable.colNetToPay] as int,
      status: map[InvoicesTable.colStatus] as String,
      userId: map[InvoicesTable.colUserId] as int,
      createdAt: map[InvoicesTable.colCreatedAt] != null 
          ? DateTime.parse(map[InvoicesTable.colCreatedAt] as String) 
          : null,
      updatedAt: map[InvoicesTable.colUpdatedAt] != null 
          ? DateTime.parse(map[InvoicesTable.colUpdatedAt] as String) 
          : null,
    );
  }
  
  @override
  Map<String, dynamic> toMap(InvoiceEntity item) {
    return {
      InvoicesTable.colReference: item.reference,
      InvoicesTable.colClientId: item.clientId,
      InvoicesTable.colDate: item.date.toIso8601String(),
      InvoicesTable.colTotalHt: item.totalHt,
      InvoicesTable.colTotalTva: item.totalTva,
      InvoicesTable.colTotalTtc: item.totalTtc,
      InvoicesTable.colPaymentMethod: item.paymentMethod,
      InvoicesTable.colTimbreFiscal: item.timbreFiscal,
      InvoicesTable.colNetToPay: item.netToPay,
      InvoicesTable.colStatus: item.status,
      InvoicesTable.colUserId: item.userId,
    };
  }
  
  /// Get invoice by reference
  Future<InvoiceEntity?> getByReference(String reference) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${InvoicesTable.colReference} = ?',
      whereArgs: [reference],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return fromMap(maps.first);
  }
  
  /// Get invoices by client
  Future<List<InvoiceEntity>> getByClientId(int clientId) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${InvoicesTable.colClientId} = ?',
      whereArgs: [clientId],
      orderBy: '${InvoicesTable.colDate} DESC',
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Get invoices by status
  Future<List<InvoiceEntity>> getByStatus(String status) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      where: '${InvoicesTable.colStatus} = ?',
      whereArgs: [status],
      orderBy: '${InvoicesTable.colDate} DESC',
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Get recent invoices
  Future<List<InvoiceEntity>> getRecent({int limit = 20}) async {
    final database = await db;
    final maps = await database.query(
      tableName,
      orderBy: '${InvoicesTable.colDate} DESC',
      limit: limit,
    );
    return maps.map((map) => fromMap(map)).toList();
  }
  
  /// Update invoice status
  Future<void> updateStatus(int id, String status) async {
    final database = await db;
    await database.update(
      tableName,
      {
        InvoicesTable.colStatus: status,
        InvoicesTable.colUpdatedAt: DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }
  
  /// Get invoice lines
  Future<List<InvoiceLineEntity>> getLines(int invoiceId) async {
    final database = await db;
    final maps = await database.query(
      InvoiceLinesTable.tableName,
      where: '${InvoiceLinesTable.colInvoiceId} = ?',
      whereArgs: [invoiceId],
    );
    return maps.map((map) => _lineFromMap(map)).toList();
  }
  
  /// Insert invoice line
  Future<int> insertLine(InvoiceLineEntity line) async {
    final database = await db;
    return await database.insert(InvoiceLinesTable.tableName, {
      InvoiceLinesTable.colInvoiceId: line.invoiceId,
      InvoiceLinesTable.colProductId: line.productId,
      InvoiceLinesTable.colLotId: line.lotId,
      InvoiceLinesTable.colQuantity: line.quantity,
      InvoiceLinesTable.colUnitPriceHt: line.unitPriceHt,
      InvoiceLinesTable.colLineHt: line.lineHt,
      InvoiceLinesTable.colCreatedAt: DateTime.now().toIso8601String(),
    });
  }
  
  InvoiceLineEntity _lineFromMap(Map<String, dynamic> map) {
    return InvoiceLineEntity(
      id: map[InvoiceLinesTable.colId] as int?,
      invoiceId: map[InvoiceLinesTable.colInvoiceId] as int,
      productId: map[InvoiceLinesTable.colProductId] as int,
      lotId: map[InvoiceLinesTable.colLotId] as int?,
      quantity: map[InvoiceLinesTable.colQuantity] as int,
      unitPriceHt: map[InvoiceLinesTable.colUnitPriceHt] as int,
      lineHt: map[InvoiceLinesTable.colLineHt] as int,
      createdAt: map[InvoiceLinesTable.colCreatedAt] != null 
          ? DateTime.parse(map[InvoiceLinesTable.colCreatedAt] as String) 
          : null,
    );
  }
}
