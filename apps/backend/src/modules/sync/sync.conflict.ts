import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  SyncEntityType,
  SyncAction,
  ConflictErrorCode,
  ConflictResolutionDto,
} from './sync.dto';

export interface ConflictCheckResult {
  hasConflict: boolean;
  errorCode?: ConflictErrorCode;
  errorMessage?: string;
  resolution?: ConflictResolutionDto;
  canProceed: boolean;
}

export interface EntityState {
  exists: boolean;
  status?: string;
  updatedAt?: Date;
  validatedAt?: Date;
  validatedByUserId?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class SyncConflictResolver {
  private readonly logger = new Logger(SyncConflictResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Main conflict check dispatcher
   */
  async checkConflict(
    entityType: SyncEntityType,
    entityId: string,
    action: SyncAction,
    payload: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<ConflictCheckResult> {
    const db = tx || this.prisma;

    switch (entityType) {
      case SyncEntityType.DELIVERY:
        return this.checkDeliveryConflict(db, entityId, action, payload);

      case SyncEntityType.INVOICE:
        return this.checkInvoiceConflict(db, entityId, action, payload);

      case SyncEntityType.PAYMENT:
        return this.checkPaymentConflict(db, entityId, action, payload);

      case SyncEntityType.CLIENT:
        return this.checkClientConflict(db, entityId, action, payload);

      default:
        this.logger.warn(`Unknown entity type for conflict check: ${entityType}`);
        return { hasConflict: false, canProceed: true };
    }
  }

  /**
   * DELIVERY: FIRST-WINS rule
   * Only one device can validate a delivery
   */
  private async checkDeliveryConflict(
    db: Prisma.TransactionClient | PrismaService,
    entityId: string,
    action: SyncAction,
    payload: Record<string, unknown>,
  ): Promise<ConflictCheckResult> {
    const delivery = await db.delivery.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        status: true,
        validatedAt: true,
        validatedByUserId: true,
        cancelledAt: true,
        cancelledByUserId: true,
      },
    });

    if (!delivery) {
      return {
        hasConflict: true,
        errorCode: ConflictErrorCode.ENTITY_NOT_FOUND,
        errorMessage: 'Livraison introuvable',
        canProceed: false,
      };
    }

    if (action === SyncAction.DELIVERY_VALIDATED) {
      // FIRST-WINS: Check if already validated
      if (delivery.status === 'VALIDATED') {
        // Get validator info for resolution
        const validator = delivery.validatedByUserId
          ? await this.prisma.user.findUnique({
              where: { id: delivery.validatedByUserId },
              select: { firstName: true, lastName: true },
            })
          : null;

        const validatorName = validator
          ? `${validator.firstName} ${validator.lastName}`
          : 'un autre utilisateur';

        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.ALREADY_VALIDATED,
          errorMessage: `Livraison déjà validée par ${validatorName}`,
          resolution: {
            action: 'DISCARD_LOCAL',
            data: {
              validatedBy: validatorName,
              validatedAt: delivery.validatedAt?.toISOString(),
            },
          },
          canProceed: false,
        };
      }

      // Check if cancelled
      if (delivery.status === 'CANCELLED') {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.ALREADY_CANCELLED,
          errorMessage: 'Livraison annulée',
          resolution: {
            action: 'DISCARD_LOCAL',
            data: {
              cancelledAt: delivery.cancelledAt?.toISOString(),
            },
          },
          canProceed: false,
        };
      }
    }

    if (action === SyncAction.DELIVERY_CANCELLED) {
      if (delivery.status === 'VALIDATED') {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.INVALID_STATE,
          errorMessage: 'Impossible d\'annuler une livraison validée',
          canProceed: false,
        };
      }

      if (delivery.status === 'CANCELLED') {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.ALREADY_CANCELLED,
          errorMessage: 'Livraison déjà annulée',
          resolution: { action: 'DISCARD_LOCAL' },
          canProceed: false,
        };
      }
    }

    return { hasConflict: false, canProceed: true };
  }

  /**
   * INVOICE: ACCEPT + ASSIGN reference
   * Mobile creates draft, server assigns official reference
   */
  private async checkInvoiceConflict(
    db: Prisma.TransactionClient | PrismaService,
    entityId: string,
    action: SyncAction,
    payload: Record<string, unknown>,
  ): Promise<ConflictCheckResult> {
    if (action === SyncAction.INVOICE_CREATED) {
      // For new invoices, entityId is temp_id from mobile
      // Check if this temp_id was already processed
      const existingWithTempId = await db.syncEvent.findFirst({
        where: {
          entityType: 'INVOICE',
          action: 'INVOICE_CREATED',
          payload: {
            path: ['temp_id'],
            equals: entityId,
          },
          status: { in: ['APPLIED', 'ACKED'] },
        },
        select: {
          id: true,
          serverEventId: true,
        },
      });

      if (existingWithTempId) {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.DUPLICATE_EVENT,
          errorMessage: 'Facture déjà créée',
          resolution: {
            action: 'DISCARD_LOCAL',
            data: {
              serverInvoiceId: existingWithTempId.serverEventId,
            },
          },
          canProceed: false,
        };
      }

      // Validate client exists
      const clientId = payload.client_id || payload.clientId;
      if (clientId) {
        const client = await db.client.findUnique({
          where: { id: Number(clientId) },
          select: { id: true },
        });

        if (!client) {
          return {
            hasConflict: true,
            errorCode: ConflictErrorCode.ENTITY_NOT_FOUND,
            errorMessage: 'Client introuvable',
            canProceed: false,
          };
        }
      }

      return { hasConflict: false, canProceed: true };
    }

    if (action === SyncAction.INVOICE_UPDATED) {
      const invoice = await db.invoice.findUnique({
        where: { id: Number(entityId) },
        select: {
          id: true,
          status: true,
        },
      });

      if (!invoice) {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.ENTITY_NOT_FOUND,
          errorMessage: 'Facture introuvable',
          canProceed: false,
        };
      }

      // Cannot update paid or cancelled invoices
      if (invoice.status === 'PAID') {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.INVOICE_ALREADY_PAID,
          errorMessage: 'Facture déjà payée, modification impossible',
          canProceed: false,
        };
      }

      if (invoice.status === 'CANCELLED') {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.INVALID_STATE,
          errorMessage: 'Facture annulée, modification impossible',
          canProceed: false,
        };
      }

      return { hasConflict: false, canProceed: true };
    }

    return { hasConflict: false, canProceed: true };
  }

  /**
   * PAYMENT: ACCEPT + VERIFY amount
   * Server verifies payment doesn't exceed invoice total
   */
  private async checkPaymentConflict(
    db: Prisma.TransactionClient | PrismaService,
    entityId: string,
    action: SyncAction,
    payload: Record<string, unknown>,
  ): Promise<ConflictCheckResult> {
    if (action === SyncAction.PAYMENT_RECORDED) {
      const invoiceId = payload.invoice_id || payload.invoiceId;
      const amount = Number(payload.amount);

      if (!invoiceId) {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.VALIDATION_ERROR,
          errorMessage: 'ID facture requis',
          canProceed: false,
        };
      }

      const invoice = await db.invoice.findUnique({
        where: { id: Number(invoiceId) },
        select: {
          id: true,
          netToPay: true,
          status: true,
          payments: {
            select: { amount: true },
          },
        },
      });

      if (!invoice) {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.ENTITY_NOT_FOUND,
          errorMessage: 'Facture introuvable',
          canProceed: false,
        };
      }

      if (invoice.status === 'CANCELLED') {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.INVALID_STATE,
          errorMessage: 'Facture annulée',
          canProceed: false,
        };
      }

      // Calculate remaining amount
      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = invoice.netToPay - totalPaid;

      if (amount > remaining) {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.VALIDATION_ERROR,
          errorMessage: `Montant dépasse le solde restant (${remaining / 100} DA)`,
          resolution: {
            action: 'MANUAL',
            data: {
              invoiceTotal: invoice.netToPay,
              alreadyPaid: totalPaid,
              remaining: remaining,
              attemptedPayment: amount,
            },
          },
          canProceed: false,
        };
      }

      return { hasConflict: false, canProceed: true };
    }

    return { hasConflict: false, canProceed: true };
  }

  /**
   * CLIENT: LWW (Last-Write-Wins)
   * Non-critical data, last update wins
   */
  private async checkClientConflict(
    db: Prisma.TransactionClient | PrismaService,
    entityId: string,
    action: SyncAction,
    payload: Record<string, unknown>,
  ): Promise<ConflictCheckResult> {
    if (action === SyncAction.CLIENT_UPDATED) {
      const client = await db.client.findUnique({
        where: { id: Number(entityId) },
        select: {
          id: true,
          updatedAt: true,
        },
      });

      if (!client) {
        return {
          hasConflict: true,
          errorCode: ConflictErrorCode.ENTITY_NOT_FOUND,
          errorMessage: 'Client introuvable',
          canProceed: false,
        };
      }

      // LWW: Always allow, just log if server version is newer
      const clientOccurredAt = payload.occurredAt
        ? new Date(payload.occurredAt as string)
        : new Date();

      if (client.updatedAt > clientOccurredAt) {
        this.logger.debug(
          `LWW: Client ${entityId} has newer server version, but accepting mobile update`,
        );
      }

      return { hasConflict: false, canProceed: true };
    }

    return { hasConflict: false, canProceed: true };
  }

  /**
   * Log conflict for audit
   */
  async logConflict(
    eventId: string,
    entityType: SyncEntityType,
    entityId: string,
    action: SyncAction,
    conflict: ConflictCheckResult,
    userId: string,
    deviceId: string,
  ): Promise<void> {
    await this.prisma.securityLog.create({
      data: {
        action: 'SYNC_PUSH',
        userId,
        deviceId,
        details: {
          type: 'SYNC_CONFLICT',
          eventId,
          entityType,
          entityId,
          action,
          errorCode: conflict.errorCode,
          errorMessage: conflict.errorMessage,
          resolution: conflict.resolution,
        } as any,
        success: false,
      },
    });

    this.logger.warn(
      `Sync conflict - Entity: ${entityType}/${entityId}, Action: ${action}, Error: ${conflict.errorCode}`,
    );
  }
}
