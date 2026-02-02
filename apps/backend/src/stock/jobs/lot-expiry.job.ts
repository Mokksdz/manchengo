import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LOT EXPIRY JOB - Blocage automatique DLC + Alertes pré-expiration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * JOBS:
 *   1. blockExpiredLots() - 00:05 chaque jour
 *      Bloque automatiquement les lots dont la DLC est dépassée
 *
 *   2. alertExpiringLots() - 08:00 chaque jour
 *      Génère des alertes pour lots expirant J-7, J-3, J-1
 *
 * RÈGLES MÉTIER:
 *   - Lot DLC dépassée = BLOCKED automatiquement
 *   - Motif: DLC_EXPIRED_AUTO
 *   - Seul mouvement autorisé ensuite: PERTE
 *   - Déblocage: INTERDIT
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface ExpiredLotInfo {
  id: number;
  lotNumber: string;
  productName: string;
  quantityRemaining: number;
  expiryDate: Date;
  unitCost: number | null;
}

interface ExpiringLotInfo extends ExpiredLotInfo {
  daysUntilExpiry: number;
}

@Injectable()
export class LotExpiryJob {
  private readonly logger = new Logger(LotExpiryJob.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * JOB 1: Blocage automatique des lots DLC dépassée
   * Exécuté tous les jours à 00:05
   */
  @Cron('5 0 * * *')
  async blockExpiredLots(): Promise<{ blocked: number; totalValue: number }> {
    this.logger.log('Starting daily expired lots blocking job...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // 1. Identifier lots MP expirés non bloqués
      const expiredLotsMp = await this.prisma.$queryRaw<ExpiredLotInfo[]>`
        SELECT 
          lm.id,
          lm.lot_number as "lotNumber",
          pm.name as "productName",
          lm.quantity_remaining as "quantityRemaining",
          lm.expiry_date as "expiryDate",
          lm.unit_cost as "unitCost"
        FROM lots_mp lm
        JOIN products_mp pm ON lm.product_id = pm.id
        WHERE lm.expiry_date < ${today}
          AND lm.status = 'AVAILABLE'
          AND lm.quantity_remaining > 0
      `;

      // 2. Identifier lots PF expirés non bloqués
      const expiredLotsPf = await this.prisma.$queryRaw<ExpiredLotInfo[]>`
        SELECT 
          lp.id,
          lp.lot_number as "lotNumber",
          pp.name as "productName",
          lp.quantity_remaining as "quantityRemaining",
          lp.expiry_date as "expiryDate",
          lp.unit_cost as "unitCost"
        FROM lots_pf lp
        JOIN products_pf pp ON lp.product_id = pp.id
        WHERE lp.expiry_date < ${today}
          AND lp.status = 'AVAILABLE'
          AND lp.quantity_remaining > 0
      `;

      const totalExpired = expiredLotsMp.length + expiredLotsPf.length;

      if (totalExpired === 0) {
        this.logger.log('No expired lots found.');
        return { blocked: 0, totalValue: 0 };
      }

      // 3. Bloquer lots MP
      if (expiredLotsMp.length > 0) {
        const mpIds = expiredLotsMp.map((l) => l.id);

        await this.prisma.$executeRaw`
          UPDATE lots_mp
          SET status = 'BLOCKED',
              blocked_at = NOW(),
              blocked_reason = 'DLC_EXPIRED_AUTO'
          WHERE id = ANY(${mpIds})
        `;

        // Audit chaque lot MP
        for (const lot of expiredLotsMp) {
          await this.audit.log({
            actor: { id: 'SYSTEM', role: 'ADMIN' as any },
            action: 'STOCK_MOVEMENT_CREATED' as any,
            severity: 'WARNING' as any,
            entityType: 'LotMp',
            entityId: String(lot.id),
            metadata: {
              reason: 'DLC_EXPIRED_AUTO',
              lotNumber: lot.lotNumber,
              productName: lot.productName,
              expiryDate: lot.expiryDate,
              quantityBlocked: lot.quantityRemaining,
              estimatedValue: lot.unitCost
                ? lot.quantityRemaining * lot.unitCost
                : null,
            },
          });
        }
      }

      // 4. Bloquer lots PF
      if (expiredLotsPf.length > 0) {
        const pfIds = expiredLotsPf.map((l) => l.id);

        await this.prisma.$executeRaw`
          UPDATE lots_pf
          SET status = 'BLOCKED',
              blocked_at = NOW(),
              blocked_reason = 'DLC_EXPIRED_AUTO'
          WHERE id = ANY(${pfIds})
        `;

        // Audit chaque lot PF
        for (const lot of expiredLotsPf) {
          await this.audit.log({
            actor: { id: 'SYSTEM', role: 'ADMIN' as any },
            action: 'STOCK_MOVEMENT_CREATED' as any,
            severity: 'WARNING' as any,
            entityType: 'LotPf',
            entityId: String(lot.id),
            metadata: {
              reason: 'DLC_EXPIRED_AUTO',
              lotNumber: lot.lotNumber,
              productName: lot.productName,
              expiryDate: lot.expiryDate,
              quantityBlocked: lot.quantityRemaining,
              estimatedValue: lot.unitCost
                ? lot.quantityRemaining * lot.unitCost
                : null,
            },
          });
        }
      }

      // 5. Calculer valeur totale bloquée
      const allExpired = [...expiredLotsMp, ...expiredLotsPf];
      const totalValue = allExpired.reduce((sum, lot) => {
        return sum + (lot.unitCost ? lot.quantityRemaining * lot.unitCost : 0);
      }, 0);

      // 6. Créer alerte consolidée
      await this.createExpiredLotsAlert(allExpired, totalValue);

      this.logger.warn(
        `Blocked ${totalExpired} expired lots. Total value: ${totalValue / 100} DA`,
      );

      return { blocked: totalExpired, totalValue };
    } catch (error) {
      this.logger.error('Failed to block expired lots', error);
      throw error;
    }
  }

  /**
   * JOB 2: Alertes pré-expiration J-7, J-3, J-1
   * Exécuté tous les jours à 08:00
   */
  @Cron('0 8 * * *')
  async alertExpiringLots(): Promise<void> {
    this.logger.log('Starting daily expiring lots alert job...');

    const thresholds = [
      { days: 7, severity: 'INFO' as const, priority: 'LOW' },
      { days: 3, severity: 'WARNING' as const, priority: 'MEDIUM' },
      { days: 1, severity: 'CRITICAL' as const, priority: 'HIGH' },
    ];

    for (const { days, severity, priority } of thresholds) {
      await this.checkExpiringLots(days, severity, priority);
    }
  }

  /**
   * Vérifie les lots expirant dans X jours et crée des alertes
   */
  private async checkExpiringLots(
    days: number,
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    priority: string,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + days);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    try {
      // Lots MP expirant exactement dans X jours
      const expiringMp = await this.prisma.$queryRaw<ExpiringLotInfo[]>`
        SELECT 
          lm.id,
          lm.lot_number as "lotNumber",
          pm.name as "productName",
          lm.quantity_remaining as "quantityRemaining",
          lm.expiry_date as "expiryDate",
          lm.unit_cost as "unitCost",
          ${days} as "daysUntilExpiry"
        FROM lots_mp lm
        JOIN products_mp pm ON lm.product_id = pm.id
        WHERE lm.expiry_date >= ${targetDate}
          AND lm.expiry_date < ${nextDay}
          AND lm.status = 'AVAILABLE'
          AND lm.quantity_remaining > 0
      `;

      // Lots PF expirant exactement dans X jours
      const expiringPf = await this.prisma.$queryRaw<ExpiringLotInfo[]>`
        SELECT 
          lp.id,
          lp.lot_number as "lotNumber",
          pp.name as "productName",
          lp.quantity_remaining as "quantityRemaining",
          lp.expiry_date as "expiryDate",
          lp.unit_cost as "unitCost",
          ${days} as "daysUntilExpiry"
        FROM lots_pf lp
        JOIN products_pf pp ON lp.product_id = pp.id
        WHERE lp.expiry_date >= ${targetDate}
          AND lp.expiry_date < ${nextDay}
          AND lp.status = 'AVAILABLE'
          AND lp.quantity_remaining > 0
      `;

      const allExpiring = [...expiringMp, ...expiringPf];

      if (allExpiring.length === 0) {
        this.logger.debug(`No lots expiring in ${days} days.`);
        return;
      }

      // Créer alerte
      await this.createExpiringLotsAlert(allExpiring, days, severity, priority);

      this.logger.log(
        `Alert created: ${allExpiring.length} lots expiring in ${days} days (${severity})`,
      );
    } catch (error) {
      this.logger.error(`Failed to check lots expiring in ${days} days`, error);
    }
  }

