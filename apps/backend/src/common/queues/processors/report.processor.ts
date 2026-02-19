/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * REPORT PROCESSOR — Génération asynchrone de rapports
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Traite les jobs de génération de rapports Excel/PDF de manière asynchrone.
 *
 * RAPPORTS SUPPORTÉS:
 * - stock-mp: État des stocks MP
 * - stock-pf: État des stocks PF
 * - production: Rapport de production
 * - appro: Tableau de bord APPRO
 * - audit: Logs d'audit
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueService, QueueName, ReportJobData } from '../queue.service';
import { LoggerService } from '../../logger';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ReportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

@Injectable()
export class ReportProcessor implements OnModuleInit {
  constructor(
    private readonly queueService: QueueService,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.setContext('ReportProcessor');
  }

  onModuleInit() {
    this.queueService.registerProcessor(QueueName.REPORTS, this.process.bind(this));
    this.logger.info('Report processor registered', 'ReportProcessor');
  }

  /**
   * Traite un job de génération de rapport
   */
  async process(job: Job<ReportJobData>): Promise<ReportResult> {
    const { type, reportType, filters, userId } = job.data;

    this.logger.info(`Processing report: ${reportType}`, 'ReportProcessor', {
      jobId: job.id,
      type,
      reportType,
      userId,
    });

    try {
      await job.updateProgress(10);

      let data: unknown[];
      const fileName = `${reportType}_${new Date().toISOString().split('T')[0]}.${type}`;

      switch (reportType) {
        case 'stock-mp':
          data = await this.generateStockMpReport(filters);
          break;
        case 'stock-pf':
          data = await this.generateStockPfReport(filters);
          break;
        case 'production':
          data = await this.generateProductionReport(filters);
          break;
        case 'suppliers':
          data = await this.generateSupplierReport(filters);
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      await job.updateProgress(80);

      // TODO: Implement actual file generation with exceljs or pdfkit
      this.logger.info(`Report generated: ${fileName}`, 'ReportProcessor', {
        recordCount: data.length,
      });

      await job.updateProgress(100);

      return {
        success: true,
        fileName,
        fileSize: 0, // Would be actual size after generation
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Report generation failed: ${errorMsg}`, undefined, 'ReportProcessor');

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // REPORT GENERATORS
  // ═══════════════════════════════════════════════════════════════════════════════

  private async generateStockMpReport(filters?: Record<string, unknown>): Promise<unknown[]> {
    const whereClause: Record<string, unknown> = { isActive: true };
    if (filters?.category) {
      whereClause.category = filters.category as string;
    }

    const products = await this.prisma.productMp.findMany({
      where: whereClause,
      include: {
        lots: {
          where: { quantityRemaining: { gt: 0 } },
          select: {
            id: true,
            lotNumber: true,
            quantityRemaining: true,
            expiryDate: true,
            unitCost: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return products.map((p) => ({
      code: p.code,
      name: p.name,
      category: p.category,
      unit: p.unit,
      minStock: p.minStock,
      totalStock: p.lots.reduce((sum, lot) => sum + lot.quantityRemaining, 0),
      totalValue: p.lots.reduce((sum, lot) => sum + lot.quantityRemaining * (lot.unitCost || 0), 0),
      lotCount: p.lots.length,
    }));
  }

  private async generateStockPfReport(_filters?: Record<string, unknown>): Promise<unknown[]> {
    const products = await this.prisma.productPf.findMany({
      where: {
        isActive: true,
      },
      include: {
        lots: {
          where: { quantityRemaining: { gt: 0 } },
          select: {
            id: true,
            lotNumber: true,
            quantityRemaining: true,
            expiryDate: true,
            unitCost: true,
          },
        },
        family: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return products.map((p) => ({
      code: p.code,
      name: p.name,
      family: p.family?.name || '-',
      unit: p.unit,
      minStock: p.minStock,
      totalStock: p.lots.reduce((sum, lot) => sum + lot.quantityRemaining, 0),
      totalValue: p.lots.reduce((sum, lot) => sum + lot.quantityRemaining * (lot.unitCost || 0), 0),
      lotCount: p.lots.length,
    }));
  }

  private async generateProductionReport(filters?: Record<string, unknown>): Promise<unknown[]> {
    const startDate = filters?.startDate ? new Date(filters.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters?.endDate ? new Date(filters.endDate as string) : new Date();

    const orders = await this.prisma.productionOrder.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        productPf: { select: { code: true, name: true } },
        recipe: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => ({
      reference: o.reference,
      product: o.productPf.name,
      recipe: o.recipe?.name || '-',
      targetQuantity: o.targetQuantity,
      producedQuantity: o.quantityProduced,
      status: o.status,
      startedAt: o.startedAt,
      completedAt: o.completedAt,
    }));
  }

  private async generateSupplierReport(_filters?: Record<string, unknown>): Promise<unknown[]> {
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        isActive: true,
      },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
            receptions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return suppliers.map((s) => ({
      code: s.code,
      name: s.name,
      grade: s.grade,
      email: s.email,
      phone: s.phone,
      orderCount: s._count.purchaseOrders,
      receptionCount: s._count.receptions,
      tauxRetard: s.tauxRetard,
    }));
  }
}
