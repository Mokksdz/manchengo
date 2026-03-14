import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * TENANT MIDDLEWARE - Multi-tenancy foundation
 *
 * Resolves the current user's companyId from the CompanyUser table
 * and attaches it to the request for downstream services to filter data.
 *
 * USAGE IN SERVICES:
 *   const companyId = req['tenantId']; // or use @TenantId() decorator
 *   await prisma.invoice.findMany({ where: { companyId } });
 *
 * IMPORTANT:
 *   This middleware runs AFTER JwtAuthGuard, so req.user is already set.
 *   For unauthenticated routes, tenantId will be undefined.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  // Cache companyId lookups for 5 minutes to avoid DB hits on every request
  private readonly cache = new Map<string, { companyId: string; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as Request & { user?: { id?: string } }).user;

    if (!user?.id) {
      return next();
    }

    try {
      const companyId = await this.resolveCompanyId(user.id);
      if (companyId) {
        (req as Request & { tenantId?: string }).tenantId = companyId;
      }
    } catch (error) {
      this.logger.warn(`Failed to resolve tenant for user ${user.id}: ${error}`);
      // Don't block the request - tenant filtering is additive security
    }

    next();
  }

  private async resolveCompanyId(userId: string): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.companyId;
    }

    // Lookup in CompanyUser table
    const companyUser = await this.prisma.companyUser.findFirst({
      where: { userId },
      select: { companyId: true },
    });

    if (companyUser) {
      this.cache.set(userId, {
        companyId: companyUser.companyId,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });
      return companyUser.companyId;
    }

    return null;
  }
}
