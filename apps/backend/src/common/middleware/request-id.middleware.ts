import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * REQUEST ID MIDDLEWARE - Correlation across logs and audit trail
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Every HTTP request gets a unique ID that propagates through:
 *   - Logger (structured logs)
 *   - Audit logs (forensic trail)
 *   - Error responses (for support tickets)
 * 
 * AUDIT VALUE:
 *   - One user action = one requestId
 *   - If something goes wrong, grep requestId in logs
 *   - Correlate audit entries from same transaction
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Extend Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Use existing header if provided (for distributed tracing)
    // Otherwise generate a new one
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    
    // Attach to request for services to access
    req.requestId = requestId;
    req.startTime = Date.now();
    
    // Also set in response header for client correlation
    res.setHeader('X-Request-Id', requestId);
    
    next();
  }
}

/**
 * Helper to extract request context for audit logging
 */
export interface RequestContext {
  requestId: string;
  ipAddress: string | undefined;
  userAgent: string | undefined;
}

export function extractRequestContext(req: Request): RequestContext {
  return {
    requestId: req.requestId,
    ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
    userAgent: req.headers['user-agent'],
  };
}
