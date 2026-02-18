/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * APPRO ALERT SERVICE V1.2 - Alertes métier avec accusé de réception
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Module audit-ready pour la gestion des alertes APPRO.
 * 
 * RÈGLES MÉTIER CRITIQUES:
 * - Une alerte CRITICAL non accusée DOIT bloquer certaines actions
 * - Pas de duplication d'alertes identiques non accusées
 * - Traçabilité complète: qui a vu quoi, quand
 * 
 * @author Manchengo ERP Team
 * @version 1.2.0 - Audit Ready
 */

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  ApproAlertType, 
  ApproAlertLevel, 
  ApproAlertEntity,
  ApproAlert,
} from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateApproAlertInput {
  type: ApproAlertType;
  niveau: ApproAlertLevel;
  entityType: ApproAlertEntity;
  entityId?: number;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ApproAlertWithUser extends ApproAlert {
  acknowledgedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class ApproAlertService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // CRÉATION D'ALERTES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Crée une alerte APPRO si elle n'existe pas déjà (non accusée)
   * 
   * RÈGLE MÉTIER: Pas de duplication d'alertes identiques non accusées
   * Une alerte est considérée identique si: même type + même entityId + non accusée
   */
  async createAlert(input: CreateApproAlertInput): Promise<ApproAlert | null> {
    // Vérifier si une alerte identique non accusée existe déjà
    const existingAlert = await this.prisma.approAlert.findFirst({
      where: {
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        acknowledgedAt: null, // Non accusée
      },
    });

    if (existingAlert) {
      // RÈGLE: Pas de duplication - retourner l'alerte existante
      return existingAlert;
    }

    // Créer la nouvelle alerte
    return this.prisma.approAlert.create({
      data: {
        type: input.type,
        niveau: input.niveau,
        entityType: input.entityType,
        entityId: input.entityId,
        message: input.message,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
      },
    });
  }

  /**
   * Crée une alerte MP_CRITIQUE
   * Déclencheur: MP BLOQUANTE avec stock = 0
   */
  async createMpCritiqueAlert(
    mpId: number,
    mpName: string,
    mpCode: string,
    currentStock: number,
  ): Promise<ApproAlert | null> {
    return this.createAlert({
      type: ApproAlertType.MP_CRITIQUE,
      niveau: ApproAlertLevel.CRITICAL,
      entityType: ApproAlertEntity.MP,
      entityId: mpId,
      message: `MP CRITIQUE: ${mpName} (${mpCode}) - Stock: ${currentStock}. BLOQUE LA PRODUCTION.`,
      metadata: {
        mpId,
        mpName,
        mpCode,
        currentStock,
        triggeredAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Crée une alerte RUPTURE
   * Déclencheur: MP avec joursCouverture < leadTime
   */
  async createRuptureAlert(
    mpId: number,
    mpName: string,
    mpCode: string,
    joursCouverture: number | null,
    leadTime: number,
  ): Promise<ApproAlert | null> {
    const joursDisplay = joursCouverture === null ? '∞' : joursCouverture.toFixed(1);
    
    return this.createAlert({
      type: ApproAlertType.RUPTURE,
      niveau: ApproAlertLevel.WARNING,
      entityType: ApproAlertEntity.MP,
      entityId: mpId,
      message: `RUPTURE IMMINENTE: ${mpName} (${mpCode}) - Couverture: ${joursDisplay}j < Lead time: ${leadTime}j`,
      metadata: {
        mpId,
        mpName,
        mpCode,
        joursCouverture,
        leadTime,
        triggeredAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Crée une alerte PRODUCTION_BLOQUEE
   * Déclencheur: /check-production retourne une impossibilité
   * 
   * RÈGLE MÉTIER CRITIQUE: Toute production bloquée DOIT créer une alerte
   */
  async createProductionBloqueeAlert(
    recipeId: number,
    recipeName: string,
    missingMp: Array<{ id: number; name: string; code: string; required: number; available: number }>,
  ): Promise<ApproAlert | null> {
    const mpList = missingMp.map(mp => `${mp.name} (manque ${mp.required - mp.available})`).join(', ');
    
    return this.createAlert({
      type: ApproAlertType.PRODUCTION_BLOQUEE,
      niveau: ApproAlertLevel.CRITICAL,
      entityType: ApproAlertEntity.PRODUCTION,
      entityId: recipeId,
      message: `PRODUCTION BLOQUÉE: ${recipeName} - MP manquantes: ${mpList}`,
      metadata: {
        recipeId,
        recipeName,
        missingMp,
        triggeredAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Crée une alerte FOURNISSEUR_RETARD
   * Déclencheur: Fournisseur avec tauxRetard > seuil (défaut: 20%)
   */
  async createFournisseurRetardAlert(
    supplierId: number,
    supplierName: string,
    supplierCode: string,
    tauxRetard: number,
    oldGrade: string,
    newGrade: string,
  ): Promise<ApproAlert | null> {
    return this.createAlert({
      type: ApproAlertType.FOURNISSEUR_RETARD,
      niveau: tauxRetard > 0.30 ? ApproAlertLevel.CRITICAL : ApproAlertLevel.WARNING,
      entityType: ApproAlertEntity.SUPPLIER,
      entityId: supplierId,
      message: `FOURNISSEUR DÉGRADÉ: ${supplierName} (${supplierCode}) - Taux retard: ${(tauxRetard * 100).toFixed(1)}%. Grade: ${oldGrade} → ${newGrade}`,
      metadata: {
        supplierId,
        supplierName,
        supplierCode,
        tauxRetard,
        oldGrade,
        newGrade,
        triggeredAt: new Date().toISOString(),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ACCUSÉ DE RÉCEPTION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Accuse réception d'une alerte
   * 
   * RÈGLE MÉTIER: Une alerte CRITICAL non accusée ne peut pas être ignorée
   * L'accusé de réception est la preuve que l'utilisateur a vu l'alerte
   */
  async acknowledgeAlert(alertId: number, userId: string): Promise<ApproAlert> {
    const alert = await this.prisma.approAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new BadRequestException(`Alerte ${alertId} introuvable`);
    }

    if (alert.acknowledgedAt) {
      throw new BadRequestException(`Alerte ${alertId} déjà accusée`);
    }

    return this.prisma.approAlert.update({
      where: { id: alertId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
      include: {
        acknowledgedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LECTURE DES ALERTES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Récupère toutes les alertes APPRO
   */
  async getAllAlerts(limit = 100): Promise<ApproAlertWithUser[]> {
    return this.prisma.approAlert.findMany({
      take: limit,
      orderBy: [
        { niveau: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        acknowledgedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Récupère les alertes actives (non accusées)
   */
  async getActiveAlerts(): Promise<ApproAlertWithUser[]> {
    return this.prisma.approAlert.findMany({
      where: {
        acknowledgedAt: null,
      },
      orderBy: [
        { niveau: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        acknowledgedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Récupère les alertes CRITICAL non accusées
   * 
   * RÈGLE MÉTIER: Ces alertes DOIVENT être visibles partout
   */
  async getCriticalUnacknowledgedAlerts(): Promise<ApproAlert[]> {
    return this.prisma.approAlert.findMany({
      where: {
        niveau: ApproAlertLevel.CRITICAL,
        acknowledgedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Vérifie s'il existe des alertes CRITICAL non accusées
   * 
   * RÈGLE MÉTIER: Peut être utilisé pour bloquer certaines actions
   * Exemple: Empêcher de lancer une production si alertes critiques en attente
   */
  async hasCriticalUnacknowledgedAlerts(): Promise<boolean> {
    const count = await this.prisma.approAlert.count({
      where: {
        niveau: ApproAlertLevel.CRITICAL,
        acknowledgedAt: null,
      },
    });
    return count > 0;
  }

  /**
   * Compte les alertes par niveau
   */
  async getAlertCounts(): Promise<{
    total: number;
    critical: number;
    warning: number;
    info: number;
    unacknowledged: number;
    criticalUnacknowledged: number;
  }> {
    const [total, critical, warning, info, unacknowledged, criticalUnacknowledged] = await Promise.all([
      this.prisma.approAlert.count(),
      this.prisma.approAlert.count({ where: { niveau: ApproAlertLevel.CRITICAL } }),
      this.prisma.approAlert.count({ where: { niveau: ApproAlertLevel.WARNING } }),
      this.prisma.approAlert.count({ where: { niveau: ApproAlertLevel.INFO } }),
      this.prisma.approAlert.count({ where: { acknowledgedAt: null } }),
      this.prisma.approAlert.count({ 
        where: { 
          niveau: ApproAlertLevel.CRITICAL, 
          acknowledgedAt: null 
        } 
      }),
    ]);

    return { total, critical, warning, info, unacknowledged, criticalUnacknowledged };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCAN AUTOMATIQUE DES ALERTES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Seuil de taux de retard pour déclencher une alerte fournisseur
   * Valeur: 20% = 0.2
   */
  private readonly SEUIL_TAUX_RETARD = 0.2;

  /**
   * Scan et création automatique des alertes
   * À appeler périodiquement (cron job) ou après certaines actions
   * 
   * Vérifie:
   * 1. MP BLOQUANTE avec stock = 0 → MP_CRITIQUE
   * 2. MP avec joursCouverture < leadTime → RUPTURE
   * 3. Fournisseur avec tauxRetard > seuil → FOURNISSEUR_RETARD
   */
  async scanAndCreateAlerts(): Promise<{
    mpCritiques: number;
    ruptures: number;
    fournisseurs: number;
  }> {
    let mpCritiques = 0;
    let ruptures = 0;
    let fournisseurs = 0;

    // 1. Scanner les MP BLOQUANTES avec stock = 0
    // Utilisation du service APPRO existant pour calculer les stocks
    const criticalMpAlerts = await this.scanMpCritiques();
    mpCritiques = criticalMpAlerts;

    // 2. Scanner les MP avec couverture < leadTime
    const ruptureAlerts = await this.scanRuptures();
    ruptures = ruptureAlerts;

    // 3. Scanner les fournisseurs avec taux retard élevé
    const fournisseurAlerts = await this.scanFournisseurs();
    fournisseurs = fournisseurAlerts;

    return { mpCritiques, ruptures, fournisseurs };
  }

  /**
   * Scan les MP critiques (BLOQUANTE avec stock = 0)
   */
  private async scanMpCritiques(): Promise<number> {
    // Récupérer les MP BLOQUANTES + MP utilisées dans des recettes actives (mandatory)
    const mpBloquantes = await this.prisma.productMp.findMany({
      where: {
        isActive: true,
        isStockTracked: true,
        OR: [
          { criticite: 'BLOQUANTE' },
          { recipeItems: { some: { recipe: { isActive: true }, isMandatory: true } } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    let created = 0;

    for (const mp of mpBloquantes) {
      // Calculer le stock actuel
      const stock = await this.calculateMpStock(mp.id);
      
      if (stock <= 0) {
        const alert = await this.createMpCritiqueAlert(mp.id, mp.name, mp.code, stock);
        if (alert && !alert.acknowledgedAt) {
          created++;
        }
      }
    }

    return created;
  }

  /**
   * Scan les MP avec couverture < leadTime
   */
  private async scanRuptures(): Promise<number> {
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

    let created = 0;

    for (const mp of mpWithMetrics) {
      const stock = await this.calculateMpStock(mp.id);
      const joursCouverture = mp.consommationMoyJour && mp.consommationMoyJour > 0
        ? stock / mp.consommationMoyJour
        : null;

      if (joursCouverture !== null && joursCouverture < mp.leadTimeFournisseur) {
        const alert = await this.createRuptureAlert(
          mp.id, 
          mp.name, 
          mp.code, 
          joursCouverture, 
          mp.leadTimeFournisseur
        );
        if (alert && !alert.acknowledgedAt) {
          created++;
        }
      }
    }

    return created;
  }

  /**
   * Scan les fournisseurs avec taux retard élevé
   */
  private async scanFournisseurs(): Promise<number> {
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

    let created = 0;

    for (const supplier of suppliers) {
      if (supplier.tauxRetard) {
        // Calculer le nouveau grade
        const newGrade = this.calculateGrade(supplier.tauxRetard);
        
        if (newGrade !== supplier.grade) {
          const alert = await this.createFournisseurRetardAlert(
            supplier.id,
            supplier.name,
            supplier.code,
            supplier.tauxRetard,
            supplier.grade,
            newGrade,
          );
          if (alert && !alert.acknowledgedAt) {
            created++;
          }
        }
      }
    }

    return created;
  }

  /**
   * Calcule le grade d'un fournisseur basé sur son taux de retard
   *
   * SEUILS ALIGNÉS avec les alertes:
   * - A: ≤10% retard (excellent)
   * - B: ≤20% retard (acceptable) → WARNING déclenché à >20%
   * - C: >20% retard (dégradé)   → CRITICAL déclenché à >30%
   */
  private calculateGrade(tauxRetard: number): string {
    if (tauxRetard <= 0.1) return 'A';
    if (tauxRetard <= 0.2) return 'B';
    return 'C';
  }

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
    movements.forEach(m => {
      const qty = m._sum.quantity ?? 0;
      if (m.movementType === 'IN') {
        stock += qty;
      } else {
        stock -= qty;
      }
    });

    return stock;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // V1: REPORT D'ALERTE AVEC MOTIF (AUDIT)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Reporter une alerte MP V1
   * 
   * RÈGLES MÉTIER:
   * - Motif obligatoire (min 10 caractères)
   * - Durée explicite: 4h, 12h ou 24h
   * - RUPTURE non reportable (stock = 0)
   * - Max 2 reports consécutifs pour la même MP
   * - Audit: action + user + date + motif + durée
   */
  async postponeMpAlert(
    mpId: number,
    duration: string,
    reason: string,
    userId: string,
  ): Promise<{ success: boolean; expiresAt: string }> {
    // Validation durée
    const validDurations = ['4h', '12h', '24h'];
    if (!validDurations.includes(duration)) {
      throw new BadRequestException(`Durée invalide. Valeurs acceptées: ${validDurations.join(', ')}`);
    }

    // Validation motif
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('Le motif doit contenir au moins 10 caractères');
    }

    // Vérifier que la MP existe
    const mp = await this.prisma.productMp.findUnique({
      where: { id: mpId },
    });
    if (!mp) {
      throw new BadRequestException(`MP ${mpId} introuvable`);
    }

    // Calculer le stock actuel
    const currentStock = await this.calculateMpStock(mpId);

    // RÈGLE: RUPTURE non reportable
    if (currentStock <= 0) {
      throw new ForbiddenException('Les alertes RUPTURE (stock = 0) ne peuvent pas être reportées');
    }

    // Vérifier le nombre de reports consécutifs (max 2)
    const recentPostpones = await this.prisma.auditLog.count({
      where: {
        action: 'APPRO_ALERT_ACKNOWLEDGED',
        entityType: 'ProductMp',
        entityId: mpId.toString(),
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 jours
        },
        metadata: {
          path: ['postponed'],
          equals: true,
        },
      },
    });

    if (recentPostpones >= 2) {
      throw new ForbiddenException('Maximum 2 reports consécutifs atteint pour cette MP. Veuillez créer un BC.');
    }

    // Calculer l'expiration
    const durationHours = parseInt(duration.replace('h', ''));
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    // Créer l'entrée d'audit
    await this.prisma.auditLog.create({
      data: {
        action: 'APPRO_ALERT_ACKNOWLEDGED',
        entityType: 'ProductMp',
        entityId: mpId.toString(),
        actorId: userId,
        actorRole: 'APPRO',
        metadata: {
          mpName: mp.name,
          mpCode: mp.code,
          currentStock,
          postponeDuration: duration,
          reason: reason.trim(),
          expiresAt: expiresAt.toISOString(),
          postponed: true,
        },
      },
    });

    // Fetch existing alerts to preserve metadata
    const existingAlerts = await this.prisma.approAlert.findMany({
      where: {
        entityType: 'MP',
        entityId: mpId,
        acknowledgedAt: null,
      },
      select: { id: true, metadata: true },
    });

    for (const alert of existingAlerts) {
      const existingMetadata = (alert.metadata as Record<string, unknown>) || {};
      await this.prisma.approAlert.update({
        where: { id: alert.id },
        data: {
          metadata: {
            ...existingMetadata,
            postponed: true,
            postponeReason: reason.trim(),
            postponeDuration: duration,
            postponeExpiresAt: expiresAt.toISOString(),
            postponedAt: new Date().toISOString(),
            postponedBy: userId,
          },
        },
      });
    }

    return {
      success: true,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
