/// Business logic errors for Manchengo Smart ERP
/// 
/// These errors are thrown by service layer and caught by UI for display.

/// Base class for all business errors
abstract class BusinessError implements Exception {
  final String message;
  final String code;
  
  const BusinessError(this.message, this.code);
  
  @override
  String toString() => '[$code] $message';
}

/// Thrown when stock is insufficient for an operation
class StockInsufficientError extends BusinessError {
  final String productName;
  final int requested;
  final int available;
  
  StockInsufficientError({
    required this.productName,
    required this.requested,
    required this.available,
  }) : super(
    'Stock insuffisant pour $productName: demandé $requested, disponible $available',
    'STOCK_INSUFFICIENT',
  );
}

/// Thrown when quantity is invalid (zero, negative, etc.)
class InvalidQuantityError extends BusinessError {
  final int quantity;
  
  InvalidQuantityError(this.quantity) : super(
    'Quantité invalide: $quantity. La quantité doit être positive.',
    'INVALID_QUANTITY',
  );
}

/// Thrown when user role is not authorized for an operation
class UnauthorizedRoleError extends BusinessError {
  final String role;
  final String operation;
  
  UnauthorizedRoleError({
    required this.role,
    required this.operation,
  }) : super(
    'Rôle $role non autorisé pour l\'opération: $operation',
    'UNAUTHORIZED_ROLE',
  );
}

/// Thrown when a required entity is not found
class EntityNotFoundError extends BusinessError {
  final String entityType;
  final String entityId;
  
  EntityNotFoundError({
    required this.entityType,
    required this.entityId,
  }) : super(
    '$entityType non trouvé: $entityId',
    'ENTITY_NOT_FOUND',
  );
}

/// Thrown when an operation fails validation
class ValidationError extends BusinessError {
  final String field;
  
  ValidationError({
    required this.field,
    required String message,
  }) : super(message, 'VALIDATION_ERROR');
}

/// Thrown when a transaction fails
class TransactionError extends BusinessError {
  TransactionError(String message) : super(message, 'TRANSACTION_ERROR');
}
