import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DEMANDE APPRO — STATE MACHINE EXÉCUTABLE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * SOURCE DE VÉRITÉ UNIQUE pour toutes les transitions de statut.
 * AUCUN update({ status }) n'est autorisé sans passer par assertCanTransition()
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export type DemandeStatus =
  | 'BROUILLON'
  | 'SOUMISE'
  | 'VALIDEE'
  | 'REJETEE'
  | 'EN_COURS_COMMANDE'
  | 'COMMANDEE'
  | 'RECEPTIONNEE';

export type Role = 'ADMIN' | 'APPRO' | 'PRODUCTION' | 'SYSTEM';

export interface TransitionRule {
  from: DemandeStatus;
  to: DemandeStatus;
  roles: Role[];
  irreversible?: boolean;
  requiresMotif?: boolean;
  action: string;
}

export const DEMANDE_APPRO_TRANSITIONS: TransitionRule[] = [
  { 
    from: 'BROUILLON', 
    to: 'SOUMISE', 
    roles: ['PRODUCTION', 'ADMIN'],
    action: 'soumettre',
  },
  { 
    from: 'SOUMISE', 
    to: 'VALIDEE', 
    roles: ['APPRO', 'ADMIN'],
    action: 'valider',
  },
  { 
    from: 'SOUMISE', 
    to: 'REJETEE', 
    roles: ['APPRO', 'ADMIN'],
    requiresMotif: true,
    action: 'rejeter',
  },
  { 
    from: 'VALIDEE', 
    to: 'EN_COURS_COMMANDE', 
    roles: ['APPRO', 'ADMIN'], 
    irreversible: true,
    action: 'genererBc',
  },
  { 
    from: 'VALIDEE', 
    to: 'REJETEE', 
    roles: ['ADMIN'],
    requiresMotif: true,
    action: 'annulerValidation',
  },
  { 
    from: 'EN_COURS_COMMANDE', 
    to: 'COMMANDEE', 
    roles: ['SYSTEM'], 
    irreversible: true,
    action: 'bcEnvoye',
  },
  { 
    from: 'COMMANDEE', 
    to: 'RECEPTIONNEE', 
    roles: ['SYSTEM'], 
    irreversible: true,
    action: 'bcReceptionne',
  },
];

export const TERMINAL_STATUSES: DemandeStatus[] = ['RECEPTIONNEE'];
export const IRREVERSIBLE_STATUSES: DemandeStatus[] = ['EN_COURS_COMMANDE', 'COMMANDEE', 'RECEPTIONNEE'];

/**
 * Vérifie si une transition est autorisée et retourne la règle
 * @throws BadRequestException si transition interdite
 * @throws ForbiddenException si rôle non autorisé
 */
export function assertCanTransition({
  from,
  to,
  role,
  motif,
}: {
  from: DemandeStatus;
  to: DemandeStatus;
  role: Role;
  motif?: string;
}): TransitionRule {
  const rule = DEMANDE_APPRO_TRANSITIONS.find(
    (t) => t.from === from && t.to === to,
  );

  if (!rule) {
    const allowedTransitions = DEMANDE_APPRO_TRANSITIONS
      .filter(t => t.from === from)
      .map(t => t.to);
    
    throw new BadRequestException({
      code: 'INVALID_TRANSITION',
      message: `Transition interdite: ${from} → ${to}`,
      currentStatus: from,
      requestedStatus: to,
      allowedTransitions,
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

  return rule;
}

/**
 * Vérifie si un statut est terminal (aucune transition possible)
 */
export function isTerminalStatus(status: DemandeStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Vérifie si un statut est irréversible
 */
export function isIrreversibleStatus(status: DemandeStatus): boolean {
  return IRREVERSIBLE_STATUSES.includes(status);
}

/**
 * Retourne les transitions possibles depuis un statut donné
 */
export function getAvailableTransitions(
  from: DemandeStatus,
  role: Role,
): TransitionRule[] {
  return DEMANDE_APPRO_TRANSITIONS.filter(
    (t) => t.from === from && (t.roles.includes(role) || role === 'ADMIN'),
  );
}

/**
 * Retourne les actions disponibles pour un utilisateur sur une demande
 */
export function getAvailableActions(
  status: DemandeStatus,
  role: Role,
): string[] {
  return getAvailableTransitions(status, role).map(t => t.action);
}