  /**
   * Crée une alerte pour lots expirés bloqués
   */
  private async createExpiredLotsAlert(
    lots: ExpiredLotInfo[],
    totalValue: number,
  ): Promise<void> {
    const alertData = {
      type: 'STOCK_EXPIRING' as const,
      severity: 'CRITICAL' as const,
      status: 'OPEN' as const,
      title: `${lots.length} lot(s) bloqué(s) - DLC dépassée`,
      message: `${lots.length} lot(s) ont été automatiquement bloqués car leur DLC est dépassée. Valeur estimée: ${(totalValue / 100).toFixed(2)} DA. Action requise: déclarer en perte.`,
      entityType: 'LOT',
      metadata: {
        alertSubType: 'DLC_EXPIRED_BLOCKED',
        lotsCount: lots.length,
        totalValue,
        lots: lots.slice(0, 10).map((l) => ({
          // Max 10 lots dans les détails
          lotNumber: l.lotNumber,
          productName: l.productName,
          quantity: l.quantityRemaining,
          expiryDate: l.expiryDate,
        })),
        hasMore: lots.length > 10,
        actionRequired: 'DECLARE_LOSS',
      },
    };

    await this.prisma.alert.create({ data: alertData });
  }

  /**
   * Crée une alerte pour lots expirant bientôt
   */
  private async createExpiringLotsAlert(
    lots: ExpiringLotInfo[],
    days: number,
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    priority: string,
  ): Promise<void> {
    const totalValue = lots.reduce((sum, lot) => {
      return sum + (lot.unitCost ? lot.quantityRemaining * lot.unitCost : 0);
    }, 0);

    const actionMap: Record<number, string> = {
      7: 'PLAN_CONSUMPTION',
      3: 'PRIORITIZE_CONSUMPTION',
      1: 'IMMEDIATE_ACTION',
    };

    const alertData = {
      type: 'STOCK_EXPIRING' as const,
      severity: severity as any,
      status: 'OPEN' as const,
      title: `${lots.length} lot(s) expirent dans ${days} jour(s)`,
      message: `${lots.length} lot(s) expirent dans ${days} jour(s). Valeur estimée: ${(totalValue / 100).toFixed(2)} DA. Prioriser leur consommation.`,
      entityType: 'LOT',
      metadata: {
        alertSubType: `EXPIRING_J${days}`,
        daysUntilExpiry: days,
        lotsCount: lots.length,
        totalValue,
        priority,
        lots: lots.slice(0, 10).map((l) => ({
          lotNumber: l.lotNumber,
          productName: l.productName,
          quantity: l.quantityRemaining,
          expiryDate: l.expiryDate,
        })),
        hasMore: lots.length > 10,
        actionRequired: actionMap[days] || 'REVIEW',
      },
    };

    await this.prisma.alert.create({ data: alertData });
  }

