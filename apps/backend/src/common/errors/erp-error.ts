import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ERP ERROR TAXONOMY - Structured errors for operator understanding
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Every error must be:
 *   1. UNDERSTANDABLE by non-technical operators
 *   2. ACTIONABLE - user knows what to do
 *   3. TRACEABLE - links to audit if needed
 * 
 * CATEGORIES:
 *   - USER_ERROR: User can fix it themselves
 *   - BUSINESS_RULE: System correctly blocked an invalid action
 *   - SYSTEM_ERROR: Technical issue, user should retry or contact support
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export enum ErpErrorCategory {
  USER_ERROR = 'USER_ERROR',           // User input issue, fixable
  BUSINESS_RULE = 'BUSINESS_RULE',     // Business logic blocked action
  SYSTEM_ERROR = 'SYSTEM_ERROR',       // Technical failure
}

export enum ErpErrorCode {
  // ═══════════════════════════════════════════════════════════════════════════
  // USER_ERROR - User can fix
  // ═══════════════════════════════════════════════════════════════════════════
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS_RULE - System correctly blocked
  // ═══════════════════════════════════════════════════════════════════════════
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVALID_MOVEMENT_COMBINATION = 'INVALID_MOVEMENT_COMBINATION',
  ROLE_NOT_AUTHORIZED = 'ROLE_NOT_AUTHORIZED',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  PRODUCTION_BLOCKED = 'PRODUCTION_BLOCKED',
  ORDER_ALREADY_COMPLETED = 'ORDER_ALREADY_COMPLETED',
  ORDER_ALREADY_CANCELLED = 'ORDER_ALREADY_CANCELLED',
  NEGATIVE_QUANTITY = 'NEGATIVE_QUANTITY',
  THRESHOLD_INVALID = 'THRESHOLD_INVALID',
  RECIPE_NOT_FOUND = 'RECIPE_NOT_FOUND',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  LOT_EXPIRED = 'LOT_EXPIRED',
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM_ERROR - Technical issues
  // ═══════════════════════════════════════════════════════════════════════════
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT = 'TIMEOUT',
}

export interface ErpErrorPayload {
  code: ErpErrorCode;
  category: ErpErrorCategory;
  message: string;           // Technical message (for logs)
  userMessage: string;       // Message for the operator
  userAction?: string;       // What the user should do
  field?: string;            // Which field caused the error
  context?: Record<string, unknown>;  // Additional context
  requestId?: string;        // For support/audit correlation
}

/**
 * Structured ERP Exception
 * 
 * Usage:
 * throw new ErpException({
 *   code: ErpErrorCode.INSUFFICIENT_STOCK,
 *   category: ErpErrorCategory.BUSINESS_RULE,
 *   message: 'Stock insuffisant: disponible 50, requis 100',
 *   userMessage: 'Stock insuffisant pour cette opération',
 *   userAction: 'Réduisez la quantité ou attendez une réception',
 *   context: { available: 50, requested: 100 }
 * });
 */
export class ErpException extends HttpException {
  public readonly payload: ErpErrorPayload;

  constructor(payload: ErpErrorPayload, status?: HttpStatus) {
    const httpStatus = status || ErpException.getHttpStatus(payload.category);
    
    super(
      {
        statusCode: httpStatus,
        error: payload.code,
        category: payload.category,
        message: payload.userMessage,
        userAction: payload.userAction,
        field: payload.field,
        context: payload.context,
        requestId: payload.requestId,
        timestamp: new Date().toISOString(),
      },
      httpStatus,
    );
    
    this.payload = payload;
  }

