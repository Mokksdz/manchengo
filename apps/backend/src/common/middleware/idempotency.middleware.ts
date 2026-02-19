import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../logger/logger.service';
import * as crypto from 'crypto';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * IDEMPOTENCY MIDDLEWARE — Protection double-clic / refresh / retry
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * OBJECTIF: Garantir qu'une action critique ne s'exécute qu'UNE SEULE FOIS
 * 
 * FONCTIONNEMENT:
 * 1. Client envoie header X-Idempotency-Key (UUID)
 * 2. Middleware vérifie si cette clé existe
 * 3. Si oui → retourne la réponse précédente
 * 4. Si non → exécute l'action et stocke la réponse
 * 
 * ACTIONS PROTÉGÉES:
 * - POST /appro/purchase-orders/create-direct
 * - POST /appro/purchase-orders/:id/send
 * - POST /appro/purchase-orders/:id/confirm
 * - POST /appro/purchase-orders/:id/receive
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const CRITICAL_ENDPOINTS = [
  { method: 'POST', pattern: /\/appro\/purchase-orders\/create-direct/ },
  { method: 'POST', pattern: /\/appro\/purchase-orders\/[\w-]+\/send/ },
  { method: 'POST', pattern: /\/appro\/purchase-orders\/[\w-]+\/confirm/ },
  { method: 'POST', pattern: /\/appro\/purchase-orders\/[\w-]+\/receive/ },
];

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('IdempotencyMiddleware');
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // Vérifier si c'est une action critique
    if (!this.isCriticalAction(req.method, req.path)) {
      return next();
    }

    const idempotencyKey = req.headers['x-idempotency-key'] as string;

    // Actions critiques DOIVENT avoir une clé d'idempotence
    if (!idempotencyKey) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Header X-Idempotency-Key requis pour cette action critique',
        hint: 'Générez un UUID unique côté client et incluez-le dans le header',
      });
    }

    // Valider format UUID
    if (!this.isValidUuid(idempotencyKey)) {
      throw new BadRequestException({
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: 'X-Idempotency-Key doit être un UUID valide',
      });
    }

    // Chercher une exécution précédente
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existing) {
      // Vérifier que c'est la même requête (hash du body)
      const currentHash = this.hashRequest(req.body);
      
      if (existing.requestHash !== currentHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'Clé d\'idempotence réutilisée avec un body différent',
          hint: 'Utilisez une nouvelle clé UUID pour une requête différente',
        });
      }

      // P1.1-C: Vérification métier-aware — l'état a-t-il changé ?
      if (existing.entityType && existing.entityId && existing.expectedStatus) {
        const currentStatus = await this.getCurrentEntityStatus(
          existing.entityType,
          existing.entityId,
        );

        if (currentStatus && currentStatus !== existing.expectedStatus) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONTEXT_CHANGED',
            message: 'État métier modifié depuis la requête initiale',
            expectedStatus: existing.expectedStatus,
            currentStatus,
            hint: 'Rafraîchissez la page et réessayez',
          });
        }
      }

      // Rejouer la réponse précédente (IDEMPOTENT)
      res.setHeader('X-Idempotent-Replayed', 'true');
      res.status(existing.responseStatus);
      return res.json(JSON.parse(existing.responseBody));
    }

    // Intercepter la réponse pour la sauvegarder
    const originalJson = res.json.bind(res);
    const userId = (req as any).user?.id || 'anonymous';
    const endpoint = `${req.method} ${req.path}`;
    const requestHash = this.hashRequest(req.body);

    res.json = (body: any) => {
      // Sauvegarder la réponse de manière asynchrone (ne pas bloquer)
      this.saveIdempotencyRecord(
        idempotencyKey,
        endpoint,
        userId,
        requestHash,
        res.statusCode,
        body,
      ).catch((err) => {
        this.logger.errorWithContext('Failed to save idempotency record', err, {
          service: 'IdempotencyMiddleware',
          method: 'saveIdempotencyRecord',
        });
      });

      return originalJson(body);
    };

    next();
  }

  private isCriticalAction(method: string, path: string): boolean {
    return CRITICAL_ENDPOINTS.some(
      (endpoint) =>
        endpoint.method === method && endpoint.pattern.test(path),
    );
  }

  private isValidUuid(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  private hashRequest(body: any): string {
    const normalized = JSON.stringify(body || {});
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * P1.1-C: Récupérer le statut actuel d'une entité pour vérification métier
   */
  private async getCurrentEntityStatus(
    entityType: string,
    entityId: string,
  ): Promise<string | null> {
    try {
      if (entityType === 'PURCHASE_ORDER') {
        const po = await this.prisma.purchaseOrder.findUnique({
          where: { id: entityId },
          select: { status: true },
        });
        return po?.status || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  private async saveIdempotencyRecord(
    key: string,
    endpoint: string,
    userId: string,
    requestHash: string,
    responseStatus: number,
    responseBody: any,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);

    await this.prisma.idempotencyKey.create({
      data: {
        key,
        endpoint,
        userId,
        requestHash,
        responseStatus,
        responseBody: JSON.stringify(responseBody),
        expiresAt,
      },
    });
  }
}

/**
 * CRON Job pour nettoyer les clés expirées
 * À appeler via @nestjs/schedule
 */
export async function cleanupExpiredIdempotencyKeys(
  prisma: PrismaService,
): Promise<number> {
  const result = await prisma.idempotencyKey.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}
