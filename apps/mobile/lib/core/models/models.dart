export 'user.dart';

/// Sync status enum
enum SyncStatus { synced, syncing, offline, error }

/// Stock status enum
enum StockStatus { ok, low, critical, empty }

/// Payment method enum
enum PaymentMethod { especes, cheque, virement }

extension PaymentMethodExtension on PaymentMethod {
  String get label {
    switch (this) {
      case PaymentMethod.especes:
        return 'ESPÈCES';
      case PaymentMethod.cheque:
        return 'CHÈQUE';
      case PaymentMethod.virement:
        return 'VIREMENT';
    }
  }
}

/// Production order status
enum ProductionStatus { planned, inProgress, completed }

extension ProductionStatusExtension on ProductionStatus {
  String get label {
    switch (this) {
      case ProductionStatus.planned:
        return 'Prévu';
      case ProductionStatus.inProgress:
        return 'En cours';
      case ProductionStatus.completed:
        return 'Terminé';
    }
  }
}

/// Invoice status
enum InvoiceStatus { unpaid, partial, paid }

extension InvoiceStatusExtension on InvoiceStatus {
  String get label {
    switch (this) {
      case InvoiceStatus.unpaid:
        return 'Impayée';
      case InvoiceStatus.partial:
        return 'Partielle';
      case InvoiceStatus.paid:
        return 'Payée';
    }
  }
}

/// Supplier model
class Supplier {
  final String id;
  final String code;
  final String name;
  final String? phone;
  final String? nif;

  const Supplier({
    required this.id,
    required this.code,
    required this.name,
    this.phone,
    this.nif,
  });
}

/// Client model
class Client {
  final String id;
  final String code;
  final String name;
  final String type;
  final String? phone;
  final String? nif;

  const Client({
    required this.id,
    required this.code,
    required this.name,
    required this.type,
    this.phone,
    this.nif,
  });
}

/// Product (MP or PF)
class Product {
  final String id;
  final String code;
  final String name;
  final String unit;
  final bool isMp;
  final int currentStock;
  final int minStock;
  final int priceHt;

  const Product({
    required this.id,
    required this.code,
    required this.name,
    required this.unit,
    required this.isMp,
    this.currentStock = 0,
    this.minStock = 0,
    this.priceHt = 0,
  });

  StockStatus get stockStatus {
    if (currentStock == 0) return StockStatus.empty;
    if (minStock == 0) return StockStatus.ok;
    final ratio = currentStock / minStock;
    if (ratio < 0.2) return StockStatus.critical;
    if (ratio < 0.5) return StockStatus.low;
    return StockStatus.ok;
  }
}

/// Lot (for FIFO)
class Lot {
  final String id;
  final String productId;
  final String lotNumber;
  final int quantity;
  final DateTime productionDate;
  final DateTime? expiryDate;

  const Lot({
    required this.id,
    required this.productId,
    required this.lotNumber,
    required this.quantity,
    required this.productionDate,
    this.expiryDate,
  });
}

/// Reception note
class ReceptionNote {
  final String id;
  final String reference;
  final String supplierId;
  final String supplierBl;
  final DateTime date;
  final List<ReceptionLine> lines;

  const ReceptionNote({
    required this.id,
    required this.reference,
    required this.supplierId,
    required this.supplierBl,
    required this.date,
    required this.lines,
  });
}

class ReceptionLine {
  final String productId;
  final String productName;
  final int quantity;
  final String unit;

  const ReceptionLine({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unit,
  });
}

/// Production order
class ProductionOrder {
  final String id;
  final String reference;
  final String productId;
  final String productName;
  final int plannedQuantity;
  final int? producedQuantity;
  final ProductionStatus status;
  final DateTime date;
  final List<MpConsumption> consumptions;

  const ProductionOrder({
    required this.id,
    required this.reference,
    required this.productId,
    required this.productName,
    required this.plannedQuantity,
    this.producedQuantity,
    required this.status,
    required this.date,
    this.consumptions = const [],
  });
}

class MpConsumption {
  final String lotId;
  final String lotNumber;
  final String productName;
  final int quantity;
  final String unit;

  const MpConsumption({
    required this.lotId,
    required this.lotNumber,
    required this.productName,
    required this.quantity,
    required this.unit,
  });
}

/// Sales order
class SalesOrder {
  final String id;
  final String reference;
  final String clientId;
  final String clientName;
  final DateTime date;
  final List<SalesLine> lines;
  final int totalHt;
  final int totalTva;
  final int totalTtc;

  const SalesOrder({
    required this.id,
    required this.reference,
    required this.clientId,
    required this.clientName,
    required this.date,
    required this.lines,
    required this.totalHt,
    required this.totalTva,
    required this.totalTtc,
  });
}

class SalesLine {
  final String productId;
  final String productName;
  final int quantity;
  final int unitPriceHt;
  final int lineHt;

  const SalesLine({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPriceHt,
    required this.lineHt,
  });
}

/// Invoice
class Invoice {
  final String id;
  final String reference;
  final String clientId;
  final String clientName;
  final String? clientNif;
  final DateTime date;
  final List<SalesLine> lines;
  final int totalHt;
  final int totalTva;
  final int totalTtc;
  final PaymentMethod paymentMethod;
  final int timbreFiscal;
  final int netToPay;
  final InvoiceStatus status;

  const Invoice({
    required this.id,
    required this.reference,
    required this.clientId,
    required this.clientName,
    this.clientNif,
    required this.date,
    required this.lines,
    required this.totalHt,
    required this.totalTva,
    required this.totalTtc,
    required this.paymentMethod,
    required this.timbreFiscal,
    required this.netToPay,
    required this.status,
  });
}

/// Sync queue item
class SyncQueueItem {
  final String id;
  final String type;
  final String reference;
  final DateTime createdAt;
  final bool hasError;
  final String? errorMessage;

  const SyncQueueItem({
    required this.id,
    required this.type,
    required this.reference,
    required this.createdAt,
    this.hasError = false,
    this.errorMessage,
  });
}

/// Activity item for dashboard
class ActivityItem {
  final String id;
  final String type;
  final String reference;
  final DateTime timestamp;
  final String userName;
  final bool isCompleted;

  const ActivityItem({
    required this.id,
    required this.type,
    required this.reference,
    required this.timestamp,
    required this.userName,
    this.isCompleted = true,
  });
}
