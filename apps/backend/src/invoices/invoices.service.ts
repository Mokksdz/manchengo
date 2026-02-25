import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto, UpdateInvoiceStatusDto } from './dto/invoice.dto';
import { logger } from '../common/logger/logger.service';

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICES SERVICE — Facturation avec calcul TVA algerienne
// ═══════════════════════════════════════════════════════════════════════════════
// - Montants en centimes (precision sans float)
// - TVA 19% standard
// - Timbre fiscal 50 DA (5000 centimes) si paiement especes
// - Reference auto: F-YYMMDD-NNN
// ═══════════════════════════════════════════════════════════════════════════════

const TVA_RATE = 0.19; // 19% TVA Algerie
const TIMBRE_FISCAL = 5000; // 50 DA en centimes

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all invoices with filters
   */
  async findAll(status?: string, clientId?: number) {
    const where: any = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;

    return this.prisma.invoice.findMany({
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

    return invoice;
  }

  /**
   * Create a new invoice with lines and auto-calculation
   */
  async create(dto: CreateInvoiceDto, userId: string) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Une facture doit contenir au moins une ligne');
    }

    // Generate reference: F-YYMMDD-NNN
    const today = new Date(dto.date);
    const datePrefix = today.toISOString().slice(2, 10).replace(/-/g, '');
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        reference: { startsWith: `F-${datePrefix}` },
      },
      orderBy: { reference: 'desc' },
    });

    let nextNum = 1;
    if (lastInvoice?.reference) {
      const match = lastInvoice.reference.match(/-(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    const reference = `F-${datePrefix}-${String(nextNum).padStart(3, '0')}`;

    // Calculate totals
    const linesData = dto.lines.map((line) => ({
      productPfId: line.productPfId,
      quantity: line.quantity,
      unitPriceHt: line.unitPriceHt,
      lineHt: line.quantity * line.unitPriceHt,
    }));

    const totalHt = linesData.reduce((sum, l) => sum + l.lineHt, 0);
    const totalTva = Math.round(totalHt * TVA_RATE);
    const totalTtc = totalHt + totalTva;
    const timbreFiscal = dto.paymentMethod === 'ESPECES' ? TIMBRE_FISCAL : 0;
    const netToPay = totalTtc + timbreFiscal;

    // Verify client exists
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) {
      throw new NotFoundException(`Client #${dto.clientId} introuvable`);
    }

    // Create invoice with lines in transaction
    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          reference,
          clientId: dto.clientId,
          date: new Date(dto.date),
          totalHt,
          totalTva,
          totalTtc,
          timbreFiscal,
          netToPay,
          paymentMethod: dto.paymentMethod as any,
          status: 'DRAFT',
          userId,
          lines: {
            create: linesData.map((l) => ({
              productPfId: l.productPfId,
              quantity: l.quantity,
              unitPriceHt: l.unitPriceHt,
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
    });

    logger.info(`Invoice created: ${reference} for ${client.code} — ${netToPay} centimes`, 'InvoicesService');
    return invoice;
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
    const effectiveClientId = dto.clientId || invoice.clientId;

    // Build update data
    const updateData: any = {
      ...(dto.clientId && { clientId: dto.clientId }),
      ...(dto.date && { date: effectiveDate }),
      ...(dto.paymentMethod && { paymentMethod: effectivePaymentMethod }),
    };

    // If lines are provided, recalculate everything
    if (dto.lines && dto.lines.length > 0) {
      const linesData = dto.lines.map((line) => ({
        productPfId: line.productPfId,
        quantity: line.quantity,
        unitPriceHt: line.unitPriceHt,
        lineHt: line.quantity * line.unitPriceHt,
      }));

      const totalHt = linesData.reduce((sum, l) => sum + l.lineHt, 0);
      const totalTva = Math.round(totalHt * TVA_RATE);
      const totalTtc = totalHt + totalTva;
      const timbreFiscal = effectivePaymentMethod === 'ESPECES' ? TIMBRE_FISCAL : 0;
      const netToPay = totalTtc + timbreFiscal;

      const updated = await this.prisma.$transaction(async (tx) => {
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
            netToPay,
            lines: {
              create: linesData.map((l) => ({
                productPfId: l.productPfId,
                quantity: l.quantity,
                unitPriceHt: l.unitPriceHt,
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
      const timbreFiscal = dto.paymentMethod === 'ESPECES' ? TIMBRE_FISCAL : 0;
      const netToPay = invoice.totalTtc + timbreFiscal;
      updateData.timbreFiscal = timbreFiscal;
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
   * Update invoice status (DRAFT → PAID or CANCELLED)
   * Validates client fiscal data before allowing DRAFT → PAID
   */
  async updateStatus(id: number, dto: UpdateInvoiceStatusDto) {
    const invoice = await this.findOne(id);

    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Impossible de modifier une facture annulee');
    }

    if (invoice.status === 'PAID' && dto.status === 'DRAFT') {
      throw new BadRequestException('Impossible de remettre en brouillon une facture payee');
    }

    // Validation fiscale obligatoire avant passage à PAID
    if (dto.status === 'PAID' && invoice.status === 'DRAFT') {
      const client = await this.prisma.client.findUnique({
        where: { id: invoice.clientId },
      });

      if (client) {
        const missingFields: string[] = [];
        if (!client.nif || client.nif.trim() === '') missingFields.push('NIF');
        if (!client.rc || client.rc.trim() === '') missingFields.push('RC');
        if (!client.ai || client.ai.trim() === '') missingFields.push("AI (Article d'imposition)");

        if (missingFields.length > 0) {
          throw new BadRequestException(
            `Impossible de valider la facture : le client ${client.name} n'a pas les coordonnées fiscales complètes. ` +
            `Champs manquants : ${missingFields.join(', ')}. ` +
            `Veuillez mettre à jour la fiche client avant de valider.`,
          );
        }
      }
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: dto.status as any },
      include: {
        client: { select: { code: true, name: true } },
      },
    });

    logger.info(`Invoice ${updated.reference} status: ${invoice.status} → ${dto.status}`, 'InvoicesService');
    return updated;
  }
}
