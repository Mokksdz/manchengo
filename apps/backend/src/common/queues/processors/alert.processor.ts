/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ALERT PROCESSOR — Scan et création d'alertes asynchrones
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Traite les jobs de scan et création d'alertes métier APPRO.
 *
 * TYPES DE SCANS:
 * - scan_mp: MP critiques et ruptures
 * - scan_suppliers: Fournisseurs avec taux de retard élevé
 * - scan_production: Productions bloquées
 * - check_dlc: Lots proches de la DLC
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueService, QueueName, AlertJobData, JobPriority } from '../queue.service';
import { LoggerService } from '../../logger';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApproAlertLevel, ApproAlertType, ApproAlertEntity } from '@prisma/client';

export interface AlertScanResult {
  success: boolean;
  scanType: string;
  alertsCreated: number;
  alertsUpdated: number;
  errors: string[];
  duration: number;
}

@Injectable()
export class AlertProcessor implements OnModuleInit {
  // Seuils configurables
  private readonly SEUIL_TAUX_RETARD = 0.2; // 20%
  private readonly SEUIL_DLC_JOURS = 7; // 7 jours avant expiration

  constructor(
    private readonly queueService: QueueService,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.setContext('AlertProcessor');
  }

  onModuleInit() {
    this.queueService.registerProcessor(QueueName.ALERTS, this.process.bind(this));
    this.logger.info('Alert processor registered', 'AlertProcessor');

    // Planifier les scans automatiques
    this.scheduleAutomaticScans();
  }

  /**
   * Planifie les scans automatiques via cron
   */
  private async scheduleAutomaticScans(): Promise<void> {
    try {
      // Scan MP critiques - toutes les heures
      await this.queueService.scheduleJob(
        QueueName.ALERTS,
        'scheduled:scan_mp',
        { type: 'scan_mp' },
        '0 * * * *', // Every hour
        { priority: JobPriority.HIGH },
      );

      // Scan fournisseurs - tous les jours à 6h
      await this.queueService.scheduleJob(
        QueueName.ALERTS,
        'scheduled:scan_suppliers',
        { type: 'scan_suppliers' },
        '0 6 * * *', // Daily at 6am
        { priority: JobPriority.NORMAL },
      );

      // Check DLC - tous les jours à 7h
      await this.queueService.scheduleJob(
        QueueName.ALERTS,
        'scheduled:check_dlc',
        { type: 'check_dlc' },
        '0 7 * * *', // Daily at 7am
        { priority: JobPriority.NORMAL },
      );

      this.logger.info('Automatic alert scans scheduled', 'AlertProcessor');
    } catch (error) {
      this.logger.warn(`Failed to schedule automatic scans: ${error}`, 'AlertProcessor');
    }
  }

