import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// CORRELATION ID MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════
// Chaque requête HTTP reçoit un ID unique pour tracer toutes les opérations
// ═══════════════════════════════════════════════════════════════════════════════

export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/**
 * Extension de l'interface Request Express pour inclure le contexte de corrélation
 */
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      requestContext: {
        correlationId: string;
        userId?: string;
        userEmail?: string;
        startTime: number;
      };
    }
  }
}

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Récupérer ou générer le correlation ID
    const correlationId = (req.headers[CORRELATION_ID_HEADER.toLowerCase()] as string) || uuidv4();
    
    // Attacher au request
    req.correlationId = correlationId;
    req.requestContext = {
      correlationId,
      startTime: Date.now(),
    };

    // Ajouter au header de réponse pour traçabilité client
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}

/**
 * Helper pour enrichir le contexte après authentification
 * À appeler dans les guards ou interceptors après JWT validation
 */
export function enrichRequestContext(
  req: Request,
  userId: string,
  userEmail?: string,
): void {
  if (req.requestContext) {
    req.requestContext.userId = userId;
    req.requestContext.userEmail = userEmail;
  }
}

/**
 * Helper pour calculer la durée de la requête
 */
export function getRequestDuration(req: Request): number {
  if (!req.requestContext?.startTime) return 0;
  return Date.now() - req.requestContext.startTime;
}