  private static getHttpStatus(category: ErpErrorCategory): HttpStatus {
    switch (category) {
      case ErpErrorCategory.USER_ERROR:
        return HttpStatus.BAD_REQUEST;
      case ErpErrorCategory.BUSINESS_RULE:
        return HttpStatus.UNPROCESSABLE_ENTITY;
      case ErpErrorCategory.SYSTEM_ERROR:
        return HttpStatus.INTERNAL_SERVER_ERROR;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS - Consistent error creation
// ═══════════════════════════════════════════════════════════════════════════════

export const ErpErrors = {
  // Stock errors
  insufficientStock: (available: number, requested: number, productName?: string) =>
    new ErpException({
      code: ErpErrorCode.INSUFFICIENT_STOCK,
      category: ErpErrorCategory.BUSINESS_RULE,
      message: `Stock insuffisant: disponible ${available}, requis ${requested}`,
      userMessage: productName 
        ? `Stock insuffisant pour "${productName}"`
        : 'Stock insuffisant pour cette opération',
      userAction: 'Réduisez la quantité demandée ou attendez une nouvelle réception.',
      context: { available, requested, productName },
    }),

  invalidMovementCombination: (productType: string, origin: string, movementType: string) =>
    new ErpException({
      code: ErpErrorCode.INVALID_MOVEMENT_COMBINATION,
      category: ErpErrorCategory.BUSINESS_RULE,
      message: `Combinaison interdite: ${productType}/${origin}/${movementType}`,
      userMessage: `Cette opération n'est pas autorisée pour ce type de produit`,
      userAction: 'Vérifiez le type de mouvement sélectionné.',
      context: { productType, origin, movementType },
    }),

  roleNotAuthorized: (userRole: string, requiredRoles: string[], action: string) =>
    new ErpException({
      code: ErpErrorCode.ROLE_NOT_AUTHORIZED,
      category: ErpErrorCategory.BUSINESS_RULE,
      message: `Role ${userRole} non autorisé pour ${action}`,
      userMessage: `Vous n'êtes pas autorisé à effectuer cette action`,
      userAction: 'Contactez votre administrateur si vous pensez que c\'est une erreur.',
      context: { userRole, requiredRoles, action },
    }, HttpStatus.FORBIDDEN),

  invalidStateTransition: (currentState: string, targetState: string, entityType: string) =>
    new ErpException({
      code: ErpErrorCode.INVALID_STATE_TRANSITION,
      category: ErpErrorCategory.BUSINESS_RULE,
      message: `Transition invalide: ${currentState} → ${targetState}`,
      userMessage: `Impossible de passer de "${currentState}" à "${targetState}"`,
      userAction: 'Vérifiez l\'état actuel de l\'élément avant de continuer.',
      context: { currentState, targetState, entityType },
    }),

  productionBlocked: (reason: string, missingMp?: string[]) =>
    new ErpException({
      code: ErpErrorCode.PRODUCTION_BLOCKED,
      category: ErpErrorCategory.BUSINESS_RULE,
      message: `Production bloquée: ${reason}`,
      userMessage: 'La production ne peut pas démarrer',
      userAction: missingMp?.length 
        ? `Matières premières manquantes: ${missingMp.join(', ')}`
        : 'Vérifiez les stocks de matières premières.',
      context: { reason, missingMp },
    }),

  negativeQuantity: () =>
    new ErpException({
      code: ErpErrorCode.NEGATIVE_QUANTITY,
      category: ErpErrorCategory.USER_ERROR,
      message: 'Quantité négative ou nulle',
      userMessage: 'La quantité doit être supérieure à zéro',
      userAction: 'Entrez une quantité positive.',
      field: 'quantity',
    }),

  invalidThreshold: (seuilSecurite: number, seuilCommande: number) =>
    new ErpException({
      code: ErpErrorCode.THRESHOLD_INVALID,
      category: ErpErrorCategory.USER_ERROR,
      message: `seuilCommande (${seuilCommande}) doit être > seuilSecurite (${seuilSecurite})`,
      userMessage: 'Le seuil de commande doit être supérieur au seuil de sécurité',
      userAction: 'Ajustez les seuils pour que le seuil de commande soit plus élevé.',
      context: { seuilSecurite, seuilCommande },
    }),

  recipeNotFound: (recipeId: number) =>
    new ErpException({
      code: ErpErrorCode.RECIPE_NOT_FOUND,
      category: ErpErrorCategory.BUSINESS_RULE,
      message: `Recette ${recipeId} non trouvée`,
      userMessage: 'La recette demandée n\'existe pas ou a été désactivée',
      userAction: 'Sélectionnez une recette active.',
      context: { recipeId },
    }, HttpStatus.NOT_FOUND),

  orderAlreadyCompleted: (orderId: string) =>
    new ErpException({
      code: ErpErrorCode.ORDER_ALREADY_COMPLETED,
      category: ErpErrorCategory.BUSINESS_RULE,
      message: `Ordre ${orderId} déjà terminé`,
      userMessage: 'Cet ordre de production est déjà terminé',
      userAction: 'Créez un nouvel ordre si nécessaire.',
      context: { orderId },
    }),

  orderAlreadyCancelled: (orderId: string) =>
    new ErpException({
      code: ErpErrorCode.ORDER_ALREADY_CANCELLED,
      category: ErpErrorCategory.BUSINESS_RULE,
      message: `Ordre ${orderId} déjà annulé`,
      userMessage: 'Cet ordre de production a été annulé',
      userAction: 'Créez un nouvel ordre si nécessaire.',
      context: { orderId },
    }),

  // System errors
  databaseError: (operation: string) =>
    new ErpException({
      code: ErpErrorCode.DATABASE_ERROR,
      category: ErpErrorCategory.SYSTEM_ERROR,
      message: `Erreur base de données: ${operation}`,
      userMessage: 'Une erreur technique est survenue',
      userAction: 'Réessayez dans quelques instants. Si le problème persiste, contactez le support.',
    }),

  serviceUnavailable: (service: string) =>
    new ErpException({
      code: ErpErrorCode.SERVICE_UNAVAILABLE,
      category: ErpErrorCategory.SYSTEM_ERROR,
      message: `Service indisponible: ${service}`,
      userMessage: 'Le service est temporairement indisponible',
      userAction: 'Réessayez dans quelques instants.',
    }, HttpStatus.SERVICE_UNAVAILABLE),

  timeout: (operation: string) =>
    new ErpException({
      code: ErpErrorCode.TIMEOUT,
      category: ErpErrorCategory.SYSTEM_ERROR,
      message: `Timeout: ${operation}`,
      userMessage: 'L\'opération a pris trop de temps',
      userAction: 'Réessayez. Si le problème persiste, contactez le support.',
    }, HttpStatus.REQUEST_TIMEOUT),
};
