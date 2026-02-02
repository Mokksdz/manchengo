import 'package:flutter/foundation.dart';
import '../data/sqlite/database.dart';
import 'pull_client.dart';
import 'sync_event.dart';

/// Event applier for pull sync
/// 
/// Applies remote events directly to SQLite tables.
/// NO business services - direct table updates only.
/// Respects conflict resolution rules.
class EventApplier {
  /// Check if event was already applied
  Future<bool> isEventApplied(String eventId) async {
    final db = await AppDatabase.instance.database;
    final result = await db.query(
      'sync_events',
      where: 'id = ?',
      whereArgs: [eventId],
      limit: 1,
    );
    return result.isNotEmpty;
  }

  /// Apply a remote event to local SQLite
  /// 
  /// Idempotent: safe to call multiple times.
  /// Returns true if applied, false if skipped.
  Future<bool> applyEvent(RemoteEvent event) async {
    // Skip if already applied
    if (await isEventApplied(event.id)) {
      debugPrint('Apply: Skipping duplicate event ${event.id}');
      return false;
    }

    final db = await AppDatabase.instance.database;

    try {
      await db.transaction((txn) async {
        // Apply based on action type
        switch (event.action) {
          case SyncAction.mpReceived:
            await _applyMpReceived(txn, event);
            break;
          case SyncAction.mpConsumed:
            await _applyMpConsumed(txn, event);
            break;
          case SyncAction.pfProduced:
            await _applyPfProduced(txn, event);
            break;
          case SyncAction.pfSold:
            await _applyPfSold(txn, event);
            break;
          case SyncAction.invoiceCreated:
            await _applyInvoiceCreated(txn, event);
            break;
          case SyncAction.paymentCreated:
            await _applyPaymentCreated(txn, event);
            break;
          default:
            debugPrint('Apply: Unknown action ${event.action}');
        }

        // Record event as applied
        await _recordAppliedEvent(txn, event);
      });

      debugPrint('Apply: Applied ${event.action} for ${event.entityType}#${event.entityId}');
      return true;
    } catch (e) {
      debugPrint('Apply: Error applying event ${event.id}: $e');
      return false;
    }
  }

  /// Apply MP_RECEIVED event
  Future<void> _applyMpReceived(dynamic txn, RemoteEvent event) async {
    final payload = event.payload;
    final lotId = payload['lot_id'];
    final lotNumber = payload['lot_number'] as String?;
    final productId = payload['product_id'];
    final supplierId = payload['supplier_id'];
    final quantity = payload['quantity'] as int?;

    if (lotId == null || quantity == null) return;

    // Check if lot exists
    final existing = await txn.query(
      'lots_mp',
      where: 'id = ?',
      whereArgs: [lotId],
      limit: 1,
    );

    if (existing.isEmpty) {
      // Insert new lot (server-wins for stock)
      await txn.insert('lots_mp', {
        'id': lotId,
        'product_id': productId,
        'lot_number': lotNumber,
        'quantity': quantity,
        'production_date': event.occurredAt.toIso8601String(),
        'supplier_id': supplierId,
        'created_at': event.occurredAt.toIso8601String(),
      });
    } else {
      // Server-wins for quantity (critical entity)
      await txn.update(
        'lots_mp',
        {
          'quantity': quantity,
          'updated_at': event.occurredAt.toIso8601String(),
        },
        where: 'id = ?',
        whereArgs: [lotId],
      );
    }
  }

  /// Apply MP_CONSUMED event
  Future<void> _applyMpConsumed(dynamic txn, RemoteEvent event) async {
    final payload = event.payload;
    final lotId = payload['lot_id'];
    final quantityConsumed = payload['quantity'] as int?;
    final newQuantity = payload['new_quantity'] as int?;

    if (lotId == null) return;

    // Server-wins for quantity (critical entity)
    if (newQuantity != null) {
      await txn.update(
        'lots_mp',
        {
          'quantity': newQuantity,
          'updated_at': event.occurredAt.toIso8601String(),
        },
        where: 'id = ?',
        whereArgs: [lotId],
      );
    }
  }

  /// Apply PF_PRODUCED event
  Future<void> _applyPfProduced(dynamic txn, RemoteEvent event) async {
    final payload = event.payload;
    final lotId = payload['lot_id'];
    final lotNumber = payload['lot_number'] as String?;
    final productId = payload['product_id'];
    final quantity = payload['quantity'] as int?;
    final productionOrderId = payload['production_order_id'];

    if (lotId == null || quantity == null) return;

    // Check if lot exists
    final existing = await txn.query(
      'lots_pf',
      where: 'id = ?',
      whereArgs: [lotId],
      limit: 1,
    );

    if (existing.isEmpty) {
      await txn.insert('lots_pf', {
        'id': lotId,
        'product_id': productId,
        'lot_number': lotNumber,
        'quantity': quantity,
        'production_date': event.occurredAt.toIso8601String(),
        'production_order_id': productionOrderId,
        'created_at': event.occurredAt.toIso8601String(),
      });
    } else {
      // Server-wins for quantity
      await txn.update(
        'lots_pf',
        {
          'quantity': quantity,
          'updated_at': event.occurredAt.toIso8601String(),
        },
        where: 'id = ?',
        whereArgs: [lotId],
      );
    }
  }

