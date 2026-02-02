import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';
import '../data/sqlite/repositories/repositories.dart';
import '../data/sqlite/database.dart';
import '../models/models.dart';
import '../fiscal/fiscal.dart';
import '../sync/sync.dart';
import 'errors.dart';

/// Sale line input for createSale
class SaleLineInput {
  final int productPfId;
  final int quantity;
  
  const SaleLineInput({
    required this.productPfId,
    required this.quantity,
  });
}

/// Service handling PF sales business logic with FIFO stock consumption.
/// 
/// Workflow:
/// 1. Validate inputs (client exists, products exist, stock available)
/// 2. For each line: consume lots FIFO, create stock movements
/// 3. Calculate totals with TVA + Timbre fiscal
/// 4. Create invoice + invoice_lines + payment
/// 5. Return created invoice
class SalesService {
  final ClientRepository _clientRepo = ClientRepository();
  final ProductPfRepository _productPfRepo = ProductPfRepository();
  final LotPfRepository _lotPfRepo = LotPfRepository();

  /// Create a sale with FIFO stock consumption
  /// 
  /// [clientId] - Client making the purchase
  /// [lines] - List of products and quantities
  /// [paymentMethod] - Payment method (affects timbre fiscal)
  /// [userId] - User performing the operation
  /// 
  /// Returns the created invoice
  Future<Invoice> createSale({
    required int clientId,
    required List<SaleLineInput> lines,
    required PaymentMethod paymentMethod,
    required int userId,
  }) async {
    // Validate client exists
    final client = await _clientRepo.getById(clientId);
    if (client == null) {
      throw EntityNotFoundError(
        entityType: 'Client',
        entityId: clientId.toString(),
      );
    }

    // Validate lines not empty
    if (lines.isEmpty) {
      throw ValidationError(
        field: 'lines',
        message: 'La vente doit contenir au moins un article',
      );
    }

    // Validate and prepare each line (before transaction)
    final processedLines = <_ProcessedLine>[];
    
    for (final line in lines) {
      if (line.quantity <= 0) {
        throw InvalidQuantityError(line.quantity);
      }

      final product = await _productPfRepo.getById(line.productPfId);
      if (product == null) {
        throw EntityNotFoundError(
          entityType: 'Produit PF',
          entityId: line.productPfId.toString(),
        );
      }

      final availableStock = await _lotPfRepo.getTotalStockByProductId(line.productPfId);
      if (availableStock < line.quantity) {
        throw StockInsufficientError(
          productName: product.name,
          requested: line.quantity,
          available: availableStock,
        );
      }

      processedLines.add(_ProcessedLine(
        productId: line.productPfId,
        productName: product.name,
        quantity: line.quantity,
        unitPriceHt: product.priceHt,
      ));
    }

    // Calculate totals
    int totalHt = 0;
    for (final line in processedLines) {
      totalHt += line.lineHt;
    }
    
    final totalTva = calculateTva(totalHt);
    final totalTtc = totalHt + totalTva;
    final timbreFiscal = calculateTimbreFiscal(totalTtc, paymentMethod);
    final netToPay = totalTtc + timbreFiscal;

    final now = DateTime.now();
    final timestamp = _utcTimestamp();
    final reference = await _generateInvoiceReference(now);

    final db = await AppDatabase.instance.database;
    late int invoiceId;
    final invoiceLines = <SalesLine>[];

    // Transaction: all writes (invoice, lines, FIFO, movements, payment) are atomic
    try {
      await db.transaction((txn) async {
        // 1. Create invoice
        invoiceId = await txn.insert('invoices', {
          'reference': reference,
          'client_id': clientId,
          'date': now.toIso8601String(),
          'total_ht': totalHt,
          'total_tva': totalTva,
          'total_ttc': totalTtc,
          'payment_method': _mapPaymentMethodToDb(paymentMethod),
          'timbre_fiscal': timbreFiscal,
          'net_to_pay': netToPay,
          'status': 'PAID',
          'user_id': userId,
          'created_at': timestamp,
        });

        // 2. Process each line: FIFO consumption + invoice_line
        for (final line in processedLines) {
          await _consumeStockFifoTxn(
            txn: txn,
            productId: line.productId,
            quantity: line.quantity,
            invoiceId: invoiceId,
            userId: userId,
            timestamp: timestamp,
          );

          await txn.insert('invoice_lines', {
            'invoice_id': invoiceId,
            'product_id': line.productId,
            'quantity': line.quantity,
            'unit_price_ht': line.unitPriceHt,
            'line_ht': line.lineHt,
            'created_at': timestamp,
          });

          invoiceLines.add(SalesLine(
            productId: line.productId.toString(),
            productName: line.productName,
            quantity: line.quantity,
            unitPriceHt: line.unitPriceHt,
            lineHt: line.lineHt,
          ));
        }

        // 3. Create payment
        await txn.insert('payments', {
          'invoice_id': invoiceId,
          'amount': netToPay,
          'payment_method': _mapPaymentMethodToDb(paymentMethod),
          'user_id': userId,
          'created_at': timestamp,
        });
      });
    } catch (e) {
      if (e is BusinessError) rethrow;
      throw TransactionError('Échec création vente: $e');
    }

    debugPrint('Sale created: $reference - Total: ${netToPay / 100} DA');

    // Record sync events AFTER successful transaction
    final syncService = SyncEventService();

    // Invoice created event
    await syncService.recordEvent(
      entityType: SyncEntityType.invoice,
      entityId: invoiceId.toString(),
      action: SyncAction.invoiceCreated,
      payload: {
        'invoice_id': invoiceId,
        'reference': reference,
        'client_id': clientId,
        'total_ht': totalHt,
        'total_tva': totalTva,
        'total_ttc': totalTtc,
        'timbre_fiscal': timbreFiscal,
        'net_to_pay': netToPay,
        'payment_method': _mapPaymentMethodToDb(paymentMethod),
      },
      userId: userId,
    );

    // PF sold events (one per line)
    for (final line in processedLines) {
      await syncService.recordEvent(
        entityType: SyncEntityType.invoiceLine,
        entityId: '$invoiceId-${line.productId}',
        action: SyncAction.pfSold,
        payload: {
          'invoice_id': invoiceId,
          'product_id': line.productId,
          'quantity': line.quantity,
          'unit_price_ht': line.unitPriceHt,
          'line_ht': line.lineHt,
        },
        userId: userId,
      );
    }

    return Invoice(
      id: invoiceId.toString(),
      reference: reference,
      clientId: clientId.toString(),
      clientName: client.name,
      clientNif: client.nif,
      date: now,
      lines: invoiceLines,
      totalHt: totalHt,
      totalTva: totalTva,
      totalTtc: totalTtc,
      paymentMethod: paymentMethod,
      timbreFiscal: timbreFiscal,
      netToPay: netToPay,
      status: InvoiceStatus.paid,
    );
  }

