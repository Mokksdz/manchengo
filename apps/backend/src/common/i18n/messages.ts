/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CENTRALIZED I18N MESSAGES — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R14: Centralisation i18n backend
 *
 * All user-facing messages in one place for easy maintenance and future
 * multi-language support. Messages are in French (primary language for
 * Algerian dairy industry users).
 *
 * Usage:
 *   import { MSG } from '../common/i18n/messages';
 *   throw new BadRequestException(MSG.AUTH.INVALID_CREDENTIALS);
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export const MSG = {
  // ── Authentication ──
  AUTH: {
    INVALID_CREDENTIALS: 'Identifiants invalides',
    ACCOUNT_DISABLED: 'Compte désactivé',
    TOKEN_EXPIRED: 'Session expirée. Veuillez vous reconnecter.',
    TOKEN_INVALID: 'Token de rafraîchissement invalide',
    NO_REFRESH_TOKEN: 'Aucun token de rafraîchissement fourni',
    USER_NOT_FOUND: 'Utilisateur invalide',
    EMAIL_OR_CODE_EXISTS: 'Email ou code déjà utilisé',
    PASSWORD_TOO_SHORT: (min: number) => `Le mot de passe doit contenir au moins ${min} caractères`,
    PASSWORD_NO_UPPERCASE: 'Le mot de passe doit contenir au moins une majuscule',
    PASSWORD_NO_DIGIT: 'Le mot de passe doit contenir au moins un chiffre',
    PASSWORD_SAME: "Le nouveau mot de passe doit être différent de l'ancien",
    PASSWORD_CURRENT_INVALID: 'Mot de passe actuel incorrect',
    PASSWORD_CHANGED: 'Mot de passe modifié avec succès',
    MUST_CHANGE_PASSWORD: 'Vous devez changer votre mot de passe par défaut',
    LOGIN_SUCCESS: 'Connexion réussie',
    LOGOUT_SUCCESS: 'Déconnecté avec succès',
    TOKEN_REFRESHED: 'Token renouvelé avec succès',
  },

  // ── Authorization ──
  ACCESS: {
    DENIED: "Accès non configuré — contactez l'administrateur",
    FORBIDDEN: "Vous n'avez pas les droits pour cette action",
    ROLE_REQUIRED: (roles: string[]) => `Rôle requis: ${roles.join(', ')}`,
  },

  // ── Validation ──
  VALIDATION: {
    REQUIRED_FIELD: (field: string) => `Le champ ${field} est obligatoire`,
    INVALID_DATE_RANGE: 'La date de début doit être antérieure à la date de fin',
    INVALID_FORMAT: (field: string) => `Format invalide pour ${field}`,
    VALUE_OUT_OF_RANGE: (field: string, min: number, max: number) =>
      `${field} doit être entre ${min} et ${max}`,
  },

  // ── Stock ──
  STOCK: {
    PRODUCT_NOT_FOUND: 'Produit introuvable',
    LOT_NOT_FOUND: 'Lot introuvable',
    INSUFFICIENT_STOCK: 'Stock insuffisant',
    LOT_EXPIRED: 'Ce lot est expiré',
    LOT_BLOCKED: 'Ce lot est bloqué',
    MOVEMENT_CREATED: 'Mouvement de stock créé',
  },

  // ── Production ──
  PRODUCTION: {
    ORDER_NOT_FOUND: 'Ordre de production introuvable',
    RECIPE_NOT_FOUND: 'Recette introuvable',
    ALREADY_COMPLETED: 'Cet ordre est déjà terminé',
    BATCH_COUNT_INVALID: 'Le nombre de batchs doit être entre 1 et 1000',
    QUANTITY_INVALID: 'La quantité produite doit être supérieure à 0',
  },

  // ── Delivery ──
  DELIVERY: {
    NOT_FOUND: 'Livraison introuvable',
    ALREADY_VALIDATED: 'Livraison déjà validée',
    ALREADY_CANCELLED: 'Livraison déjà annulée',
    INVALID_QR: 'QR code invalide ou corrompu',
    VALIDATED: 'Livraison validée avec succès',
    CANCELLED: 'Livraison annulée',
  },

  // ── Appro ──
  APPRO: {
    DEMANDE_NOT_FOUND: 'Demande introuvable',
    DEMANDE_LOCKED: 'Cette demande est verrouillée par un autre utilisateur',
    BC_CREATED: 'Bon de commande créé avec succès',
    SUPPLIER_NOT_FOUND: 'Fournisseur introuvable',
  },

  // ── Dashboard ──
  DASHBOARD: {
    CRITICAL_ALERTS: (count: number) =>
      count > 0
        ? `${count} action(s) critique(s) requise(s)`
        : 'Aucune alerte critique',
    HEALTH_EXCELLENT: 'Continuez ainsi. Stock bien géré.',
    HEALTH_GOOD: "Quelques points à surveiller. Vérifiez les alertes.",
    HEALTH_WARNING: 'Plusieurs problèmes détectés. Traitez les alertes rapidement.',
    HEALTH_CRITICAL: 'Situation urgente. Actions immédiates requises.',
  },

  // ── Errors ──
  ERRORS: {
    INTERNAL: "Une erreur interne est survenue. Contactez l'administrateur.",
    NOT_FOUND: 'Ressource introuvable',
    RATE_LIMITED: 'Trop de requêtes. Réessayez dans quelques instants.',
    CONFLICT: 'Conflit détecté. Les données ont été modifiées par un autre utilisateur.',
  },
} as const;
