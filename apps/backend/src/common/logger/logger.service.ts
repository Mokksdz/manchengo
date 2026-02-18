import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';

// ═══════════════════════════════════════════════════════════════════════════════
// MANCHENGO ERP — PRODUCTION LOGGER
// ═══════════════════════════════════════════════════════════════════════════════
// Objectif: Diagnostic clair d'un incident à 3h du matin
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Contexte métier pour les logs business
 */
export interface BusinessLogContext {
  userId?: string;
  userEmail?: string;
  entityType?: 'DEMANDE' | 'PURCHASE_ORDER' | 'LOT_MP' | 'LOT_PF' | 'RECEPTION' | 'PRODUCTION' | 'DELIVERY' | 'INVOICE';
  entityId?: string | number;
  action?: string;
  correlationId?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Contexte technique pour les logs système
 */
export interface TechnicalLogContext {
  service?: string;
  method?: string;
  correlationId?: string;
  duration?: number;
  error?: Error | unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * RÈGLES DE LOGGING — MANCHENGO ERP
 * 
 * ✅ À LOGGER:
 * - INFO: Actions métier réussies (création, validation, transition état)
 * - WARN: Situations anormales mais gérées (retry, fallback, seuil atteint)
 * - ERROR: Échecs bloquants nécessitant intervention
 * 
 * ❌ NE JAMAIS LOGGER:
 * - Mots de passe, tokens, clés API
 * - Données personnelles sensibles (adresses, téléphones)
 * - Corps de requête complets (risque de données sensibles)
 * - Logs de debug en production
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: Logger;
  private readonly businessLogger: Logger;
  private context: string = 'Application';

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

    // Logger technique (système, infra)
    this.logger = pino({
      level: logLevel,
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
      base: {
        env: process.env.NODE_ENV || 'development',
        type: 'technical',
      },
      formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    });

    // Logger métier (actions business)
    this.businessLogger = pino({
      level: logLevel,
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
              messageFormat: '{module} | {action} | {entityType}:{entityId}',
            },
          },
      base: {
        env: process.env.NODE_ENV || 'development',
        type: 'business',
      },
      formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGS TECHNIQUES (système, infrastructure)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log technique INFO — Événement système normal
   * Ex: Connexion Redis, démarrage service, migration appliquée
   */
  log(message: string, context?: string) {
    this.logger.info({
      module: context || this.context,
      message,
    });
  }

  /**
   * Log technique INFO avec métadonnées
   */
  info(message: string, context?: string, meta?: TechnicalLogContext) {
    this.logger.info({
      module: context || this.context,
      message,
      ...this.sanitizeMeta(meta),
    });
  }

  /**
   * Log technique WARN — Situation anormale mais gérée
   * Ex: Retry Redis, fallback cache, timeout partiel
   */
  warn(message: string, context?: string, meta?: TechnicalLogContext) {
    this.logger.warn({
      module: context || this.context,
      message,
      ...this.sanitizeMeta(meta),
    });
  }

  /**
   * Log technique ERROR — Échec bloquant
   * Ex: Connexion DB perdue, service externe down
   */
  error(message: string, trace?: string, context?: string) {
    this.logger.error({
      module: context || this.context,
      message,
      stack: trace,
    });
  }

  /**
   * Log technique ERROR avec contexte riche
   */
  errorWithContext(message: string, error: Error | unknown, context?: TechnicalLogContext) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.logger.error({
      module: context?.service || this.context,
      message,
      errorName: errorObj.name,
      errorMessage: errorObj.message,
      stack: errorObj.stack,
      ...this.sanitizeMeta(context),
    });
  }

  debug(message: string, context?: string, meta?: Record<string, unknown>) {
    this.logger.debug({
      module: context || this.context,
      message,
      ...this.sanitizeMeta(meta),
    });
  }