  /// FIFO consumption within transaction
  /// 
  /// Iterates lots oldest-first (by production_date). For each lot:
  /// - Take min(remaining, lot.quantity)
  /// - Update lot, create stock_movement
  /// - Continue until remaining == 0
  Future<void> _consumeStockFifoTxn({
    required Transaction txn,
    required int productId,
    required int quantity,
    required int invoiceId,
    required int userId,
    required String timestamp,
  }) async {
    // FIFO: oldest lots first (production_date ASC)
    final lots = await _lotPfRepo.getByProductIdFifo(productId);
    
    int remaining = quantity;

    for (final lot in lots) {
      if (remaining <= 0) break;
      
      // Take as much as possible from this lot
      final toConsume = remaining > lot.quantity ? lot.quantity : remaining;
      final newQuantity = lot.quantity - toConsume;
      
      // Update lot quantity within transaction
      await txn.update(
        'lots_pf',
        {'quantity': newQuantity, 'updated_at': timestamp},
        where: 'id = ?',
        whereArgs: [lot.id],
      );
      
      // Record stock movement
      await txn.insert('stock_movements', {
        'movement_type': 'OUT',
        'product_type': 'PF',
        'product_id': productId,
        'lot_id': lot.id,
        'quantity': toConsume,
        'reason': 'VENTE',
        'reference_type': 'INVOICE',
        'reference_id': invoiceId,
        'user_id': userId,
        'created_at': timestamp,
      });

      debugPrint('FIFO: Consumed $toConsume from lot ${lot.lotNumber} (remaining: $newQuantity)');
      
      remaining -= toConsume;
    }

    // Safety check (should not happen if validation correct)
    if (remaining > 0) {
      throw TransactionError('Erreur FIFO: stock insuffisant après validation');
    }
  }

  /// Generate invoice reference
  Future<String> _generateInvoiceReference(DateTime date) async {
    final prefix = 'F-${date.year.toString().substring(2)}${date.month.toString().padLeft(2, '0')}${date.day.toString().padLeft(2, '0')}';
    
    final db = await AppDatabase.instance.database;
    final result = await db.rawQuery(
      "SELECT COUNT(*) as count FROM invoices WHERE reference LIKE ?",
      ['$prefix%'],
    );
    final count = (result.first['count'] as int?) ?? 0;
    final sequence = (count + 1).toString().padLeft(3, '0');
    
    return '$prefix-$sequence';
  }

  String _mapPaymentMethodToDb(PaymentMethod method) {
    switch (method) {
      case PaymentMethod.especes:
        return 'ESPECES';
      case PaymentMethod.cheque:
        return 'CHEQUE';
      case PaymentMethod.virement:
        return 'VIREMENT';
    }
  }

  /// Consistent UTC timestamp for audit trail
  String _utcTimestamp() => DateTime.now().toUtc().toIso8601String();
}

/// Internal class for processed line data
class _ProcessedLine {
  final int productId;
  final String productName;
  final int quantity;
  final int unitPriceHt;
  
  _ProcessedLine({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPriceHt,
  });
  
  int get lineHt => quantity * unitPriceHt;
}