  /**
   * Traite un job de scan d'alertes
   */
  async process(job: Job<AlertJobData>): Promise<AlertScanResult> {
    const { type, metadata } = job.data;
    const startTime = Date.now();

    this.logger.info(`Processing alert scan: ${type}`, 'AlertProcessor', {
      jobId: job.id,
      scanType: type,
      metadata,
    });

    const errors: string[] = [];
    let alertsCreated = 0;
    let alertsUpdated = 0;

    try {
      await job.updateProgress(10);

      switch (type) {
        case 'scan_mp':
          const mpResult = await this.scanMpAlerts(job);
          alertsCreated = mpResult.created;
          alertsUpdated = mpResult.updated;
          break;

        case 'scan_suppliers':
          const supplierResult = await this.scanSupplierAlerts(job);
          alertsCreated = supplierResult.created;
          alertsUpdated = supplierResult.updated;
          break;

        case 'scan_production':
          const productionResult = await this.scanProductionAlerts(job);
          alertsCreated = productionResult.created;
          alertsUpdated = productionResult.updated;
          break;

        case 'check_dlc':
          const dlcResult = await this.checkDlcAlerts(job);
          alertsCreated = dlcResult.created;
          alertsUpdated = dlcResult.updated;
          break;

        default:
          throw new Error(`Unknown alert scan type: ${type}`);
      }

      await job.updateProgress(100);

      const duration = Date.now() - startTime;

      this.logger.info(`Alert scan completed: ${type}`, 'AlertProcessor', {
        jobId: job.id,
        alertsCreated,
        alertsUpdated,
        duration,
      });

      return {
        success: true,
        scanType: type,
        alertsCreated,
        alertsUpdated,
        errors,
        duration,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);

      this.logger.error(`Alert scan failed: ${errorMsg}`, error instanceof Error ? error.stack : undefined, 'AlertProcessor');

      return {
        success: false,
        scanType: type,
        alertsCreated,
        alertsUpdated,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCAN IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Scan des alertes MP (critiques et ruptures)
   */
  private async scanMpAlerts(job: Job): Promise<{ created: number; updated: number }> {
    let created = 0;
    const updated = 0;

    await job.updateProgress(20);

    // 1. Scanner les MP BLOQUANTES avec stock = 0
    const mpBloquantes = await this.prisma.productMp.findMany({
      where: {
        isActive: true,
        isStockTracked: true,
        criticite: 'BLOQUANTE',
      },
      select: {
        id: true,
        code: true,
        name: true,
        leadTimeFournisseur: true,
        consommationMoyJour: true,
      },
    });

    await job.updateProgress(40);

    for (const mp of mpBloquantes) {
      const stock = await this.calculateMpStock(mp.id);

      if (stock <= 0) {
        // Vérifier si alerte existe déjà
        const existing = await this.prisma.approAlert.findFirst({
          where: {
            type: ApproAlertType.MP_CRITIQUE,
            entityType: ApproAlertEntity.MP,
            entityId: mp.id,
            acknowledgedAt: null,
          },
        });

        if (!existing) {
          await this.prisma.approAlert.create({
            data: {
              type: ApproAlertType.MP_CRITIQUE,
              niveau: ApproAlertLevel.CRITICAL,
              entityType: ApproAlertEntity.MP,
              entityId: mp.id,
              message: `MP CRITIQUE: ${mp.name} (${mp.code}) - Stock: ${stock}. BLOQUE LA PRODUCTION.`,
              metadata: {
                mpId: mp.id,
                mpName: mp.name,
                mpCode: mp.code,
                currentStock: stock,
                triggeredAt: new Date().toISOString(),
              },
            },
          });
          created++;

          // Log notification (email not yet implemented)
          this.logger.info(`Critical MP alert created: ${mp.code}`, 'AlertProcessor');
        }
      }
    }

    await job.updateProgress(60);

    // 2. Scanner les MP avec couverture < leadTime (ruptures imminentes)
    const mpWithMetrics = await this.prisma.productMp.findMany({
      where: {
        isActive: true,
        isStockTracked: true,
        consommationMoyJour: { gt: 0 },
      },
      select: {
        id: true,
        code: true,
        name: true,
        leadTimeFournisseur: true,
        consommationMoyJour: true,
      },
    });

    await job.updateProgress(80);

    for (const mp of mpWithMetrics) {
      const stock = await this.calculateMpStock(mp.id);
      const joursCouverture = mp.consommationMoyJour && mp.consommationMoyJour > 0
        ? stock / mp.consommationMoyJour
        : null;

      if (joursCouverture !== null && joursCouverture < mp.leadTimeFournisseur && stock > 0) {
        const existing = await this.prisma.approAlert.findFirst({
          where: {
            type: ApproAlertType.RUPTURE,
            entityType: ApproAlertEntity.MP,
            entityId: mp.id,
            acknowledgedAt: null,
          },
        });

        if (!existing) {
          await this.prisma.approAlert.create({
            data: {
              type: ApproAlertType.RUPTURE,
              niveau: ApproAlertLevel.WARNING,
              entityType: ApproAlertEntity.MP,
              entityId: mp.id,
              message: `RUPTURE IMMINENTE: ${mp.name} (${mp.code}) - Couverture: ${joursCouverture.toFixed(1)}j < Lead time: ${mp.leadTimeFournisseur}j`,
              metadata: {
                mpId: mp.id,
                mpName: mp.name,
                mpCode: mp.code,
                joursCouverture,
                leadTime: mp.leadTimeFournisseur,
                triggeredAt: new Date().toISOString(),
              },
            },
          });
          created++;
        }
      }
    }

    return { created, updated };
  }

  /**
   * Scan des alertes fournisseurs
   */
  private async scanSupplierAlerts(job: Job): Promise<{ created: number; updated: number }> {
    let created = 0;
    const updated = 0;

    await job.updateProgress(30);

    const suppliers = await this.prisma.supplier.findMany({
      where: {
        isActive: true,
        tauxRetard: { gt: this.SEUIL_TAUX_RETARD },
      },
      select: {
        id: true,
        code: true,
        name: true,
        tauxRetard: true,
        grade: true,
      },
    });

    await job.updateProgress(60);

    for (const supplier of suppliers) {
      if (supplier.tauxRetard) {
        const newGrade = this.calculateGrade(supplier.tauxRetard);

        if (newGrade !== supplier.grade) {
          // Vérifier si alerte existe
          const existing = await this.prisma.approAlert.findFirst({
            where: {
              type: ApproAlertType.FOURNISSEUR_RETARD,
              entityType: ApproAlertEntity.SUPPLIER,
              entityId: supplier.id,
              acknowledgedAt: null,
            },
          });

          if (!existing) {
            const niveau = supplier.tauxRetard > 0.3 ? ApproAlertLevel.CRITICAL : ApproAlertLevel.WARNING;

            await this.prisma.approAlert.create({
              data: {
                type: ApproAlertType.FOURNISSEUR_RETARD,
                niveau,
                entityType: ApproAlertEntity.SUPPLIER,
                entityId: supplier.id,
                message: `FOURNISSEUR DÉGRADÉ: ${supplier.name} (${supplier.code}) - Taux retard: ${(supplier.tauxRetard * 100).toFixed(1)}%. Grade: ${supplier.grade} → ${newGrade}`,
                metadata: {
                  supplierId: supplier.id,
                  supplierName: supplier.name,
                  supplierCode: supplier.code,
                  tauxRetard: supplier.tauxRetard,
                  oldGrade: supplier.grade,
                  newGrade,
                  triggeredAt: new Date().toISOString(),
                },
              },
            });
            created++;
          }
        }
      }
    }

    return { created, updated };
  }

  /**
   * Scan des productions potentiellement bloquées
   */
  private async scanProductionAlerts(job: Job): Promise<{ created: number; updated: number }> {
    let created = 0;
    const updated = 0;

    await job.updateProgress(30);

    // Récupérer les ordres de production planifiés avec recette
    const plannedOrders = await this.prisma.productionOrder.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        recipeId: { not: null },
      },
      include: {
        recipe: {
          include: {
            items: {
              where: { productMpId: { not: null } },
              include: {
                productMp: true,
              },
            },
          },
        },
        productPf: true,
      },
    });

    await job.updateProgress(60);

    for (const order of plannedOrders) {
      if (!order.recipe) continue;

      const missingMp: Array<{ id: number; name: string; code: string; required: number; available: number }> = [];

      for (const item of order.recipe.items) {
        if (!item.productMp) continue;

        const required = Number(item.quantity) * order.batchCount;
        const available = await this.calculateMpStock(item.productMpId!);

        if (available < required) {
          missingMp.push({
            id: item.productMpId!,
            name: item.productMp.name,
            code: item.productMp.code,
            required,
            available,
          });
        }
      }

      if (missingMp.length > 0) {
        const existing = await this.prisma.approAlert.findFirst({
          where: {
            type: ApproAlertType.PRODUCTION_BLOQUEE,
            entityType: ApproAlertEntity.PRODUCTION,
            entityId: order.id,
            acknowledgedAt: null,
          },
        });

        if (!existing) {
          const mpList = missingMp.map((mp) => `${mp.name} (manque ${(mp.required - mp.available).toFixed(2)})`).join(', ');

          await this.prisma.approAlert.create({
            data: {
              type: ApproAlertType.PRODUCTION_BLOQUEE,
              niveau: ApproAlertLevel.CRITICAL,
              entityType: ApproAlertEntity.PRODUCTION,
              entityId: order.id,
              message: `PRODUCTION BLOQUÉE: ${order.productPf.name} (${order.reference}) - MP manquantes: ${mpList}`,
              metadata: {
                orderId: order.id,
                orderReference: order.reference,
                productName: order.productPf.name,
                missingMp,
                triggeredAt: new Date().toISOString(),
              },
            },
          });
          created++;
        }
      }
    }

    return { created, updated };
  }

