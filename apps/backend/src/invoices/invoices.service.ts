import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto, UpdateInvoiceStatusDto } from './dto/invoice.dto';
import { logger } from '../common/logger/logger.service';

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICES SERVICE — Facturation avec calcul TVA algerienne
// ═══════════════════════════════════════════════════════════════════════════════
// - Montants en centimes (precision sans float)
// - TVA 19% standard
// - Timbre fiscal bareme progressif (1%, 1.5%, 2%) si paiement especes
// - Reference auto: F-YYYY-NNNNN (numerotation annuelle sequentielle)
// ═══════════════════════════════════════════════════════════════════════════════

const TVA_RATE = 0.19; // 19% TVA Algerie

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate timbre fiscal based on Algerian fiscal schedule (percentage-based)
   * Amounts in centimes
   */
  private calculateTimbreFiscal(totalTtc: number, paymentMethod: string): { amount: number; rate: number } {
    if (paymentMethod !== 'ESPECES' || totalTtc <= 0) return { amount: 0, rate: 0 };

    // Barème fiscal algérien (montants en centimes)
    const totalTtcDA = totalTtc / 100; // Convert centimes to DA
    let rate: number;
    if (totalTtcDA <= 30000) rate = 0.01;
    else if (totalTtcDA <= 100000) rate = 0.015;
    else rate = 0.02;

    return { amount: Math.round(totalTtc * rate), rate };
  }

  /**
   * List all invoices with filters
   */
  async findAll(status?: string, clientId?: number) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;

    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        client: { select: { id: true, code: true, name: true, type: true } },
        lines: {
          include: {
            productPf: { select: { id: true, code: true, name: true } },
          },
        },
        _count: { select: { payments: true } },
      },
    });

    return invoices.map((inv) => ({
      ...inv,
      timbreRate: inv.timbreRate !== null && inv.timbreRate !== undefined ? Number(inv.timbreRate) : null,
    }));
  }

  /**
   * Get a single invoice with all details
   */
  async findOne(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        lines: {
          include: {
            productPf: { select: { id: true, code: true, name: true, unit: true } },
          },
        },
        payments: true,
        deliveries: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Facture #${id} introuvable`);
    }

    return {
      ...invoice,
      timbreRate: invoice.timbreRate !== null && invoice.timbreRate !== undefined ? Number(invoice.timbreRate) : null,
    };
  }

  /**
   * Create a new invoice with lines and auto-calculation
   */
  async create(dto: CreateInvoiceDto, userId: string) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Une facture doit contenir au moins une ligne');
    }

    // Validate line items before processing
    for (const line of dto.lines) {
      if (line.quantity <= 0) {
        throw new BadRequestException(
          `Quantité invalide (${line.quantity}) pour le produit #${line.productPfId}: doit être > 0`,
        );
      }
      if (line.unitPriceHt < 0) {
        throw new BadRequestException(
          `Prix unitaire HT invalide (${line.unitPriceHt}) pour le produit #${line.productPfId}: doit être >= 0`,
        );
      }
    }

    // Calculate totals (with line-level remise support, capped to prevent negative)
    const linesData = dto.lines.map((line) => {
      const grossAmount = line.quantity * line.unitPriceHt;
      const remise = Math.min(line.remise || 0, grossAmount); // Cap remise to line total
      return {
        productPfId: line.productPfId,
        quantity: line.quantity,
        unitPriceHt: line.unitPriceHt,
        remise,
        lineHt: grossAmount - remise,
      };
    });

    const totalHt = linesData.reduce((sum, l) => sum + l.lineHt, 0);
    const totalTva = Math.round(totalHt * TVA_RATE);
    const totalTtc = totalHt + totalTva;
    const { amount: timbreFiscal, rate: timbreRate } = this.calculateTimbreFiscal(totalTtc, dto.paymentMethod);
    const netToPay = totalTtc + timbreFiscal;

    // Verify client exists
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) {
      throw new NotFoundException(`Client #${dto.clientId} introuvable`);
    }

    // Credit limit check: prevent creating invoices beyond client limit
    if (client.creditLimit && client.creditLimit > 0) {
      const outstandingResult = await this.prisma.invoice.aggregate({
        _sum: { netToPay: true },
        where: {
          clientId: dto.clientId,
          status: { in: ['VALIDATED', 'PARTIALLY_PAID'] },
        },
      });
      const outstanding = outstandingResult._sum.netToPay ?? 0;
      if (outstanding + netToPay > client.creditLimit) {
        throw new BadRequestException(
          `Plafond de crédit dépassé pour ${client.name}: encours ${outstanding} + nouveau ${netToPay} > limite ${client.creditLimit}`,
        );
      }
    }

    // Compute fiscal year BEFORE the transaction to avoid race condition
    // in reference generation — yearPrefix is deterministic from dto.date
    const currentYear = new Date(dto.date).getFullYear();
    const yearPrefix = `F-${currentYear}`;

    // Retry loop for reference generation with unique constraint handling
    const MAX_RETRIES = 3;
    let invoice: Awaited<ReturnType<typeof this.prisma.invoice.create>> | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        invoice = await this.prisma.$transaction(async (tx) => {
          // Validate all products exist
          const productIds = dto.lines.map(l => l.productPfId);
          const existingProducts = await tx.productPf.findMany({
            where: { id: { in: productIds } },
            select: { id: true },
          });
          const existingIds = new Set(existingProducts.map(p => p.id));
          const missingIds = productIds.filter(id => !existingIds.has(id));
          if (missingIds.length > 0) {
            throw new BadRequestException(`Produits introuvables: ${missingIds.join(', ')}`);
          }

          // Generate reference inside transaction: F-YYYY-NNNNN (annual sequential)
          // yearPrefix computed outside transaction to avoid recalculation on retry
          const lastInvoice = await tx.invoice.findFirst({
            where: { reference: { startsWith: yearPrefix } },
            orderBy: { reference: 'desc' },
          });

          let nextNum = 1;
          if (lastInvoice?.reference) {
            const match = lastInvoice.reference.match(/-(\d+)$/);
            if (match) nextNum = parseInt(match[1], 10) + 1;
          }

          const reference = `${yearPrefix}-${String(nextNum).padStart(5, '0')}`;

          const inv = await tx.invoice.create({
            data: {
              reference,
              clientId: dto.clientId,
              date: new Date(dto.date),
              fiscalYear: currentYear,
              totalHt,
              totalTva,
              totalTtc,
              timbreFiscal,
              timbreRate,
              netToPay,
              paymentMethod: dto.paymentMethod as any,
              status: 'DRAFT',
              userId,
              lines: {
                create: linesData.map((l) => ({
                  productPfId: l.productPfId,
                  quantity: l.quantity,
                  unitPriceHt: l.unitPriceHt,
                  remise: l.remise,
                  lineHt: l.lineHt,
                })),
              },
            },
            include: {
              client: { select: { code: true, name: true } },
              lines: true,
            },
          });

          return inv;
        }, {
          isolationLevel: 'Serializable',
          timeout: 10000,
        });

        break; // Success, exit retry loop
      } catch (error: unknown) {
        // Prisma unique constraint violation (P2002) or serialization failure (P2034/40001)
        const prismaError = error as { code?: string; message?: string };
        const isRetryable = prismaError?.code === 'P2002' ||
          prismaError?.code === 'P2034' ||
          prismaError?.message?.includes('Unique constraint') ||
          prismaError?.message?.includes('could not serialize');
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          continue; // Retry with incremented number
        }
        throw error;
      }
    }

    logger.info(`Invoice created: ${invoice!.reference} for ${client.code} — ${netToPay} centimes`, 'InvoicesService');
    return invoice!;
  }

  /**
   * Update an invoice (only if status === DRAFT)
   * Recalculates all totals when lines or paymentMethod change
   */
  async update(id: number, dto: UpdateInvoiceDto, userId: string) {
    const invoice = await this.findOne(id);

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException(
        'Seules les factures en brouillon (DRAFT) peuvent être modifiées',
      );
    }

    // Verify new client if changed
    if (dto.clientId && dto.clientId !== invoice.clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: dto.clientId },
      });
      if (!client) {
        throw new NotFoundException(`Client #${dto.clientId} introuvable`);
      }
    }

    // Determine effective values
    const effectivePaymentMethod = dto.paymentMethod || invoice.paymentMethod;
    const effectiveDate = dto.date ? new Date(dto.date) : invoice.date;

    // Build update data
    const updateData: Record<string, unknown> = {
      ...(dto.clientId && { clientId: dto.clientId }),
      ...(dto.date && { date: effectiveDate }),
      ...(dto.paymentMethod && { paymentMethod: effectivePaymentMethod }),
    };

    // If lines are provided, recalculate everything
    if (dto.lines && dto.lines.length > 0) {
      // Validate line items before processing
      for (const line of dto.lines) {
        if (line.quantity <= 0) {
          throw new BadRequestException(
            `Quantité invalide (${line.quantity}) pour le produit #${line.productPfId}: doit être > 0`,
          );
        }
        if (line.unitPriceHt < 0) {
          throw new BadRequestException(
            `Prix unitaire HT invalide (${line.unitPriceHt}) pour le produit #${line.productPfId}: doit être >= 0`,
          );
        }
      }

      const linesData = dto.lines.map((line) => {
        const grossAmount = line.quantity * line.unitPriceHt;
        const remise = Math.min(line.remise || 0, grossAmount); // Cap remise to line total
        return {
          productPfId: line.productPfId,
          quantity: line.quantity,
          unitPriceHt: line.unitPriceHt,
          remise,
          lineHt: grossAmount - remise,
        };
      });

      const totalHt = linesData.reduce((sum, l) => sum + l.lineHt, 0);
      const totalTva = Math.round(totalHt * TVA_RATE);
      const totalTtc = totalHt + totalTva;
      const { amount: timbreFiscal, rate: timbreRate } = this.calculateTimbreFiscal(totalTtc, effectivePaymentMethod);
      const netToPay = totalTtc + timbreFiscal;

      const updated = await this.prisma.$transaction(async (tx) => {
        // Validate all products exist
        const productIds = dto.lines!.map(l => l.productPfId);
        const existingProducts = await tx.productPf.findMany({
          where: { id: { in: productIds } },
          select: { id: true },
        });
        const existingIds = new Set(existingProducts.map(p => p.id));
        const missingIds = productIds.filter(id => !existingIds.has(id));
        if (missingIds.length > 0) {
          throw new BadRequestException(`Produits introuvables: ${missingIds.join(', ')}`);
        }

        // Safety check: only allow line deletion if invoice is DRAFT
        const currentInvoice = await tx.invoice.findUnique({
          where: { id },
          select: { status: true },
        });
        if (!currentInvoice || currentInvoice.status !== 'DRAFT') {
          throw new BadRequestException(
            'Suppression des lignes interdite: seules les factures en brouillon (DRAFT) peuvent être modifiées',
          );
        }

        // Delete old lines
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });

        // Update invoice with new lines
        return tx.invoice.update({
          where: { id },
          data: {
            ...updateData,
            totalHt,
            totalTva,
            totalTtc,
            timbreFiscal,
            timbreRate,
            netToPay,
            lines: {
              create: linesData.map((l) => ({
                productPfId: l.productPfId,
                quantity: l.quantity,
                unitPriceHt: l.unitPriceHt,
                remise: l.remise,
                lineHt: l.lineHt,
              })),
            },
          },
          include: {
            client: { select: { code: true, name: true } },
            lines: true,
          },
        });
      });

      logger.info(`Invoice ${updated.reference} updated with new lines by user ${userId}`, 'InvoicesService');
      return updated;
    }

    // If only paymentMethod changed (no new lines), recalculate timbre
    if (dto.paymentMethod && dto.paymentMethod !== invoice.paymentMethod) {
      const { amount: timbreFiscal, rate: timbreRate } = this.calculateTimbreFiscal(invoice.totalTtc, dto.paymentMethod);
      const netToPay = invoice.totalTtc + timbreFiscal;
      updateData.timbreFiscal = timbreFiscal;
      updateData.timbreRate = timbreRate;
      updateData.netToPay = netToPay;
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { code: true, name: true } },
        lines: true,
      },
    });

    logger.info(`Invoice ${updated.reference} updated by user ${userId}`, 'InvoicesService');
    return updated;
  }

  /**
   * Update invoice status with proper state machine
   * DRAFT → VALIDATED, CANCELLED
   * VALIDATED → PAID, PARTIALLY_PAID, CANCELLED
   * PARTIALLY_PAID → PAID, CANCELLED
   * PAID → (terminal)
   * CANCELLED → (terminal)
   * Validates client fiscal data before allowing transition to VALIDATED
   */
  async updateStatus(id: number, dto: UpdateInvoiceStatusDto, userId?: string) {
    const invoice = await this.findOne(id);

    // Status machine — validate transition
    const validTransitions: Record<string, string[]> = {
      'DRAFT': ['VALIDATED', 'CANCELLED'],
      'VALIDATED': ['PAID', 'PARTIALLY_PAID', 'CANCELLED'],
      'PARTIALLY_PAID': ['PAID', 'CANCELLED'],
      'PAID': [],      // terminal
      'CANCELLED': [], // terminal
    };

    const allowed = validTransitions[invoice.status];
    if (!allowed || !allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transition invalide: ${invoice.status} → ${dto.status}. Transitions autorisées: ${allowed?.join(', ') || 'aucune'}`
      );
    }

    // Validation fiscale obligatoire avant passage à VALIDATED
    if (dto.status === 'VALIDATED') {
      const client = await this.prisma.client.findUnique({
        where: { id: invoice.clientId },
      });

      if (!client) {
        throw new NotFoundException(`Client #${invoice.clientId} introuvable`);
      }

      const missingFields: string[] = [];
      if (!client.nif || (typeof client.nif === 'string' && client.nif.trim() === '')) missingFields.push('NIF');
      if (!client.rc || (typeof client.rc === 'string' && client.rc.trim() === '')) missingFields.push('RC');
      if (!client.ai || (typeof client.ai === 'string' && client.ai.trim() === '')) missingFields.push("AI (Article d'imposition)");

      if (missingFields.length > 0) {
        throw new BadRequestException(
          `Impossible de valider la facture : le client ${client.name} n'a pas les coordonnées fiscales complètes. ` +
          `Champs manquants : ${missingFields.join(', ')}. ` +
          `Veuillez mettre à jour la fiche client avant de valider.`,
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = { status: dto.status };

    // Cancellation tracking
    if (dto.status === 'CANCELLED') {
      updateData.cancellationReason = dto.cancellationReason || null;
      updateData.cancelledBy = userId;
      updateData.cancelledAt = new Date();
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { code: true, name: true } },
      },
    });

    logger.info(`Invoice ${updated.reference} status: ${invoice.status} → ${dto.status}`, 'InvoicesService');
    return updated;
  }
}
