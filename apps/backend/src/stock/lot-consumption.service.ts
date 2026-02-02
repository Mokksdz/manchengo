import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { LotStatus, Prisma, UserRole } from '@prisma/client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LOT CONSUMPTION SERVICE - FIFO Strict pour Matières Premières
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * RÈGLE MÉTIER:
 *   Toute sortie MP consomme les lots par:
 *   1. Date de réception (ASC) - plus ancien d'abord
 *   2. Date d'expiration (ASC) - expire le plus tôt d'abord
 *   3. ID lot (ASC) - départage déterministe
 *
 * CONTRAINTES:
 *   - Lots BLOCKED exclus
 *   - Lots CONSUMED exclus
 *   - Lots quantity_remaining = 0 exclus
 *   - Transaction avec SELECT FOR UPDATE SKIP LOCKED (anti race condition)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export interface LotConsumption {
  lotId: number;
  lotNumber: string;
  quantity: number;
  expiryDate: Date | null;
  quantityBefore: number;
  quantityAfter: number;
}

export interface ConsumptionResult {
  consumptions: LotConsumption[];
  totalConsumed: number;
  lotsUsed: number;
}

export interface ConsumptionPreview extends ConsumptionResult {
  sufficient: boolean;
  availableStock: number;
}

@Injectable()
export class LotConsumptionService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Consomme du stock MP en respectant FIFO strict
   * Utilise SELECT FOR UPDATE SKIP LOCKED pour éviter les race conditions
   *
   * @throws BadRequestException si stock insuffisant
   * @throws ConflictException si lot devient indisponible pendant transaction
   */
  async consumeFIFO(
    productMpId: number,
    requiredQuantity: number,
    reason: string,
    userId: string,
    options?: {
      referenceType?: string;
      referenceId?: number;
      reference?: string;
      idempotencyKey?: string;
    },
  ): Promise<ConsumptionResult> {
    // Vérifier idempotence si clé fournie
    if (options?.idempotencyKey) {
      const existing = await this.prisma.stockMovement.findUnique({
        where: { idempotencyKey: options.idempotencyKey },
      });
      if (existing) {
        // Retourner résultat existant (idempotent)
        return {
          consumptions: [],
          totalConsumed: Math.abs(existing.quantity),
          lotsUsed: 0,
        };
      }
    }

    // Transaction avec timeout et isolation Serializable
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Récupérer lots disponibles avec lock (FIFO order)
        // SELECT FOR UPDATE SKIP LOCKED évite les deadlocks
        const availableLots = await tx.$queryRaw<
          Array<{
            id: number;
            lot_number: string;
            quantity_remaining: number;
            expiry_date: Date | null;
            created_at: Date;
          }>
        >`
          SELECT id, lot_number, quantity_remaining, expiry_date, created_at
          FROM lots_mp
          WHERE product_id = ${productMpId}
            AND status = 'AVAILABLE'
            AND quantity_remaining > 0
          ORDER BY created_at ASC, expiry_date ASC NULLS LAST, id ASC
          FOR UPDATE SKIP LOCKED
        `;

        // 2. Calculer stock total disponible
        const totalAvailable = availableLots.reduce(
          (sum, lot) => sum + Number(lot.quantity_remaining),
          0,
        );

        if (totalAvailable < requiredQuantity) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_STOCK_FIFO',
            message: `Stock insuffisant. Demandé: ${requiredQuantity}, Disponible: ${totalAvailable}`,
            productMpId,
            required: requiredQuantity,
            available: totalAvailable,
          });
        }

        // 3. Consommer séquentiellement (FIFO)
        const consumptions: LotConsumption[] = [];
        let remaining = requiredQuantity;

        for (const lot of availableLots) {
          if (remaining <= 0) break;

          const lotQty = Number(lot.quantity_remaining);
          const toConsume = Math.min(lotQty, remaining);
          const quantityAfter = lotQty - toConsume;

          consumptions.push({
            lotId: lot.id,
            lotNumber: lot.lot_number,
            quantity: toConsume,
            expiryDate: lot.expiry_date,
            quantityBefore: lotQty,
            quantityAfter,
          });

          remaining -= toConsume;
        }

        // 4. Appliquer les consommations
        for (const consumption of consumptions) {
          // Re-vérifier le lot (double protection - ajustement F1)
          const lot = await tx.lotMp.findUnique({
            where: { id: consumption.lotId },
            select: { status: true, quantityRemaining: true },
          });

          if (!lot || lot.status !== 'AVAILABLE') {
            throw new ConflictException({
              code: 'LOT_NO_LONGER_AVAILABLE',
              message: `Lot ${consumption.lotId} n'est plus disponible`,
              lotId: consumption.lotId,
            });
          }

          if (Number(lot.quantityRemaining) < consumption.quantity) {
            throw new ConflictException({
              code: 'LOT_QUANTITY_CHANGED',
              message: `Lot ${consumption.lotId}: quantité insuffisante`,
              lotId: consumption.lotId,
              expected: consumption.quantity,
              actual: lot.quantityRemaining,
            });
          }

          // Mettre à jour le lot
          const newStatus: LotStatus =
            consumption.quantityAfter <= 0 ? 'CONSUMED' : 'AVAILABLE';

          await tx.lotMp.update({
            where: { id: consumption.lotId },
            data: {
              quantityRemaining: consumption.quantityAfter,
              status: newStatus,
              consumedAt: newStatus === 'CONSUMED' ? new Date() : null,
            },
          });

          // Créer mouvement de sortie avec snapshot lot (traçabilité)
          await tx.stockMovement.create({
            data: {
              movementType: 'OUT',
              origin: reason as any,
              productType: 'MP',
              productMpId,
              lotMpId: consumption.lotId,
              quantity: -consumption.quantity, // Négatif = sortie
              userId,
              referenceType: options?.referenceType,
              referenceId: options?.referenceId,
              reference: options?.reference || `FIFO-${consumption.lotNumber}`,
              idempotencyKey: options?.idempotencyKey
                ? `${options.idempotencyKey}-${consumption.lotId}`
                : undefined,
              lotSnapshot: {
                lotNumber: consumption.lotNumber,
                quantityBefore: consumption.quantityBefore,
                quantityAfter: consumption.quantityAfter,
                expiryDate: consumption.expiryDate,
                consumedAt: new Date().toISOString(),
              },
            },
          });
        }

        // 5. Audit consolidé
        await this.audit.log({
          actor: { id: userId, role: 'PRODUCTION' as UserRole },
          action: 'STOCK_MOVEMENT_CREATED' as any,
          entityType: 'ProductMp',
          entityId: String(productMpId),
          metadata: {
            reason,
            method: 'FIFO',
            totalConsumed: requiredQuantity,
            lotsUsed: consumptions.length,
            consumptions: consumptions.map((c) => ({
              lotId: c.lotId,
              lotNumber: c.lotNumber,
              qty: c.quantity,
              expiryDate: c.expiryDate,
            })),
          },
        });

        return {
          consumptions,
          totalConsumed: requiredQuantity,
          lotsUsed: consumptions.length,
        };
      },
      {
        timeout: 10000, // 10s max (ajustement T4)
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /**
   * Prévisualise la consommation FIFO sans l'appliquer
   * Utile pour affichage frontend avant confirmation
   */
  async previewFIFO(
    productMpId: number,
    requiredQuantity: number,
  ): Promise<ConsumptionPreview> {
    const availableLots = await this.prisma.lotMp.findMany({
      where: {
        productId: productMpId,
        status: 'AVAILABLE',
        quantityRemaining: { gt: 0 },
      },
      orderBy: [
        { createdAt: 'asc' },
        { expiryDate: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        lotNumber: true,
        quantityRemaining: true,
        expiryDate: true,
      },
    });

    const totalAvailable = availableLots.reduce(
      (sum, lot) => sum + Number(lot.quantityRemaining),
      0,
    );

    const consumptions: LotConsumption[] = [];
    let remaining = requiredQuantity;

    for (const lot of availableLots) {
      if (remaining <= 0) break;

      const lotQty = Number(lot.quantityRemaining);
      const toConsume = Math.min(lotQty, remaining);

      consumptions.push({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        quantity: toConsume,
        expiryDate: lot.expiryDate,
        quantityBefore: lotQty,
        quantityAfter: lotQty - toConsume,
      });

      remaining -= toConsume;
    }

    return {
      consumptions,
      totalConsumed: requiredQuantity - Math.max(0, remaining),
      lotsUsed: consumptions.length,
      sufficient: remaining <= 0,
      availableStock: totalAvailable,
    };
  }

  /**
   * Vérifie si un lot est consommable (non bloqué, quantité > 0)
   */
  async isLotConsumable(lotId: number): Promise<boolean> {
    const lot = await this.prisma.lotMp.findUnique({
      where: { id: lotId },
      select: { status: true, quantityRemaining: true },
    });

    return (
      lot !== null &&
      lot.status === 'AVAILABLE' &&
      Number(lot.quantityRemaining) > 0
    );
  }

  /**
   * Obtient le stock FIFO disponible pour un produit
   */
  async getAvailableFIFOStock(productMpId: number): Promise<{
    totalAvailable: number;
    lotsCount: number;
    oldestLotDate: Date | null;
    nearestExpiryDate: Date | null;
  }> {
    const lots = await this.prisma.lotMp.findMany({
      where: {
        productId: productMpId,
        status: 'AVAILABLE',
        quantityRemaining: { gt: 0 },
      },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        quantityRemaining: true,
        createdAt: true,
        expiryDate: true,
      },
    });

    if (lots.length === 0) {
      return {
        totalAvailable: 0,
        lotsCount: 0,
        oldestLotDate: null,
        nearestExpiryDate: null,
      };
    }

    const totalAvailable = lots.reduce(
      (sum, lot) => sum + Number(lot.quantityRemaining),
      0,
    );

    const expiryDates = lots
      .map((l) => l.expiryDate)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      totalAvailable,
      lotsCount: lots.length,
      oldestLotDate: lots[0].createdAt,
      nearestExpiryDate: expiryDates[0] || null,
    };
  }
}
