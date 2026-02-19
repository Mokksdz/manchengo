import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, DeliveryStatus, InvoiceStatus } from '@prisma/client';
import { SyncConflictResolver } from './sync.conflict';
import {
  SyncEntityType,
  SyncAction,
  SyncEventDto,
  ConflictErrorCode,
} from './sync.dto';

export interface ApplyResult {
  success: boolean;
  serverEventId?: string;
  entityId?: string;
  errorCode?: ConflictErrorCode;
  errorMessage?: string;
  resolution?: {
    action: 'DISCARD_LOCAL' | 'MERGE' | 'RETRY' | 'MANUAL';
    data?: Record<string, unknown>;
  };
}

@Injectable()
export class SyncEventApplier {
  private readonly logger = new Logger(SyncEventApplier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conflictResolver: SyncConflictResolver,
  ) {}

  /**
   * Apply a single sync event within a transaction
   */
  async applyEvent(
    event: SyncEventDto,
    userId: string,
    deviceId: string,
    tx: Prisma.TransactionClient,
  ): Promise<ApplyResult> {
    const entityType = event.entityType as SyncEntityType;
    const action = event.action as SyncAction;

    // Check for conflicts first
    const conflictCheck = await this.conflictResolver.checkConflict(
      entityType,
      event.entityId,
      action,
      event.payload,
      tx,
    );

    if (conflictCheck.hasConflict && !conflictCheck.canProceed) {
      await this.conflictResolver.logConflict(
        event.id,
        entityType,
        event.entityId,
        action,
        conflictCheck,
        userId,
        deviceId,
      );

      return {
        success: false,
        errorCode: conflictCheck.errorCode,
        errorMessage: conflictCheck.errorMessage,
        resolution: conflictCheck.resolution,
      };
    }

    // Dispatch to entity-specific handler
    try {
      switch (entityType) {
        case SyncEntityType.DELIVERY:
          return await this.applyDeliveryEvent(event, userId, deviceId, tx);

        case SyncEntityType.INVOICE:
          return await this.applyInvoiceEvent(event, userId, deviceId, tx);

        case SyncEntityType.PAYMENT:
          return await this.applyPaymentEvent(event, userId, deviceId, tx);

        case SyncEntityType.CLIENT:
          return await this.applyClientEvent(event, userId, deviceId, tx);

        default:
          this.logger.error(`Unknown entity type: ${entityType}`);
          return {
            success: false,
            errorCode: ConflictErrorCode.VALIDATION_ERROR,
            errorMessage: `Type d'entité non supporté: ${entityType}`,
          };
      }
    } catch (error) {
      this.logger.error(
        `Failed to apply event ${event.id}: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        errorCode: ConflictErrorCode.VALIDATION_ERROR,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Apply DELIVERY events
   */
  private async applyDeliveryEvent(
    event: SyncEventDto,
    userId: string,
    deviceId: string,
    tx: Prisma.TransactionClient,
  ): Promise<ApplyResult> {
    const action = event.action as SyncAction;
    const payload = event.payload;

    if (action === SyncAction.DELIVERY_VALIDATED) {
      const delivery = await tx.delivery.update({
        where: { id: event.entityId },
        data: {
          status: DeliveryStatus.VALIDATED,
          validatedAt: new Date(event.occurredAt),
          validatedByUserId: userId,
          validatedByDeviceId: deviceId,
          recipientName: payload.recipient_name as string,
          recipientSignature: payload.signature_base64 as string,
          proofPhoto: payload.photo_base64 as string,
          deliveryNotes: payload.notes as string,
        },
      });

      // Create validation log
      await tx.deliveryValidationLog.create({
        data: {
          deliveryId: event.entityId,
          action: 'VALIDATED',
          qrScanned: payload.qr_scanned as string,
          userId,
          deviceId,
          success: true,
          metadata: {
            latitude: payload.latitude,
            longitude: payload.longitude,
            occurredAt: event.occurredAt,
          } as any,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'COMMERCIAL',
          action: 'STOCK_SALE_PROCESSED',
          severity: 'INFO',
          entityType: 'Delivery',
          entityId: event.entityId,
          afterState: {
            status: 'VALIDATED',
            validatedAt: event.occurredAt,
            deviceId,
          },
          metadata: {
            syncEventId: event.id,
            source: 'MOBILE_SYNC',
          },
        },
      });

      this.logger.log(
        `Delivery ${event.entityId} validated by user ${userId} via device ${deviceId}`,
      );

      return {
        success: true,
        serverEventId: delivery.id,
        entityId: delivery.id,
      };
    }

    if (action === SyncAction.DELIVERY_CANCELLED) {
      const delivery = await tx.delivery.update({
        where: { id: event.entityId },
        data: {
          status: DeliveryStatus.CANCELLED,
          cancelledAt: new Date(event.occurredAt),
          cancelledByUserId: userId,
          cancelReason: payload.reason as string,
        },
      });

      await tx.deliveryValidationLog.create({
        data: {
          deliveryId: event.entityId,
          action: 'CANCELLED',
          qrScanned: '',
          userId,
          deviceId,
          success: true,
          metadata: {
            reason: payload.reason,
            occurredAt: event.occurredAt,
          } as any,
        },
      });

      return {
        success: true,
        serverEventId: delivery.id,
        entityId: delivery.id,
      };
    }

    return {
      success: false,
      errorCode: ConflictErrorCode.VALIDATION_ERROR,
      errorMessage: `Action non supportée pour DELIVERY: ${action}`,
    };
  }

  /**
   * Apply INVOICE events
   */
  private async applyInvoiceEvent(
    event: SyncEventDto,
    userId: string,
    deviceId: string,
    tx: Prisma.TransactionClient,
  ): Promise<ApplyResult> {
    const action = event.action as SyncAction;
    const payload = event.payload;

    if (action === SyncAction.INVOICE_CREATED) {
      // Generate server reference
      const reference = await this.generateInvoiceReference(tx);

      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          reference,
          clientId: Number(payload.client_id || payload.clientId),
          date: new Date(payload.date as string),
          totalHt: Number(payload.total_ht || payload.totalHt),
          totalTva: Number(payload.total_tva || payload.totalTva),
          totalTtc: Number(payload.total_ttc || payload.totalTtc),
          timbreFiscal: Number(payload.timbre_fiscal || payload.timbreFiscal || 0),
          netToPay: Number(payload.net_to_pay || payload.netToPay),
          paymentMethod: (payload.payment_method || payload.paymentMethod || 'ESPECES') as any,
          status: InvoiceStatus.DRAFT,
          userId,
        },
      });

      // Create invoice lines
      const lines = (payload.lines || []) as Array<{
        product_id?: number;
        productId?: number;
        quantity: number;
        unit_price_ht?: number;
        unitPriceHt?: number;
        line_ht?: number;
        lineHt?: number;
      }>;

      for (const line of lines) {
        await tx.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            productPfId: Number(line.product_id || line.productId),
            quantity: Number(line.quantity),
            unitPriceHt: Number(line.unit_price_ht || line.unitPriceHt),
            lineHt: Number(line.line_ht || line.lineHt),
          },
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'COMMERCIAL',
          action: 'STOCK_SALE_PROCESSED',
          severity: 'INFO',
          entityType: 'Invoice',
          entityId: String(invoice.id),
          afterState: {
            reference: invoice.reference,
            clientId: invoice.clientId,
            totalTtc: invoice.totalTtc,
            status: 'DRAFT',
          },
          metadata: {
            syncEventId: event.id,
            mobileEventId: event.id,
            tempId: payload.temp_id || payload.tempId,
            source: 'MOBILE_SYNC',
            deviceId,
          } as any,
        },
      });

      this.logger.log(
        `Invoice ${invoice.reference} created from mobile (temp_id: ${payload.temp_id || payload.tempId})`,
      );

      return {
        success: true,
        serverEventId: String(invoice.id),
        entityId: String(invoice.id),
      };
    }

    if (action === SyncAction.INVOICE_UPDATED) {
      const invoiceId = Number(event.entityId);

      const updateData: Prisma.InvoiceUpdateInput = {};

      if (payload.payment_method || payload.paymentMethod) {
        updateData.paymentMethod = (payload.payment_method || payload.paymentMethod) as any;
      }
      if (payload.delivery_notes || payload.deliveryNotes) {
        // Store in a custom field or handle as needed
      }

      const invoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: updateData,
      });

      return {
        success: true,
        serverEventId: String(invoice.id),
        entityId: String(invoice.id),
      };
    }

    return {
      success: false,
      errorCode: ConflictErrorCode.VALIDATION_ERROR,
      errorMessage: `Action non supportée pour INVOICE: ${action}`,
    };
  }

  /**
   * Apply PAYMENT events
   */
  private async applyPaymentEvent(
    event: SyncEventDto,
    userId: string,
    deviceId: string,
    tx: Prisma.TransactionClient,
  ): Promise<ApplyResult> {
    const action = event.action as SyncAction;
    const payload = event.payload;

    if (action === SyncAction.PAYMENT_RECORDED) {
      const invoiceId = Number(payload.invoice_id || payload.invoiceId);
      const amount = Number(payload.amount);
      const paymentMethod = (payload.payment_method || payload.paymentMethod || 'ESPECES') as any;

      // Create payment
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount,
          paymentMethod,
          userId,
        },
      });

      // Check if invoice is fully paid
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          payments: true,
        },
      });

      if (invoice) {
        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
        
        if (totalPaid >= invoice.netToPay) {
          await tx.invoice.update({
            where: { id: invoiceId },
            data: { status: InvoiceStatus.PAID },
          });

          this.logger.log(`Invoice ${invoice.reference} fully paid`);
        }
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'COMMERCIAL',
          action: 'STOCK_SALE_PROCESSED',
          severity: 'INFO',
          entityType: 'Payment',
          entityId: String(payment.id),
          afterState: {
            invoiceId,
            amount,
            paymentMethod,
          },
          metadata: {
            syncEventId: event.id,
            source: 'MOBILE_SYNC',
            deviceId,
          },
        },
      });

      this.logger.log(
        `Payment ${payment.id} recorded for invoice ${invoiceId} (${amount / 100} DA)`,
      );

      return {
        success: true,
        serverEventId: String(payment.id),
        entityId: String(payment.id),
      };
    }

    return {
      success: false,
      errorCode: ConflictErrorCode.VALIDATION_ERROR,
      errorMessage: `Action non supportée pour PAYMENT: ${action}`,
    };
  }

  /**
   * Apply CLIENT events (LWW - Last Write Wins)
   */
  private async applyClientEvent(
    event: SyncEventDto,
    userId: string,
    deviceId: string,
    tx: Prisma.TransactionClient,
  ): Promise<ApplyResult> {
    const action = event.action as SyncAction;
    const payload = event.payload;

    if (action === SyncAction.CLIENT_UPDATED) {
      const clientId = Number(event.entityId);

      const updateData: Prisma.ClientUpdateInput = {};

      if (payload.phone !== undefined) updateData.phone = payload.phone as string;
      if (payload.address !== undefined) updateData.address = payload.address as string;
      if (payload.nif !== undefined) updateData.nif = payload.nif as string;
      if (payload.rc !== undefined) updateData.rc = payload.rc as string;
      if (payload.ai !== undefined) updateData.ai = payload.ai as string;

      const client = await tx.client.update({
        where: { id: clientId },
        data: updateData,
      });

      this.logger.log(`Client ${client.id} updated via LWW from device ${deviceId}`);

      return {
        success: true,
        serverEventId: String(client.id),
        entityId: String(client.id),
      };
    }

    return {
      success: false,
      errorCode: ConflictErrorCode.VALIDATION_ERROR,
      errorMessage: `Action non supportée pour CLIENT: ${action}`,
    };
  }

  /**
   * Generate next invoice reference
   */
  private async generateInvoiceReference(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const prefix = `F-${year}${month}${day}`;

    // Get count of invoices today
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await tx.invoice.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = (count + 1).toString().padStart(3, '0');
    return `${prefix}-${sequence}`;
  }
}