  /**
   * Vérification des lots proches de la DLC
   */
  private async checkDlcAlerts(job: Job): Promise<{ created: number; updated: number }> {
    let created = 0;
    const updated = 0;

    await job.updateProgress(30);

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + this.SEUIL_DLC_JOURS);

    // Lots MP proches de la DLC
    const expiringLots = await this.prisma.lotMp.findMany({
      where: {
        expiryDate: {
          lte: expirationDate,
          gte: new Date(), // Pas encore expiré
        },
        status: 'AVAILABLE',
        quantityRemaining: { gt: 0 },
      },
      include: {
        product: true,
      },
    });

    await job.updateProgress(70);

    for (const lot of expiringLots) {
      if (!lot.expiryDate) continue;

      const existing = await this.prisma.approAlert.findFirst({
        where: {
          type: ApproAlertType.DLC_PROCHE,
          entityType: ApproAlertEntity.LOT,
          entityId: lot.id,
          acknowledgedAt: null,
        },
      });

      if (!existing) {
        const daysUntilExpiration = Math.ceil((lot.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        await this.prisma.approAlert.create({
          data: {
            type: ApproAlertType.DLC_PROCHE,
            niveau: daysUntilExpiration <= 3 ? ApproAlertLevel.CRITICAL : ApproAlertLevel.WARNING,
            entityType: ApproAlertEntity.LOT,
            entityId: lot.id,
            message: `DLC PROCHE: Lot ${lot.lotNumber} (${lot.product.name}) expire dans ${daysUntilExpiration} jours - Qté: ${lot.quantityRemaining}`,
            metadata: {
              lotId: lot.id,
              lotNumber: lot.lotNumber,
              mpName: lot.product.name,
              mpCode: lot.product.code,
              dlc: lot.expiryDate.toISOString(),
              daysUntilExpiration,
              currentQuantity: lot.quantityRemaining,
              triggeredAt: new Date().toISOString(),
            },
          },
        });
        created++;
      }
    }

    return { created, updated };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Calcule le stock actuel d'une MP
   */
  private async calculateMpStock(mpId: number): Promise<number> {
    const movements = await this.prisma.stockMovement.groupBy({
      by: ['movementType'],
      where: {
        productMpId: mpId,
        isDeleted: false,
      },
      _sum: { quantity: true },
    });

    let stock = 0;
    movements.forEach((m) => {
      const qty = m._sum.quantity ?? 0;
      if (m.movementType === 'IN') {
        stock += qty;
      } else {
        stock -= qty;
      }
    });

    return stock;
  }

  /**
   * Calcule le grade d'un fournisseur
   */
  private calculateGrade(tauxRetard: number): string {
    if (tauxRetard <= 0.1) return 'A';
    if (tauxRetard <= 0.2) return 'B';
    return 'C';
  }
}
