import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LOCK SERVICE — Verrou serveur strict (P1.1-D)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Ce service gère les verrous métier côté serveur.
 * RÈGLE: Chaque action critique DOIT vérifier le verrou avant exécution.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export type LockableEntity = 'PURCHASE_ORDER';

export interface LockInfo {
  lockedById: string | null;
  lockedByName?: string;
  lockedAt: Date | null;
  lockExpiresAt: Date | null;
}

export interface LockResult {
  success: boolean;
  lockedBy?: string;
  expiresAt?: Date;
}

@Injectable()
export class LockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vérifie qu'une entité n'est pas verrouillée par un autre utilisateur.
   * @throws ConflictException si verrouillé par un autre
   */
  assertNotLocked(
    entity: LockInfo & { id?: string | number },
    currentUserId: string,
    lockedByName?: string,
  ): void {
    const now = new Date();

    if (
      entity.lockedById &&
      entity.lockedById !== currentUserId &&
      entity.lockExpiresAt &&
      entity.lockExpiresAt > now
    ) {
      throw new ConflictException({
        code: 'ENTITY_LOCKED',
        message: `Document verrouillé par ${lockedByName || entity.lockedById}`,
        lockedBy: entity.lockedById,
        lockedByName: lockedByName,
        expiresAt: entity.lockExpiresAt,
        hint: 'Attendez que le verrou expire ou contactez l\'utilisateur',
      });
    }
  }

  /**
   * Acquiert un verrou sur un BC
   * Note: Requiert migration P1.1
   */
  async acquirePurchaseOrderLock(
    poId: string,
    userId: string,
  ): Promise<LockResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_DURATION_MS);

    const po = await (this.prisma.purchaseOrder as any).findUnique({
      where: { id: poId },
      include: {
        lockedBy: { select: { firstName: true, lastName: true } },
      },
    }) as any;

    if (!po) {
      return { success: false };
    }

    // Verrou actif par quelqu'un d'autre ?
    if (
      po.lockedById &&
      po.lockedById !== userId &&
      po.lockExpiresAt &&
      po.lockExpiresAt > now
    ) {
      const lockedByName = po.lockedBy
        ? `${po.lockedBy.firstName} ${po.lockedBy.lastName}`
        : po.lockedById;

      return {
        success: false,
        lockedBy: lockedByName,
        expiresAt: po.lockExpiresAt,
      };
    }

    // Acquérir le verrou
    await (this.prisma.purchaseOrder as any).update({
      where: { id: poId },
      data: {
        lockedById: userId,
        lockedAt: now,
        lockExpiresAt: expiresAt,
      },
    });

    return { success: true, expiresAt };
  }

  /**
   * Libère un verrou sur un BC
   */
  async releasePurchaseOrderLock(poId: string, userId: string): Promise<void> {
    await (this.prisma.purchaseOrder as any).updateMany({
      where: {
        id: poId,
        lockedById: userId,
      },
      data: {
        lockedById: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
    });
  }

  /**
   * Force le déverrouillage BC (ADMIN uniquement)
   */
  async forceUnlockPurchaseOrder(poId: string): Promise<void> {
    await (this.prisma.purchaseOrder as any).update({
      where: { id: poId },
      data: {
        lockedById: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
    });
  }
}
