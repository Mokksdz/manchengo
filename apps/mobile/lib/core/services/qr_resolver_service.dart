import '../data/sqlite/repositories/repositories.dart';
import '../qr/qr.dart';
import '../models/models.dart';
import 'errors.dart';

/// QR shortId → entity resolution service
/// 
/// Resolves QR codes to database entities.
/// No business logic, only lookup.
class QrResolverService {
  final LotMpRepository _lotMpRepo = LotMpRepository();
  final LotPfRepository _lotPfRepo = LotPfRepository();
  final ProductMpRepository _productMpRepo = ProductMpRepository();
  final ProductPfRepository _productPfRepo = ProductPfRepository();
  final ProductionOrderRepository _prodOrderRepo = ProductionOrderRepository();
  final ClientRepository _clientRepo = ClientRepository();

  /// Resolve MP lot by shortId (lot_number)
  /// 
  /// Returns lot with product info
  /// Throws [EntityNotFoundError] if not found
  Future<ResolvedLotMp> resolveLotMp(String shortId) async {
    final entity = await _lotMpRepo.getByLotNumber(shortId);
    if (entity == null) {
      throw EntityNotFoundError(
        entityType: 'Lot MP',
        entityId: shortId,
      );
    }

    final product = await _productMpRepo.getById(entity.productId);
    if (product == null) {
      throw EntityNotFoundError(
        entityType: 'Produit MP',
        entityId: entity.productId.toString(),
      );
    }

    return ResolvedLotMp(
      lot: Lot(
        id: entity.id.toString(),
        productId: entity.productId.toString(),
        lotNumber: entity.lotNumber,
        quantity: entity.quantity,
        productionDate: entity.productionDate,
        expiryDate: entity.expiryDate,
      ),
      productName: product.name,
      productCode: product.code,
      unit: product.unit,
    );
  }

  /// Resolve PF lot by shortId (lot_number)
  /// 
  /// Returns lot with product info
  /// Throws [EntityNotFoundError] if not found
  Future<ResolvedLotPf> resolveLotPf(String shortId) async {
    final entity = await _lotPfRepo.getByLotNumber(shortId);
    if (entity == null) {
      throw EntityNotFoundError(
        entityType: 'Lot PF',
        entityId: shortId,
      );
    }

    final product = await _productPfRepo.getById(entity.productId);
    if (product == null) {
      throw EntityNotFoundError(
        entityType: 'Produit PF',
        entityId: entity.productId.toString(),
      );
    }

    return ResolvedLotPf(
      lot: Lot(
        id: entity.id.toString(),
        productId: entity.productId.toString(),
        lotNumber: entity.lotNumber,
        quantity: entity.quantity,
        productionDate: entity.productionDate,
        expiryDate: entity.expiryDate,
      ),
      product: Product(
        id: product.id.toString(),
        code: product.code,
        name: product.name,
        unit: product.unit,
        isMp: false,
        currentStock: entity.quantity,
        minStock: product.minStock,
        priceHt: product.priceHt,
      ),
    );
  }

  /// Resolve production order by shortId (reference)
  /// 
  /// Throws [EntityNotFoundError] if not found
  /// Throws [ValidationError] if order is completed
  Future<ProductionOrder> resolveProductionOrder(String shortId) async {
    final entity = await _prodOrderRepo.getByReference(shortId);
    if (entity == null) {
      throw EntityNotFoundError(
        entityType: 'Ordre de production',
        entityId: shortId,
      );
    }

    if (entity.status == 'COMPLETED') {
      throw ValidationError(
        field: 'status',
        message: 'Cet ordre de production est déjà terminé',
      );
    }

    final product = await _productPfRepo.getById(entity.productId);

    return ProductionOrder(
      id: entity.id.toString(),
      reference: entity.reference,
      productId: entity.productId.toString(),
      productName: product?.name ?? 'Produit inconnu',
      plannedQuantity: entity.plannedQuantity,
      producedQuantity: entity.producedQuantity,
      date: entity.date,
      status: _mapStatus(entity.status),
      consumptions: [], // Loaded separately if needed
    );
  }

  /// Resolve client by shortId (code)
  /// 
  /// Throws [EntityNotFoundError] if not found
  Future<Client> resolveClient(String shortId) async {
    final entity = await _clientRepo.getByCode(shortId);
    if (entity == null) {
      throw EntityNotFoundError(
        entityType: 'Client',
        entityId: shortId,
      );
    }

    return Client(
      id: entity.id.toString(),
      code: entity.code,
      name: entity.name,
      type: entity.clientType,
      address: entity.address,
      phone: entity.phone,
    );
  }

  ProductionStatus _mapStatus(String status) {
    switch (status) {
      case 'PLANNED':
        return ProductionStatus.planned;
      case 'IN_PROGRESS':
        return ProductionStatus.inProgress;
      case 'COMPLETED':
        return ProductionStatus.completed;
      default:
        return ProductionStatus.planned;
    }
  }
}

/// Resolved MP lot with product details
class ResolvedLotMp {
  final Lot lot;
  final String productName;
  final String productCode;
  final String unit;

  const ResolvedLotMp({
    required this.lot,
    required this.productName,
    required this.productCode,
    required this.unit,
  });
}

/// Resolved PF lot with full product
class ResolvedLotPf {
  final Lot lot;
  final Product product;

  const ResolvedLotPf({
    required this.lot,
    required this.product,
  });
}
