import { Injectable, Logger } from '@nestjs/common';
import { SyncEventDto } from './dto/sync.dto';

// Action constants (must match mobile)
const SyncAction = {
  MP_RECEIVED: 'MP_RECEIVED',
  MP_CONSUMED: 'MP_CONSUMED',
  PF_PRODUCED: 'PF_PRODUCED',
  PF_SOLD: 'PF_SOLD',
  INVOICE_CREATED: 'INVOICE_CREATED',
  PAYMENT_CREATED: 'PAYMENT_CREATED',
} as const;

/**
 * Event Applier Service
 * 
 * Applies sync events from mobile devices to PostgreSQL tables.
 * 
 * CONFLICT RESOLUTION:
 * - Stock/Lots → SERVER WINS (critical data)
 * - Invoices/Clients → LWW (last-write-wins based on occurred_at)
 * 
 * Rules:
 * - NO business services, direct SQL only
 * - Idempotent (safe to apply twice)
 * - Events are RECEIPTS, not state builders
 */
@Injectable()
export class EventApplierService {
  private readonly logger = new Logger(EventApplierService.name);

  async applyEvent(tx: any, event: SyncEventDto): Promise<void> {
    this.logger.debug(`Applying event: ${event.action} for ${event.entity_type}#${event.entity_id}`);

    switch (event.action) {
      case SyncAction.MP_RECEIVED:
        await this.applyMpReceived(tx, event);
        break;
      case SyncAction.MP_CONSUMED:
        await this.applyMpConsumed(tx, event);
        break;
      case SyncAction.PF_PRODUCED:
        await this.applyPfProduced(tx, event);
        break;
      case SyncAction.PF_SOLD:
        await this.applyPfSold(tx, event);
        break;
      case SyncAction.INVOICE_CREATED:
        await this.applyInvoiceCreated(tx, event);
        break;
      case SyncAction.PAYMENT_CREATED:
        await this.applyPaymentCreated(tx, event);
        break;
      default:
        this.logger.warn(`Unknown action: ${event.action}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MP_RECEIVED - New lot received from supplier
  // ═══════════════════════════════════════════════════════════════════════════
  private async applyMpReceived(tx: any, event: SyncEventDto): Promise<void> {
    const { lot_id, lot_number, product_id, supplier_id, quantity } = event.payload;

    if (!lot_id || !quantity) return;

    // SERVER WINS for stock - upsert with latest quantity
    await tx.lotMp.upsert({
      where: { id: lot_id },
      update: {
        quantity, // Server-wins: always use latest quantity
        updatedAt: new Date(event.occurred_at),
      },
      create: {
        id: lot_id,
        lotNumber: lot_number,
        productId: product_id,
        supplierId: supplier_id,
        quantity,
        productionDate: new Date(event.occurred_at),
      },
    });

    // Record stock movement
    await tx.stockMovement.create({
      data: {
        movementType: 'IN',
        productType: 'MP',
        productMpId: product_id,
        lotMpId: lot_id,
        quantity,
        reason: 'RECEPTION',
        referenceType: 'LOT_MP',
        referenceId: lot_id,
        userId: String(event.user_id),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MP_CONSUMED - MP consumed in production
  // ═══════════════════════════════════════════════════════════════════════════
  private async applyMpConsumed(tx: any, event: SyncEventDto): Promise<void> {
    const { lot_id, quantity, new_quantity } = event.payload;

    if (!lot_id) return;

    // SERVER WINS for quantity
    if (new_quantity !== undefined) {
      await tx.lotMp.update({
        where: { id: lot_id },
        data: {
          quantity: new_quantity,
          updatedAt: new Date(event.occurred_at),
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PF_PRODUCED - Finished product lot created
  // ═══════════════════════════════════════════════════════════════════════════
  private async applyPfProduced(tx: any, event: SyncEventDto): Promise<void> {
    const { lot_id, lot_number, product_id, quantity, production_order_id } = event.payload;

    if (!lot_id || !quantity) return;

    // SERVER WINS for stock
    await tx.lotPf.upsert({
      where: { id: lot_id },
      update: {
        quantity,
        updatedAt: new Date(event.occurred_at),
      },
      create: {
        id: lot_id,
        lotNumber: lot_number,
        productId: product_id,
        quantity,
        productionDate: new Date(event.occurred_at),
        productionOrderId: production_order_id,
      },
    });

    // Record stock movement
    await tx.stockMovement.create({
      data: {
        movementType: 'IN',
        productType: 'PF',
        productPfId: product_id,
        lotPfId: lot_id,
        quantity,
        reason: 'PRODUCTION',
        referenceType: 'PRODUCTION_ORDER',
        referenceId: production_order_id,
        userId: String(event.user_id),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PF_SOLD - Product sold (invoice line)
  // ═══════════════════════════════════════════════════════════════════════════
  private async applyPfSold(tx: any, event: SyncEventDto): Promise<void> {
    const { invoice_id, product_id, quantity, unit_price_ht, line_ht } = event.payload;

    if (!invoice_id || !product_id) return;

    // Check if line already exists
    const existing = await tx.invoiceLine.findFirst({
      where: {
        invoiceId: invoice_id,
        productPfId: product_id,
      },
    });

    if (!existing && quantity) {
      await tx.invoiceLine.create({
        data: {
          invoiceId: invoice_id,
          productPfId: product_id,
          quantity,
          unitPriceHt: unit_price_ht,
          lineHt: line_ht,
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICE_CREATED - New invoice created
  // ═══════════════════════════════════════════════════════════════════════════
  private async applyInvoiceCreated(tx: any, event: SyncEventDto): Promise<void> {
    const {
      invoice_id,
      reference,
      client_id,
      total_ht,
      total_tva,
      total_ttc,
      timbre_fiscal,
      net_to_pay,
      payment_method,
    } = event.payload;

    if (!invoice_id || !reference) return;

    // LWW for invoices (non-critical)
    const existing = await tx.invoice.findUnique({
      where: { id: invoice_id },
    });

    if (!existing) {
      await tx.invoice.create({
        data: {
          id: invoice_id,
          reference,
          clientId: client_id,
          date: new Date(event.occurred_at),
          totalHt: total_ht,
          totalTva: total_tva,
          totalTtc: total_ttc,
          timbreFiscal: timbre_fiscal || 0,
          netToPay: net_to_pay,
          paymentMethod: payment_method || 'ESPECES',
          status: 'PAID',
          userId: String(event.user_id),
        },
      });
    } else {
      // LWW: update only if this event is newer
      if (new Date(event.occurred_at) > existing.updatedAt) {
        await tx.invoice.update({
          where: { id: invoice_id },
          data: {
            totalHt: total_ht,
            totalTva: total_tva,
            totalTtc: total_ttc,
            updatedAt: new Date(event.occurred_at),
          },
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT_CREATED - Payment recorded
  // ═══════════════════════════════════════════════════════════════════════════
  private async applyPaymentCreated(tx: any, event: SyncEventDto): Promise<void> {
    const { payment_id, invoice_id, amount, payment_method } = event.payload;

    if (!invoice_id || !amount) return;

    // Check if payment already exists
    const existing = payment_id
      ? await tx.payment.findUnique({ where: { id: payment_id } })
      : await tx.payment.findFirst({ where: { invoiceId: invoice_id } });

    if (!existing) {
      const data: any = {
        invoiceId: invoice_id,
        amount,
        paymentMethod: payment_method || 'ESPECES',
        userId: String(event.user_id),
      };
      if (payment_id) {
        data.id = payment_id;
      }
      await tx.payment.create({ data });
    }
  }
}