  /// Apply PF_SOLD event
  Future<void> _applyPfSold(dynamic txn, RemoteEvent event) async {
    final payload = event.payload;
    final invoiceId = payload['invoice_id'];
    final productId = payload['product_id'];
    final quantity = payload['quantity'] as int?;
    final unitPriceHt = payload['unit_price_ht'] as int?;
    final lineHt = payload['line_ht'] as int?;

    if (invoiceId == null || productId == null) return;

    // Check if invoice line exists
    final existing = await txn.query(
      'invoice_lines',
      where: 'invoice_id = ? AND product_id = ?',
      whereArgs: [invoiceId, productId],
      limit: 1,
    );

    if (existing.isEmpty && quantity != null) {
      await txn.insert('invoice_lines', {
        'invoice_id': invoiceId,
        'product_id': productId,
        'quantity': quantity,
        'unit_price_ht': unitPriceHt,
        'line_ht': lineHt,
        'created_at': event.occurredAt.toIso8601String(),
      });
    }
  }

  /// Apply INVOICE_CREATED event
  Future<void> _applyInvoiceCreated(dynamic txn, RemoteEvent event) async {
    final payload = event.payload;
    final invoiceId = payload['invoice_id'];
    final reference = payload['reference'] as String?;
    final clientId = payload['client_id'];
    final totalHt = payload['total_ht'] as int?;
    final totalTva = payload['total_tva'] as int?;
    final totalTtc = payload['total_ttc'] as int?;
    final timbreFiscal = payload['timbre_fiscal'] as int?;
    final netToPay = payload['net_to_pay'] as int?;
    final paymentMethod = payload['payment_method'] as String?;

    if (invoiceId == null || reference == null) return;

    // Check if invoice exists
    final existing = await txn.query(
      'invoices',
      where: 'id = ?',
      whereArgs: [invoiceId],
      limit: 1,
    );

    if (existing.isEmpty) {
      await txn.insert('invoices', {
        'id': invoiceId,
        'reference': reference,
        'client_id': clientId,
        'date': event.occurredAt.toIso8601String(),
        'total_ht': totalHt,
        'total_tva': totalTva,
        'total_ttc': totalTtc,
        'timbre_fiscal': timbreFiscal,
        'net_to_pay': netToPay,
        'payment_method': paymentMethod,
        'status': 'PAID',
        'user_id': event.userId,
        'created_at': event.occurredAt.toIso8601String(),
      });
    } else {
      // LWW for non-critical metadata
      final existingRow = existing.first;
      final existingUpdatedAt = existingRow['updated_at'] as String?;
      
      if (existingUpdatedAt == null || 
          event.occurredAt.isAfter(DateTime.parse(existingUpdatedAt))) {
        await txn.update(
          'invoices',
          {
            'total_ht': totalHt,
            'total_tva': totalTva,
            'total_ttc': totalTtc,
            'updated_at': event.occurredAt.toIso8601String(),
          },
          where: 'id = ?',
          whereArgs: [invoiceId],
        );
      }
    }
  }

  /// Apply PAYMENT_CREATED event
  Future<void> _applyPaymentCreated(dynamic txn, RemoteEvent event) async {
    final payload = event.payload;
    final paymentId = payload['payment_id'];
    final invoiceId = payload['invoice_id'];
    final amount = payload['amount'] as int?;
    final paymentMethod = payload['payment_method'] as String?;

    if (invoiceId == null || amount == null) return;

    // Check if payment exists
    final whereClause = paymentId != null ? 'id = ?' : 'invoice_id = ?';
    final whereArgs = [paymentId ?? invoiceId];

    final existing = await txn.query(
      'payments',
      where: whereClause,
      whereArgs: whereArgs,
      limit: 1,
    );

    if (existing.isEmpty) {
      final insertData = <String, dynamic>{
        'invoice_id': invoiceId,
        'amount': amount,
        'payment_method': paymentMethod,
        'user_id': event.userId,
        'created_at': event.occurredAt.toIso8601String(),
      };
      if (paymentId != null) {
        insertData['id'] = paymentId;
      }
      await txn.insert('payments', insertData);
    }
  }

  /// Record event as applied (for idempotency)
  Future<void> _recordAppliedEvent(dynamic txn, RemoteEvent event) async {
    await txn.insert('sync_events', {
      'id': event.id,
      'entity_type': event.entityType,
      'entity_id': event.entityId,
      'action': event.action,
      'payload': '{}', // Don't store payload again
      'occurred_at': event.occurredAt.toUtc().toIso8601String(),
      'device_id': event.deviceId,
      'user_id': event.userId,
      'synced': 1, // Already synced (came from server)
      'synced_at': DateTime.now().toUtc().toIso8601String(),
      'created_at': DateTime.now().toUtc().toIso8601String(),
    });
  }
}
