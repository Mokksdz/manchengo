import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { logger } from '../common/logger/logger.service';

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS SERVICE — CRUD Operations for Client Management
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all clients with optional type filter
   */
  async findAll(type?: string) {
    const where: Record<string, unknown> = {};
    if (type) {
      where.type = type;
    }

    return this.prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            invoices: true,
            deliveries: true,
          },
        },
      },
    });
  }

  /**
   * Get a single client by ID with relations
   */
  async findOne(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            invoices: true,
            deliveries: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client #${id} introuvable`);
    }

    return client;
  }

  /**
   * Create a new client with auto-generated code
   */
  async create(dto: CreateClientDto) {
    // Retry loop for code generation with unique constraint handling
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const client = await this.prisma.$transaction(async (tx) => {
          // Generate unique code inside transaction: CLI-001, CLI-002, etc.
          const lastClient = await tx.client.findFirst({
            where: { code: { startsWith: 'CLI-' } },
            orderBy: { code: 'desc' },
            select: { code: true },
          });

          let nextNum = 1;
          if (lastClient?.code) {
            const match = lastClient.code.match(/CLI-(\d+)/);
            if (match) nextNum = parseInt(match[1], 10) + 1;
          }

          const code = `CLI-${String(nextNum).padStart(3, '0')}`;

          return tx.client.create({
            data: {
              code,
              name: dto.name,
              type: dto.type as any || 'DISTRIBUTEUR',
              nif: dto.nif || '',
              rc: dto.rc || '',
              ai: dto.ai || '',
              nis: dto.nis || null,
              phone: dto.phone || null,
              address: dto.address || null,
            },
          });
        }, {
          isolationLevel: 'Serializable',
          timeout: 10000,
        });

        logger.info(`Client created: ${client.code} - ${dto.name}`, 'ClientsService');
        return client;
      } catch (error: unknown) {
        const prismaError = error as { code?: string; message?: string };
        const isRetryable = prismaError?.code === 'P2002' || prismaError?.code === 'P2034' ||
          prismaError?.message?.includes('could not serialize');
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          continue;
        }
        if (prismaError?.code === 'P2002') {
          throw new ConflictException('Un client avec ce code existe deja');
        }
        throw error;
      }
    }
  }

  /**
   * Update an existing client
   */
  async update(id: number, dto: UpdateClientDto) {
    await this.findOne(id); // Ensure exists

    const client = await this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type as any }),
        ...(dto.nif !== undefined && { nif: dto.nif }),
        ...(dto.rc !== undefined && { rc: dto.rc }),
        ...(dto.ai !== undefined && { ai: dto.ai }),
        ...(dto.nis !== undefined && { nis: dto.nis }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
      },
    });

    logger.info(`Client updated: ${client.code}`, 'ClientsService');
    return client;
  }

  /**
   * Check if a new amount would exceed the client's credit limit
   */
  async checkCreditLimit(clientId: number, newAmount: number): Promise<{ allowed: boolean; reason?: string }> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException(`Client #${clientId} introuvable`);
    if (!client.creditLimit) return { allowed: true }; // No limit set

    // Calculate current outstanding balance (exclude DRAFT — only confirmed invoices)
    const unpaidTotal = await this.prisma.invoice.aggregate({
      where: {
        clientId,
        status: { in: ['VALIDATED', 'PARTIALLY_PAID'] },
      },
      _sum: { netToPay: true },
    });

    const currentBalance = unpaidTotal._sum.netToPay || 0;
    const projectedBalance = currentBalance + newAmount;

    if (projectedBalance > client.creditLimit) {
      return {
        allowed: false,
        reason: `Limite de crédit dépassée: solde actuel ${currentBalance}, nouveau montant ${newAmount}, limite ${client.creditLimit}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Calculate total invoiced, paid, and outstanding balance for a client
   */
  async getClientBalance(clientId: number): Promise<{
    totalInvoiced: number;
    totalPaid: number;
    outstanding: number;
  }> {
    // Ensure client exists
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException(`Client #${clientId} introuvable`);

    const invoiced = await this.prisma.invoice.aggregate({
      where: { clientId, status: { in: ['VALIDATED', 'PARTIALLY_PAID', 'PAID'] } },
      _sum: { netToPay: true },
    });

    // Use actual Payment records for accurate paid total (includes partial payments)
    const payments = await this.prisma.payment.aggregate({
      where: { invoice: { clientId } },
      _sum: { amount: true },
    });

    const totalInvoiced = invoiced._sum.netToPay || 0;
    const totalPaid = payments._sum.amount || 0;

    return {
      totalInvoiced,
      totalPaid,
      outstanding: totalInvoiced - totalPaid,
    };
  }

  /**
   * Delete a client (only if no invoices or deliveries)
   */
  async remove(id: number) {
    const client = await this.findOne(id);

    // Check for dependencies
    const counts = await this.prisma.client.findUnique({
      where: { id },
      include: {
        _count: { select: { invoices: true, deliveries: true } },
      },
    });

    if (counts?._count.invoices || counts?._count.deliveries) {
      throw new ConflictException(
        `Impossible de supprimer: client a ${counts._count.invoices} facture(s) et ${counts._count.deliveries} livraison(s)`,
      );
    }

    await this.prisma.client.delete({ where: { id } });
    logger.info(`Client deleted: ${client.code}`, 'ClientsService');
    return { message: `Client ${client.code} supprime` };
  }
}