  verbose(message: string, context?: string) {
    this.logger.trace({
      module: context || this.context,
      message,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGS MÉTIER (actions business) — CRITIQUES POUR DIAGNOSTIC
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log métier INFO — Action business réussie
   * 
   * Exemples:
   * - Demande MP créée
   * - BC validé
   * - Réception enregistrée
   * - Stock mis à jour
   */
  businessInfo(action: string, ctx: BusinessLogContext) {
    this.businessLogger.info({
      module: this.context,
      action,
      userId: ctx.userId,
      userEmail: this.maskEmail(ctx.userEmail),
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      correlationId: ctx.correlationId,
      duration: ctx.duration,
      ...this.sanitizeMeta(ctx.metadata),
    });
  }

  /**
   * Log métier WARN — Situation anormale mais gérée
   * 
   * Exemples:
   * - Rendement production < seuil
   * - Stock proche rupture
   * - Tentative action sur entité verrouillée (bloquée)
   * - Idempotence détectée (replay bloqué)
   */
  businessWarn(action: string, reason: string, ctx: BusinessLogContext) {
    this.businessLogger.warn({
      module: this.context,
      action,
      reason,
      userId: ctx.userId,
      userEmail: this.maskEmail(ctx.userEmail),
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      correlationId: ctx.correlationId,
      ...this.sanitizeMeta(ctx.metadata),
    });
  }

  /**
   * Log métier ERROR — Échec métier bloquant
   * 
   * Exemples:
   * - Transition état invalide
   * - Conflit de version
   * - Règle métier violée
   */
  businessError(action: string, error: string, ctx: BusinessLogContext) {
    this.businessLogger.error({
      module: this.context,
      action,
      error,
      userId: ctx.userId,
      userEmail: this.maskEmail(ctx.userEmail),
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      correlationId: ctx.correlationId,
      ...this.sanitizeMeta(ctx.metadata),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT BUILDERS — Pour chaînage fluide
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Créer un logger avec contexte de requête pré-rempli
   * Usage: const log = logger.forRequest(correlationId, userId);
   */
  forRequest(correlationId: string, userId?: string, userEmail?: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      info: (action: string, entityType?: BusinessLogContext['entityType'], entityId?: string | number, meta?: Record<string, unknown>) => {
        self.businessInfo(action, { correlationId, userId, userEmail, entityType, entityId, metadata: meta });
      },
      warn: (action: string, reason: string, entityType?: BusinessLogContext['entityType'], entityId?: string | number) => {
        self.businessWarn(action, reason, { correlationId, userId, userEmail, entityType, entityId });
      },
      error: (action: string, error: string, entityType?: BusinessLogContext['entityType'], entityId?: string | number) => {
        self.businessError(action, error, { correlationId, userId, userEmail, entityType, entityId });
      },
      technical: {
        info: (message: string, meta?: Record<string, unknown>) => {
          self.info(message, self.context, { correlationId, ...meta });
        },
        warn: (message: string, meta?: Record<string, unknown>) => {
          self.warn(message, self.context, { correlationId, ...meta });
        },
        error: (message: string, error?: Error | unknown) => {
          self.errorWithContext(message, error, { correlationId });
        },
      },
    };
  }

  /**
   * Legacy: Compatibilité avec l'ancien withRequestId
   * @deprecated Utiliser forRequest à la place
   */
  withRequestId(requestId: string) {
    return this.forRequest(requestId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITAIRES SÉCURITÉ
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Masquer l'email pour les logs (RGPD)
   * admin@manchengo.dz → a***@manchengo.dz
   */
  private maskEmail(email?: string): string | undefined {
    if (!email) return undefined;
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local[0]}***@${domain}`;
  }

  /**
   * Nettoyer les métadonnées — Supprimer données sensibles
   */
  private sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> {
    if (!meta) return {};
    
    const SENSITIVE_KEYS = [
      'password', 'token', 'accessToken', 'refreshToken', 
      'apiKey', 'secret', 'authorization', 'cookie',
      'creditCard', 'cvv', 'pin'
    ];

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta)) {
      const keyLower = key.toLowerCase();
      if (SENSITIVE_KEYS.some(sk => keyLower.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

// Singleton export for use outside DI context (e.g., main.ts)
export const logger = new LoggerService();
