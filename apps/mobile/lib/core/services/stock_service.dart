import '../data/sqlite/repositories/repositories.dart';
import '../models/models.dart';

/// Service handling stock loading and computation.
/// 
/// Provides read-only access to current stock levels.
/// Stock is calculated from lot quantities (FIFO).
class StockService {
  final ProductMpRepository _productMpRepo = ProductMpRepository();
  final ProductPfRepository _productPfRepo = ProductPfRepository();
  final LotMpRepository _lotMpRepo = LotMpRepository();
  final LotPfRepository _lotPfRepo = LotPfRepository();

  /// Load all MP products with current stock levels
  Future<List<Product>> loadProductsMp() async {
    final entities = await _productMpRepo.getAll();
    final products = <Product>[];
    
    for (final e in entities) {
      final stock = await _lotMpRepo.getTotalStockByProductId(e.id!);
      products.add(Product(
        id: e.id.toString(),
        code: e.code,
        name: e.name,
        unit: e.unit,
        isMp: true,
        currentStock: stock,
        minStock: e.minStock,
      ));
    }
    
    return products;
  }

  /// Load all PF products with current stock levels
  Future<List<Product>> loadProductsPf() async {
    final entities = await _productPfRepo.getAll();
    final products = <Product>[];
    
    for (final e in entities) {
      final stock = await _lotPfRepo.getTotalStockByProductId(e.id!);
      products.add(Product(
        id: e.id.toString(),
        code: e.code,
        name: e.name,
        unit: e.unit,
        isMp: false,
        currentStock: stock,
        minStock: e.minStock,
        priceHt: e.priceHt,
      ));
    }
    
    return products;
  }

  /// Load MP lots ordered by FIFO (oldest first)
  Future<List<Lot>> loadLotsMp({int? productId}) async {
    final entities = productId != null
        ? await _lotMpRepo.getByProductIdFifo(productId)
        : await _lotMpRepo.getAvailableLots();
    
    return entities.map((e) => Lot(
      id: e.id.toString(),
      productId: e.productId.toString(),
      lotNumber: e.lotNumber,
      quantity: e.quantity,
      productionDate: e.productionDate,
      expiryDate: e.expiryDate,
    )).toList();
  }

  /// Load PF lots ordered by FIFO (oldest first)
  Future<List<Lot>> loadLotsPf({int? productId}) async {
    final entities = productId != null
        ? await _lotPfRepo.getByProductIdFifo(productId)
        : await _lotPfRepo.getAvailableLots();
    
    return entities.map((e) => Lot(
      id: e.id.toString(),
      productId: e.productId.toString(),
      lotNumber: e.lotNumber,
      quantity: e.quantity,
      productionDate: e.productionDate,
      expiryDate: e.expiryDate,
    )).toList();
  }

  /// Get available stock for a specific PF product
  Future<int> getAvailableStockPf(int productId) async {
    return await _lotPfRepo.getTotalStockByProductId(productId);
  }

  /// Get available stock for a specific MP product
  Future<int> getAvailableStockMp(int productId) async {
    return await _lotMpRepo.getTotalStockByProductId(productId);
  }

  /// Check if sufficient stock exists for PF product
  Future<bool> hasSufficientStockPf(int productId, int quantity) async {
    final available = await getAvailableStockPf(productId);
    return available >= quantity;
  }
}
