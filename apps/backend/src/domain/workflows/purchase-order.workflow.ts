import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PURCHASE ORDER (BC) — STATE MACHINE EXÉCUTABLE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * SOURCE DE VÉRITÉ UNIQUE pour toutes les transitions de statut BC.
 * AUCUN update({ status }) n'est autorisé sans passer par assertCanTransition()
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SENT'
  | 'CONFIRMED'
  | 'PARTIAL'
  | 'RECEIVED'
  | 'CANCELLED';

export type Role = 'ADMIN' | 'APPRO' | 'PRODUCTION' | 'SYSTEM';

export interface TransitionRule {
  from: PurchaseOrderStatus;
  to: PurchaseOrderStatus;
  roles: Role[];
  irreversible?: boolean;
  requiresMotif?: boolean;
  blockIfPartialReceived?: boolean;
  action: string;
}

export const PURCHASE_ORDER_TRANSITIONS: TransitionRule[] = [
  { 
    from: 'DRAFT', 
    to: 'SENT', 
    roles: ['APPRO', 'ADMIN'],
    irreversible: true,
    action: 'envoyer',
  },
  { 
    from: 'DRAFT', 
    to: 'CANCELLED', 
    roles: ['ADMIN'],
    requiresMotif: true,
    action: 'annuler',
  },
  { 
    from: 'SENT', 
    to: 'CONFIRMED', 
    roles: ['APPRO', 'ADMIN'],
    action: 'confirmer',
  },
  { 
    from: 'SENT', 
    to: 'PARTIAL', 
    roles: ['APPRO', 'ADMIN'],
    action: 'receptionner',
  },
  { 
    from: 'SENT', 
    to: 'RECEIVED', 
    roles: ['APPRO', 'ADMIN'],
    irreversible: true,
    action: 'receptionner',
  },
  { 
    from: 'SENT', 
    to: 'CANCELLED', 
    roles: ['ADMIN'],
    requiresMotif: true,
    blockIfPartialReceived: true,
    action: 'annuler',
  },
  { 
    from: 'CONFIRMED', 
    to: 'PARTIAL', 
    roles: ['APPRO', 'ADMIN'],
    action: 'receptionner',
  },
  { 
    from: 'CONFIRMED', 
    to: 'RECEIVED', 
    roles: ['APPRO', 'ADMIN'],
    irreversible: true,
    action: 'receptionner',
  },
  { 
    from: 'CONFIRMED', 
    to: 'CANCELLED', 
    roles: ['ADMIN'],
    requiresMotif: true,
    blockIfPartialReceived: true,
    action: 'annuler',
  },
  { 
    from: 'PARTIAL', 
    to: 'PARTIAL', 
    roles: ['APPRO', 'ADMIN'],
    action: 'receptionner',
  },
  { 
    from: 'PARTIAL', 
    to: 'RECEIVED', 
    roles: ['APPRO', 'ADMIN'],
    irreversible: true,
    action: 'receptionner',
  },
];

export const TERMINAL_STATUSES: PurchaseOrderStatus[] = ['RECEIVED', 'CANCELLED'];
export const IRREVERSIBLE_STATUSES: PurchaseOrderStatus[] = ['SENT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CANCELLED'];

/**
 * Vérifie si une transition est autorisée et retourne la règle
 */
export function assertCanTransition({
  from,
  to,
  role,
  motif,
  hasPartialReceived,
}: {
  from: PurchaseOrderStatus;
  to: PurchaseOrderStatus;
  role: Role;
  motif?: string;
  hasPartialReceived?: boolean;
}): TransitionRule {
  const rule = PURCHASE_ORDER_TRANSITIONS.find(
    (t) => t.from === from && t.to === to,
  );

  if (!rule) {
    const allowedTransitions = PURCHASE_ORDER_TRANSITIONS
      .filter(t => t.from === from)
      .map(t => t.to);
    
    throw new BadRequestException({
      code: 'INVALID_TRANSITION',
      message: `Transition interdite: ${from} → ${to}`,
      currentStatus: from,
      requestedStatus: to,
      allowedTransitions: [...new Set(allowedTransitions)],
    });
  }

  if (!rule.roles.includes(role) && role !== 'ADMIN') {
    throw new ForbiddenException({
      code: 'ROLE_NOT_AUTHORIZED',
      message: `Rôle ${role} non autorisé pour cette transition`,
      requiredRoles: rule.roles,
    });
  }

  if (rule.requiresMotif && (!motif || motif.trim().length < 10)) {
    throw new BadRequestException({
      code: 'MOTIF_REQUIRED',
      message: 'Motif obligatoire (minimum 10 caractères)',
    });
  }

  if (rule.blockIfPartialReceived && hasPartialReceived) {
    throw new BadRequestException({
      code: 'CANNOT_CANCEL_PARTIAL',
      message: 'Annulation impossible: réception partielle déjà effectuée',
    });
  }

  return rule;
}

/**
 * Vérifie si un statut est terminal
 */
export function isTerminalStatus(status: PurchaseOrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Vérifie si un statut est irréversible
 */
export function isIrreversibleStatus(status: PurchaseOrderStatus): boolean {
  return IRREVERSIBLE_STATUSES.includes(status);
}

/**
 * Retourne les transitions possibles depuis un statut donné
 */
export function getAvailableTransitions(
  from: PurchaseOrderStatus,
  role: Role,
  hasPartialReceived = false,
): TransitionRule[] {
  return PURCHASE_ORDER_TRANSITIONS.filter(
    (t) => 
      t.from === from && 
      (t.roles.includes(role) || role === 'ADMIN') &&
      !(t.blockIfPartialReceived && hasPartialReceived),
  );
}

/**
 * Retourne les actions disponibles pour un utilisateur sur un BC
 */
export function getAvailableActions(
  status: PurchaseOrderStatus,
  role: Role,
  hasPartialReceived = false,
): string[] {
  return [...new Set(
    getAvailableTransitions(status, role, hasPartialReceived).map(t => t.action)
  )];
}
