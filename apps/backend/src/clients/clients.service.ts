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
    const where: any = {};
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
    // Generate unique code: CLI-001, CLI-002, etc.
    const lastClient = await this.prisma.client.findFirst({
      orderBy: { id: 'desc' },
      select: { code: true },
    });

    let nextNum = 1;
    if (lastClient?.code) {
      const match = lastClient.code.match(/CLI-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    const code = `CLI-${String(nextNum).padStart(3, '0')}`;

    try {
      const client = await this.prisma.client.create({
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

      logger.info(`Client created: ${code} - ${dto.name}`, 'ClientsService');
      return client;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Un client avec ce code existe deja');
      }
      throw error;
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
