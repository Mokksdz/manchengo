/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ERP ERROR HANDLER - Frontend error processing for operators
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Transform API errors into actionable UI feedback
 * 
 * DESIGN PRINCIPLES:
 *   1. Never show raw technical errors to operators
 *   2. Always provide a clear action the user can take
 *   3. Maintain requestId for support correlation
 *   4. Different handling per error category
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export enum ErpErrorCategory {
  USER_ERROR = 'USER_ERROR',
  BUSINESS_RULE = 'BUSINESS_RULE',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface ErpErrorResponse {
  statusCode: number;
  error: string;           // Error code
  category: ErpErrorCategory;
  message: string;         // User-friendly message
  userAction?: string;     // What to do
  field?: string;          // Which field caused it
  context?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
}

export interface ProcessedError {
  category: ErpErrorCategory;
  title: string;
  message: string;
  action: string;
  field?: string;
  requestId?: string;
  canRetry: boolean;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Process API error response into UI-friendly format
 */
export function processApiError(error: unknown): ProcessedError {
  // Network error (no response)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      category: ErpErrorCategory.NETWORK_ERROR,
      title: 'Connexion impossible',
      message: 'Impossible de contacter le serveur',
      action: 'Vérifiez votre connexion internet et réessayez.',
      canRetry: true,
      severity: 'error',
    };
  }

  // API error response
  if (isErpErrorResponse(error)) {
    return processErpError(error);
  }

  // Axios/fetch error with response
  if (hasErrorResponse(error)) {
    const data = error.response?.data;
    if (isErpErrorResponse(data)) {
      return processErpError(data);
    }
  }

  // Unknown error
  return {
    category: ErpErrorCategory.UNKNOWN,
    title: 'Erreur inattendue',
    message: 'Une erreur inattendue est survenue',
    action: 'Réessayez. Si le problème persiste, contactez le support.',
    canRetry: true,
    severity: 'error',
  };
}

function processErpError(error: ErpErrorResponse): ProcessedError {
  const category = error.category || ErpErrorCategory.UNKNOWN;
  
  switch (category) {
    case ErpErrorCategory.USER_ERROR:
      return {
        category,
        title: 'Correction requise',
        message: error.message,
        action: error.userAction || 'Vérifiez les informations saisies.',
        field: error.field,
        requestId: error.requestId,
        canRetry: false,
        severity: 'warning',
      };

    case ErpErrorCategory.BUSINESS_RULE:
      return {
        category,
        title: 'Action non autorisée',
        message: error.message,
        action: error.userAction || 'Cette opération n\'est pas possible dans l\'état actuel.',
        field: error.field,
        requestId: error.requestId,
        canRetry: false,
        severity: 'error',
      };

    case ErpErrorCategory.SYSTEM_ERROR:
      return {
        category,
        title: 'Erreur système',
        message: 'Une erreur technique est survenue',
        action: error.userAction || 'Réessayez dans quelques instants.',
        requestId: error.requestId,
        canRetry: true,
        severity: 'error',
      };

    default:
      return {
        category: ErpErrorCategory.UNKNOWN,
        title: 'Erreur',
        message: error.message || 'Une erreur est survenue',
        action: 'Réessayez ou contactez le support.',
        requestId: error.requestId,
        canRetry: true,
        severity: 'error',
      };
  }
}

// Type guards
function isErpErrorResponse(obj: unknown): obj is ErpErrorResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'statusCode' in obj &&
    'message' in obj
  );
}

function hasErrorResponse(obj: unknown): obj is { response?: { data?: unknown } } {
  return typeof obj === 'object' && obj !== null && 'response' in obj;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CODE → USER MESSAGE MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

export const ERROR_MESSAGES: Record<string, { title: string; message: string; action: string }> = {
  // Stock
  INSUFFICIENT_STOCK: {
    title: 'Stock insuffisant',
    message: 'La quantité demandée dépasse le stock disponible',
    action: 'Réduisez la quantité ou attendez une nouvelle réception.',
  },
  INVALID_MOVEMENT_COMBINATION: {
    title: 'Opération non autorisée',
    message: 'Ce type de mouvement n\'est pas permis pour ce produit',
    action: 'Vérifiez le type de produit et l\'opération sélectionnée.',
  },
  
  // Authorization
  ROLE_NOT_AUTHORIZED: {
    title: 'Accès refusé',
    message: 'Vous n\'avez pas les droits pour cette action',
    action: 'Contactez votre administrateur si nécessaire.',
  },
  
  // Production
  INVALID_STATE_TRANSITION: {
    title: 'Transition impossible',
    message: 'L\'ordre ne peut pas passer à cet état',
    action: 'Vérifiez l\'état actuel avant de continuer.',
  },
  PRODUCTION_BLOCKED: {
    title: 'Production bloquée',
    message: 'Impossible de démarrer la production',
    action: 'Vérifiez les stocks de matières premières.',
  },
  ORDER_ALREADY_COMPLETED: {
    title: 'Ordre terminé',
    message: 'Cet ordre de production est déjà terminé',
    action: 'Créez un nouvel ordre si nécessaire.',
  },
  ORDER_ALREADY_CANCELLED: {
    title: 'Ordre annulé',
    message: 'Cet ordre a été annulé',
    action: 'Créez un nouvel ordre si nécessaire.',
  },
  
  // Input validation
  NEGATIVE_QUANTITY: {
    title: 'Quantité invalide',
    message: 'La quantité doit être positive',
    action: 'Entrez un nombre supérieur à zéro.',
  },
  THRESHOLD_INVALID: {
    title: 'Seuils invalides',
    message: 'Le seuil de commande doit être supérieur au seuil de sécurité',
    action: 'Ajustez les valeurs des seuils.',
  },
  
  // Not found
  RECIPE_NOT_FOUND: {
    title: 'Recette introuvable',
    message: 'La recette demandée n\'existe pas',
    action: 'Sélectionnez une recette active.',
  },
  PRODUCT_NOT_FOUND: {
    title: 'Produit introuvable',
    message: 'Le produit demandé n\'existe pas',
    action: 'Vérifiez le code produit.',
  },
  
  // System
  DATABASE_ERROR: {
    title: 'Erreur base de données',
    message: 'Problème d\'accès aux données',
    action: 'Réessayez dans quelques instants.',
  },
  SERVICE_UNAVAILABLE: {
    title: 'Service indisponible',
    message: 'Le service est temporairement indisponible',
    action: 'Réessayez dans quelques instants.',
  },
  TIMEOUT: {
    title: 'Délai dépassé',
    message: 'L\'opération a pris trop de temps',
    action: 'Réessayez ou contactez le support.',
  },
};
