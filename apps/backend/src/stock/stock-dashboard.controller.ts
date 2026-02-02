import {
  Controller,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StockDashboardService } from './stock-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STOCK DASHBOARD CONTROLLER - Endpoints pour le dashboard stock actionable
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ENDPOINTS:
 *   GET /stock/dashboard           - Dashboard complet (3 zones)
 *   GET /stock/dashboard/critical  - Uniquement zone CRITIQUE
 *   GET /stock/dashboard/count     - Compteur alertes critiques (pour badge)
 *   GET /stock/dashboard/health    - Zone santé uniquement
 *   GET /stock/dashboard/expiry    - Stats expiration DLC
 *
 * ACCÈS:
 *   - Dashboard: ADMIN, APPRO, PRODUCTION
 *   - Health metrics: ADMIN uniquement
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

@Controller('stock/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockDashboardController {
  constructor(private readonly dashboardService: StockDashboardService) {}

  /**
   * Dashboard stock complet avec les 3 zones
   * Zone Critique + Zone À Traiter + Zone Santé
   */
  @Get()
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  async getDashboard() {
    const dashboard = await this.dashboardService.getDashboard();

    return {
      success: true,
      data: dashboard,
    };
  }

  /**
   * Uniquement les alertes CRITICAL (zone rouge)
   * Pour affichage prioritaire en haut de page
   */
  @Get('critical')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  async getCriticalAlerts() {
    const dashboard = await this.dashboardService.getDashboard();

    // Flatten toutes les alertes critiques
    const criticalAlerts = [
      ...dashboard.critique.lotsExpiresToday,
      ...dashboard.critique.productsInRupture,
      ...dashboard.critique.lotsBlockedToDeclare,
      ...dashboard.critique.inventoryCriticalPending,
    ];

    return {
      success: true,
      data: {
        alerts: criticalAlerts,
        count: criticalAlerts.length,
        message:
          criticalAlerts.length > 0
            ? `${criticalAlerts.length} action(s) critique(s) requise(s)`
            : 'Aucune alerte critique',
      },
    };
  }

  /**
   * Compteur simple des alertes critiques
   * Pour badge de notification dans la nav
   */
  @Get('count')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION', 'COMMERCIAL', 'COMPTABLE')
  async getCriticalCount() {
    const count = await this.dashboardService.getCriticalAlertsCount();

    return {
      success: true,
      data: {
        criticalCount: count,
        hasCritical: count > 0,
      },
    };
  }

  /**
   * Zone santé uniquement (KPIs performance)
   * Pour widget compact ou page dédiée
   */
  @Get('health')
  @Roles('ADMIN')
  async getHealthMetrics() {
    const dashboard = await this.dashboardService.getDashboard();

    return {
      success: true,
      data: {
        metrics: dashboard.sante,
        healthScore: dashboard.summary.healthScore,
        interpretation: this.interpretHealthScore(dashboard.summary.healthScore),
      },
    };
  }

  /**
   * Stats d'expiration DLC détaillées
   */
  @Get('expiry')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  async getExpiryStats() {
    const stats = await this.dashboardService.getExpiryStats();

    return {
      success: true,
      data: {
        stats,
        summary: {
          needsImmediateAction: stats.expiredBlocked + stats.expiringJ1,
          needsAttentionSoon: stats.expiringJ3,
          upcoming: stats.expiringJ7,
        },
      },
    };
  }

  /**
   * Interprétation du score de santé
   */
  private interpretHealthScore(score: number): {
    level: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
    label: string;
    recommendation: string;
  } {
    if (score >= 90) {
      return {
        level: 'EXCELLENT',
        label: 'Excellent',
        recommendation: 'Continuez ainsi. Stock bien géré.',
      };
    }
    if (score >= 70) {
      return {
        level: 'GOOD',
        label: 'Bon',
        recommendation: 'Quelques points à surveiller. Vérifiez les alertes.',
      };
    }
    if (score >= 50) {
      return {
        level: 'WARNING',
        label: 'Attention',
        recommendation: 'Plusieurs problèmes détectés. Traitez les alertes rapidement.',
      };
    }
    return {
      level: 'CRITICAL',
      label: 'Critique',
      recommendation: 'Situation urgente. Actions immédiates requises.',
    };
  }
}