  /**
   * Méthode manuelle pour forcer le check (utile pour tests)
   */
  async runManualCheck(): Promise<{
    expired: { blocked: number; totalValue: number };
  }> {
    const expired = await this.blockExpiredLots();
    await this.alertExpiringLots();
    return { expired };
  }

  /**
   * Obtient les statistiques des lots proches de l'expiration
   */
  async getExpiryStats(): Promise<{
    expiredBlocked: number;
    expiringJ1: number;
    expiringJ3: number;
    expiringJ7: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const j1 = new Date(today);
    j1.setDate(j1.getDate() + 1);

    const j3 = new Date(today);
    j3.setDate(j3.getDate() + 3);

    const j7 = new Date(today);
    j7.setDate(j7.getDate() + 7);

    const [expiredBlocked, expiringJ1, expiringJ3, expiringJ7] =
      await Promise.all([
        // Lots bloqués pour DLC
        this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM (
          SELECT id FROM lots_mp WHERE status = 'BLOCKED' AND blocked_reason = 'DLC_EXPIRED_AUTO'
          UNION ALL
          SELECT id FROM lots_pf WHERE status = 'BLOCKED' AND blocked_reason = 'DLC_EXPIRED_AUTO'
        ) t
      `,
        // Expirant demain
        this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM (
          SELECT id FROM lots_mp WHERE expiry_date >= ${today} AND expiry_date < ${j1} AND status = 'AVAILABLE'
          UNION ALL
          SELECT id FROM lots_pf WHERE expiry_date >= ${today} AND expiry_date < ${j1} AND status = 'AVAILABLE'
        ) t
      `,
        // Expirant dans 3 jours
        this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM (
          SELECT id FROM lots_mp WHERE expiry_date >= ${today} AND expiry_date < ${j3} AND status = 'AVAILABLE'
          UNION ALL
          SELECT id FROM lots_pf WHERE expiry_date >= ${today} AND expiry_date < ${j3} AND status = 'AVAILABLE'
        ) t
      `,
        // Expirant dans 7 jours
        this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM (
          SELECT id FROM lots_mp WHERE expiry_date >= ${today} AND expiry_date < ${j7} AND status = 'AVAILABLE'
          UNION ALL
          SELECT id FROM lots_pf WHERE expiry_date >= ${today} AND expiry_date < ${j7} AND status = 'AVAILABLE'
        ) t
      `,
      ]);

    return {
      expiredBlocked: Number(expiredBlocked[0].count),
      expiringJ1: Number(expiringJ1[0].count),
      expiringJ3: Number(expiringJ3[0].count),
      expiringJ7: Number(expiringJ7[0].count),
    };
  }
}
