import 'package:flutter/foundation.dart';
import '../data/sqlite/repositories/repositories.dart';
import '../data/sqlite/database.dart';
import '../models/models.dart';
import 'errors.dart';

/// Service handling MP reception business logic.
/// 
/// Workflow:
/// 1. Validate inputs (quantity > 0, entities exist)
/// 2. Generate lot number
/// 3. Create lot_mp record
/// 4. Create stock_movement (IN)
/// 5. Return created lot
class ReceptionService {
  final SupplierRepository _supplierRepo = SupplierRepository();
  final ProductMpRepository _productMpRepo = ProductMpRepository();

  /// Receive MP from supplier
  /// 
  /// Creates a new lot and records the stock movement.
  /// [supplierId] - Supplier providing the MP
  /// [productMpId] - Product being received
  /// [quantity] - Quantity received (must be > 0)
  /// [userId] - User performing the operation
  /// 
  /// Returns the created lot
  Future<Lot> receiveMp({
    required int supplierId,
    required int productMpId,
    required int quantity,
    required int userId,
  }) async {
    // Validate quantity
    if (quantity <= 0) {
      throw InvalidQuantityError(quantity);
    }

    // Validate supplier exists
    final supplier = await _supplierRepo.getById(supplierId);
    if (supplier == null) {
      throw EntityNotFoundError(
        entityType: 'Fournisseur',
        entityId: supplierId.toString(),
      );
    }

    // Validate product exists
    final product = await _productMpRepo.getById(productMpId);
    if (product == null) {
      throw EntityNotFoundError(
        entityType: 'Produit MP',
        entityId: productMpId.toString(),
      );
    }

    // Generate lot number: L{YYMMDD}-{SEQUENCE}
    final now = DateTime.now();
    final timestamp = _utcTimestamp();
    final datePrefix = 'L${now.year.toString().substring(2)}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
    final sequence = await _getNextLotSequence(datePrefix);
    final lotNumber = '$datePrefix-$sequence';

    final db = await AppDatabase.instance.database;
    late int lotId;

    // Transaction: lot + stock_movement must both succeed or both fail
    try {
      await db.transaction((txn) async {
        // Insert lot
        lotId = await txn.insert('lots_mp', {
          'product_id': productMpId,
          'lot_number': lotNumber,
          'quantity': quantity,
          'production_date': now.toIso8601String(),
          'supplier_id': supplierId,
          'created_at': timestamp,
        });

        // Insert stock movement
        await txn.insert('stock_movements', {
          'movement_type': 'IN',
          'product_type': 'MP',
          'product_id': productMpId,
          'lot_id': lotId,
          'quantity': quantity,
          'reason': 'RECEPTION',
          'reference_type': 'LOT_MP',
          'reference_id': lotId,
          'user_id': userId,
          'created_at': timestamp,
        });
      });
    } catch (e) {
      throw TransactionError('Échec réception MP: $e');
    }

    debugPrint('Reception MP: $lotNumber - ${product.name} x $quantity from ${supplier.name}');

    // Record sync event AFTER successful transaction
    await SyncEventService().recordEvent(
      entityType: SyncEntityType.lotMp,
      entityId: lotId.toString(),
      action: SyncAction.mpReceived,
      payload: {
        'lot_id': lotId,
        'lot_number': lotNumber,
        'product_id': productMpId,
        'supplier_id': supplierId,
        'quantity': quantity,
      },
      userId: userId,
    );

    return Lot(
      id: lotId.toString(),
      productId: productMpId.toString(),
      lotNumber: lotNumber,
      quantity: quantity,
      productionDate: now,
    );
  }

  /// Get next sequence number for lot
  Future<String> _getNextLotSequence(String prefix) async {
    final db = await AppDatabase.instance.database;
    final result = await db.rawQuery(
      "SELECT COUNT(*) as count FROM lots_mp WHERE lot_number LIKE ?",
      ['$prefix%'],
    );
    final count = (result.first['count'] as int?) ?? 0;
    return (count + 1).toString().padLeft(3, '0');
  }

  /// Consistent UTC timestamp for audit trail
  String _utcTimestamp() => DateTime.now().toUtc().toIso8601String();
}
