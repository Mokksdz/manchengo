import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import {
  ProductType,
  UserRole,
  InventoryStatus,
  InventoryRiskLevel,
  Prisma,
} from '@prisma/client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INVENTORY SERVICE - Process inventaire sécurisé avec seuils et validations
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * WORKFLOW:
 *   1. DÉCLARATION: Compteur terrain déclare quantité physique
 *   2. ANALYSE: Système calcule écart et détermine niveau de risque
 *   3. VALIDATION: Selon risque, auto-approval ou validation ADMIN
 *   4. MOUVEMENT: Création mouvement d'ajustement si approuvé
 *
 * SEUILS (non négociables):
 *   - MP périssable: 2% auto / 5% validation / >5% double validation
 *   - MP non périssable: 3% auto / 8% validation / >8% double validation
 *   - PF: 1% auto / 3% validation / >3% double validation
 *   - Valeur > 50,000 DA: toujours double validation
 *
 * RÈGLES ANTI-FRAUDE:
 *   - Compteur ≠ Validateur (OBLIGATOIRE)
 *   - Double validation: 2 ADMIN différents
 *   - Cooldown 4h entre inventaires même produit (ajustement I2)
 *   - Détection pattern écarts négatifs consécutifs (ajustement I5)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface ToleranceConfig {
  autoApprovePercent: number;
  singleValidationPercent: number;
  criticalValueCentimes: number;
}

const TOLERANCE_CONFIG: Record<string, ToleranceConfig> = {
  MP_PERISHABLE: {
    autoApprovePercent: 2,
    singleValidationPercent: 5,
    criticalValueCentimes: 5000000, // 50,000 DA
  },
  MP_NON_PERISHABLE: {
    autoApprovePercent: 3,
    singleValidationPercent: 8,
    criticalValueCentimes: 5000000,
  },
  PF: {
    autoApprovePercent: 1,
    singleValidationPercent: 3,
    criticalValueCentimes: 5000000,
  },
};

const INVENTORY_COOLDOWN_HOURS = 4;
const CONSECUTIVE_NEGATIVE_THRESHOLD = 3;

export interface InventoryAnalysisResult {
  declarationId: number;
  theoreticalStock: number;
  declaredStock: number;
  difference: number;
  differencePercent: number;
  differenceValue: number;
  riskLevel: InventoryRiskLevel;
  status: InventoryStatus;
  requiresValidation: boolean;
  requiresDoubleValidation: boolean;
  requiresEvidence: boolean;
  suspiciousPattern: boolean;
}

export interface PendingInventory {
  id: number;
  productType: ProductType;
  productName: string;
  productCode: string;
  theoreticalStock: number;
  declaredStock: number;
  difference: number;
  differencePercent: number;
  riskLevel: InventoryRiskLevel;
  status: InventoryStatus;
  countedBy: { id: string; firstName: string; lastName: string };
  countedAt: Date;
  notes: string | null;
  hasEvidence: boolean;
}

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ÉTAPE 1: DÉCLARATION INVENTAIRE
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async declareInventory(
    data: {
      productType: ProductType;
      productId: number;
      declaredQuantity: number;
      notes?: string;
      evidencePhotos?: string[];
    },
    countedById: string,
    userRole: UserRole,
  ): Promise<InventoryAnalysisResult> {
    // 1. Vérifier rôle autorisé
    const allowedRoles: UserRole[] = ['ADMIN', 'APPRO', 'PRODUCTION'];
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        message: 'Rôle non autorisé pour déclarer un inventaire',
        allowedRoles,
      });
    }

    // 2. Vérifier cooldown (ajustement I2)
    await this.checkInventoryCooldown(
      data.productType,
      data.productId,
      countedById,
    );

    // 3. Calculer stock théorique
    const theoretical = await this.calculateTheoreticalStock(
      data.productType,
      data.productId,
    );

    // 4. Obtenir infos produit et config tolérance
    const product = await this.getProduct(data.productType, data.productId);
    const toleranceKey = this.getToleranceKey(data.productType, product);
    const tolerance = TOLERANCE_CONFIG[toleranceKey];

    // 5. Calculer écart
    const difference = data.declaredQuantity - theoretical;
    const differencePercent =
      theoretical > 0
        ? Math.abs(difference / theoretical) * 100
        : difference !== 0
          ? 100
          : 0;
    const differenceValue = Math.abs(difference) * (product.unitCost || 0);

    // 6. Analyser risque et déterminer statut
    const analysis = this.analyzeRisk(
      differencePercent,
      differenceValue,
      tolerance,
    );

    // 7. Vérifier pattern suspect (ajustement I5)
    const suspiciousPattern = await this.checkSuspiciousPattern(
      data.productType,
      data.productId,
      countedById,
      difference,
    );

    // Si pattern suspect, forcer validation même si sous seuil
    let finalStatus = analysis.status;
    if (suspiciousPattern && finalStatus === 'AUTO_APPROVED') {
      finalStatus = 'PENDING_VALIDATION';
    }

    // 8. Créer déclaration
    const declaration = await this.prisma.inventoryDeclaration.create({
      data: {
        productType: data.productType,
        productMpId: data.productType === 'MP' ? data.productId : null,
        productPfId: data.productType === 'PF' ? data.productId : null,
        theoreticalStock: theoretical,
        declaredStock: data.declaredQuantity,
        difference,
        differencePercent,
        differenceValue,
        riskLevel: analysis.riskLevel,
        status: finalStatus,
        countedById,
        notes: data.notes,
        evidencePhotos: data.evidencePhotos || [],
      },
    });

    // 9. Audit
    await this.audit.log({
      actor: { id: countedById, role: userRole },
      action: 'STOCK_INVENTORY_ADJUSTED' as any,
      severity:
        analysis.riskLevel === 'CRITICAL' ? ('SECURITY' as any) : ('INFO' as any),
      entityType: data.productType === 'MP' ? 'ProductMp' : 'ProductPf',
      entityId: String(data.productId),
      beforeState: { theoreticalStock: theoretical },
      afterState: { declaredStock: data.declaredQuantity },
      metadata: {
        declarationId: declaration.id,
        differencePercent,
        riskLevel: analysis.riskLevel,
        status: finalStatus,
        suspiciousPattern,
        autoApproved: finalStatus === 'AUTO_APPROVED',
      },
    });

    // 10. Si auto-approuvé et écart non nul, créer mouvement
    if (finalStatus === 'AUTO_APPROVED' && difference !== 0) {
      await this.createAdjustmentMovement(declaration.id, countedById);
    }

    // 11. Alertes si risque élevé
    if (
      analysis.riskLevel === 'HIGH' ||
      analysis.riskLevel === 'CRITICAL' ||
      suspiciousPattern
    ) {
      await this.createInventoryAlert(declaration.id, product, analysis, suspiciousPattern);
    }

    return {
      declarationId: declaration.id,
      theoreticalStock: theoretical,
      declaredStock: data.declaredQuantity,
      difference,
      differencePercent,
      differenceValue,
      riskLevel: analysis.riskLevel,
      status: finalStatus,
      requiresValidation: finalStatus !== 'AUTO_APPROVED',
      requiresDoubleValidation: finalStatus === 'PENDING_DOUBLE_VALIDATION',
      requiresEvidence:
        analysis.requiresEvidence && (!data.evidencePhotos?.length),
      suspiciousPattern,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ÉTAPE 2: VALIDATION INVENTAIRE (ADMIN)
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async validateInventory(
    declarationId: number,
    approvalReason: string,
    validatedById: string,
    validatorRole: UserRole,
  ): Promise<{ status: InventoryStatus; movementCreated: boolean }> {
    // 1. Vérifier rôle ADMIN
    if (validatorRole !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'ADMIN_ONLY',
        message: 'Seul un ADMIN peut valider un inventaire',
      });
    }

    // 2. Récupérer déclaration
    const declaration = await this.prisma.inventoryDeclaration.findUnique({
      where: { id: declarationId },
    });

    if (!declaration) {
      throw new NotFoundException({
        code: 'DECLARATION_NOT_FOUND',
        message: 'Déclaration inventaire non trouvée',
      });
    }

    // 3. Vérifier que validateur ≠ compteur (OBLIGATOIRE)
    if (declaration.countedById === validatedById) {
      await this.audit.log({
        actor: { id: validatedById, role: validatorRole },
        action: 'ACCESS_DENIED' as any,
        severity: 'SECURITY' as any,
        entityType: 'InventoryDeclaration',
        entityId: String(declarationId),
        metadata: {
          reason: 'SELF_VALIDATION_ATTEMPT',
          countedById: declaration.countedById,
        },
      });

      throw new ForbiddenException({
        code: 'SELF_VALIDATION_FORBIDDEN',
        message: 'Le validateur ne peut pas être la personne qui a compté',
      });
    }

    // 4. Vérifier statut valide pour validation
    const validStatuses: InventoryStatus[] = [
      'PENDING_VALIDATION',
      'PENDING_DOUBLE_VALIDATION',
    ];
    if (!validStatuses.includes(declaration.status)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: `Statut invalide pour validation: ${declaration.status}`,
        currentStatus: declaration.status,
      });
    }

    // 5. Gérer double validation
    if (declaration.status === 'PENDING_DOUBLE_VALIDATION') {
      if (!declaration.firstValidatorId) {
        // Première validation sur double validation
        await this.prisma.inventoryDeclaration.update({
          where: { id: declarationId },
          data: {
            firstValidatorId: validatedById,
            firstValidatedAt: new Date(),
            firstValidationReason: approvalReason,
            status: 'PENDING_VALIDATION', // Passe à attente 2ème validation
          },
        });

        await this.audit.log({
          actor: { id: validatedById, role: validatorRole },
          action: 'STOCK_INVENTORY_ADJUSTED' as any,
          entityType: 'InventoryDeclaration',
          entityId: String(declarationId),
          metadata: {
            step: 'FIRST_VALIDATION',
            approvalReason,
            awaitingSecondValidation: true,
          },
        });

        return { status: 'PENDING_VALIDATION', movementCreated: false };
      }

      // Vérifier que le 2ème validateur est différent du 1er
      if (declaration.firstValidatorId === validatedById) {
        throw new ForbiddenException({
          code: 'SAME_VALIDATOR_FORBIDDEN',
          message: 'Le deuxième validateur doit être différent du premier',
        });
      }
    }

    // 6. Validation finale
    await this.prisma.inventoryDeclaration.update({
      where: { id: declarationId },
      data: {
        validatedById,
        validatedAt: new Date(),
        validationReason: approvalReason,
        status: 'APPROVED',
      },
    });

    // 7. Créer mouvement d'ajustement
    let movementCreated = false;
    if (Number(declaration.difference) !== 0) {
      await this.createAdjustmentMovement(declarationId, validatedById);
      movementCreated = true;
    }

    // 8. Audit
    await this.audit.log({
      actor: { id: validatedById, role: validatorRole },
      action: 'STOCK_INVENTORY_ADJUSTED' as any,
      severity:
        declaration.riskLevel === 'CRITICAL' ? ('SECURITY' as any) : ('INFO' as any),
      entityType: 'InventoryDeclaration',
      entityId: String(declarationId),
      metadata: {
        step: 'FINAL_VALIDATION',
        approvalReason,
        difference: declaration.difference,
        differencePercent: declaration.differencePercent,
        movementCreated,
        wasDoubleValidation: declaration.firstValidatorId !== null,
      },
    });

    return { status: 'APPROVED', movementCreated };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * REJET INVENTAIRE
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async rejectInventory(
    declarationId: number,
    rejectionReason: string,
    rejectedById: string,
    rejectorRole: UserRole,
  ): Promise<void> {
    if (rejectorRole !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'ADMIN_ONLY',
        message: 'Seul un ADMIN peut rejeter un inventaire',
      });
    }

    const declaration = await this.prisma.inventoryDeclaration.findUnique({
      where: { id: declarationId },
    });

    if (!declaration) {
      throw new NotFoundException('Déclaration non trouvée');
    }

    await this.prisma.inventoryDeclaration.update({
      where: { id: declarationId },
      data: {
        status: 'REJECTED',
        rejectedById,
        rejectedAt: new Date(),
        rejectionReason,
      },
    });

    await this.audit.log({
      actor: { id: rejectedById, role: rejectorRole },
      action: 'STOCK_INVENTORY_ADJUSTED' as any,
      severity: 'WARNING' as any,
      entityType: 'InventoryDeclaration',
      entityId: String(declarationId),
      metadata: {
        step: 'REJECTED',
        rejectionReason,
        difference: declaration.difference,
      },
    });
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * QUERIES
   * ═══════════════════════════════════════════════════════════════════════════
   */

  async getPendingValidations(): Promise<PendingInventory[]> {
    const declarations = await this.prisma.inventoryDeclaration.findMany({
      where: {
        status: {
          in: ['PENDING_VALIDATION', 'PENDING_DOUBLE_VALIDATION'],
        },
      },
      include: {
        countedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ riskLevel: 'desc' }, { countedAt: 'asc' }],
    });

    const results: PendingInventory[] = [];

    for (const decl of declarations) {
      let productName = '';
      let productCode = '';

      if (decl.productType === 'MP' && decl.productMpId) {
        const product = await this.prisma.productMp.findUnique({
          where: { id: decl.productMpId },
          select: { name: true, code: true },
        });
        productName = product?.name || '';
        productCode = product?.code || '';
      } else if (decl.productType === 'PF' && decl.productPfId) {
        const product = await this.prisma.productPf.findUnique({
          where: { id: decl.productPfId },
          select: { name: true, code: true },
        });
        productName = product?.name || '';
        productCode = product?.code || '';
      }

      results.push({
        id: decl.id,
        productType: decl.productType,
        productName,
        productCode,
        theoreticalStock: Number(decl.theoreticalStock),
        declaredStock: Number(decl.declaredStock),
        difference: Number(decl.difference),
        differencePercent: Number(decl.differencePercent),
        riskLevel: decl.riskLevel,
        status: decl.status,
        countedBy: decl.countedBy,
        countedAt: decl.countedAt,
        notes: decl.notes,
        hasEvidence: decl.evidencePhotos.length > 0,
      });
    }

    return results;
  }

  async getDeclarationHistory(
    productType: ProductType,
    productId: number,
    limit = 20,
  ): Promise<any[]> {
    const where: Prisma.InventoryDeclarationWhereInput = {
      productType,
      ...(productType === 'MP'
        ? { productMpId: productId }
        : { productPfId: productId }),
    };

    return this.prisma.inventoryDeclaration.findMany({
      where,
      orderBy: { countedAt: 'desc' },
      take: limit,
      include: {
        countedBy: { select: { firstName: true, lastName: true } },
        validatedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async getDeclaration(id: number) {
    return this.prisma.inventoryDeclaration.findUnique({
      where: { id },
      include: {
        countedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        firstValidator: { select: { id: true, firstName: true, lastName: true } },
        validatedBy: { select: { id: true, firstName: true, lastName: true } },
        rejectedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * MÉTHODES PRIVÉES
   * ═══════════════════════════════════════════════════════════════════════════
   */

  private async checkInventoryCooldown(
    productType: ProductType,
    productId: number,
    _countedById: string,
  ): Promise<void> {
    const cooldownDate = new Date();
    cooldownDate.setHours(cooldownDate.getHours() - INVENTORY_COOLDOWN_HOURS);

    const recentDecl = await this.prisma.inventoryDeclaration.findFirst({
      where: {
        productType,
        ...(productType === 'MP'
          ? { productMpId: productId }
          : { productPfId: productId }),
        countedAt: { gte: cooldownDate },
        status: { notIn: ['REJECTED', 'EXPIRED'] },
      },
      orderBy: { countedAt: 'desc' },
    });

    if (recentDecl) {
      throw new BadRequestException({
        code: 'INVENTORY_COOLDOWN',
        message: `Inventaire déjà effectué il y a moins de ${INVENTORY_COOLDOWN_HOURS}h`,
        lastInventoryAt: recentDecl.countedAt,
        lastInventoryId: recentDecl.id,
      });
    }
  }

  private async checkSuspiciousPattern(
    productType: ProductType,
    productId: number,
    countedById: string,
    currentDifference: number,
  ): Promise<boolean> {
    // Si l'écart actuel n'est pas négatif, pas de pattern suspect
    if (currentDifference >= 0) return false;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDecls = await this.prisma.inventoryDeclaration.findMany({
      where: {
        productType,
        ...(productType === 'MP'
          ? { productMpId: productId }
          : { productPfId: productId }),
        countedById,
        countedAt: { gte: thirtyDaysAgo },
        status: { in: ['AUTO_APPROVED', 'APPROVED'] },
      },
      orderBy: { countedAt: 'desc' },
      take: CONSECUTIVE_NEGATIVE_THRESHOLD,
      select: { difference: true },
    });

    // Vérifier si tous les écarts récents sont négatifs
    const allNegative =
      recentDecls.length >= CONSECUTIVE_NEGATIVE_THRESHOLD - 1 &&
      recentDecls.every((d) => Number(d.difference) < 0);

    return allNegative;
  }

  private analyzeRisk(
    differencePercent: number,
    differenceValue: number,
    tolerance: ToleranceConfig,
  ): {
    riskLevel: InventoryRiskLevel;
    status: InventoryStatus;
    requiresEvidence: boolean;
  } {
    // Écart critique (valeur ou pourcentage)
    if (
      differenceValue > tolerance.criticalValueCentimes ||
      differencePercent > tolerance.singleValidationPercent * 2
    ) {
      return {
        riskLevel: 'CRITICAL',
        status: 'PENDING_DOUBLE_VALIDATION',
        requiresEvidence: true,
      };
    }

    // Écart élevé
    if (differencePercent > tolerance.singleValidationPercent) {
      return {
        riskLevel: 'HIGH',
        status: 'PENDING_VALIDATION',
        requiresEvidence: true,
      };
    }

    // Écart modéré
    if (differencePercent > tolerance.autoApprovePercent) {
      return {
        riskLevel: 'MEDIUM',
        status: 'PENDING_VALIDATION',
        requiresEvidence: false,
      };
    }

    // Écart acceptable
    return {
      riskLevel: 'LOW',
      status: 'AUTO_APPROVED',
      requiresEvidence: false,
    };
  }

  private async calculateTheoreticalStock(
    productType: ProductType,
    productId: number,
  ): Promise<number> {
    const movements = await this.prisma.stockMovement.groupBy({
      by: ['movementType'],
      where: {
        productType,
        ...(productType === 'MP'
          ? { productMpId: productId }
          : { productPfId: productId }),
        isDeleted: false,
      },
      _sum: { quantity: true },
    });

    let totalIn = 0;
    let totalOut = 0;
    for (const m of movements) {
      if (m.movementType === 'IN') {
        totalIn = m._sum.quantity ?? 0;
      } else {
        totalOut = m._sum.quantity ?? 0;
      }
    }

    return totalIn - totalOut;
  }

  private async getProduct(
    productType: ProductType,
    productId: number,
  ): Promise<{ name: string; code: string; unitCost: number | null; isPerishable?: boolean }> {
    if (productType === 'MP') {
      const product = await this.prisma.productMp.findUnique({
        where: { id: productId },
        select: { name: true, code: true, isPerishable: true },
      });
      if (!product) throw new NotFoundException('Produit MP non trouvé');
      
      // Calculer coût moyen depuis les lots
      const avgCost = await this.prisma.lotMp.aggregate({
        where: { productId, unitCost: { not: null } },
        _avg: { unitCost: true },
      });
      
      return { ...product, unitCost: avgCost._avg.unitCost };
    }

    const product = await this.prisma.productPf.findUnique({
      where: { id: productId },
      select: { name: true, code: true, priceHt: true },
    });
    if (!product) throw new NotFoundException('Produit PF non trouvé');
    return { name: product.name, code: product.code, unitCost: product.priceHt };
  }

  private getToleranceKey(
    productType: ProductType,
    product: { isPerishable?: boolean },
  ): string {
    if (productType === 'PF') return 'PF';
    return product.isPerishable !== false ? 'MP_PERISHABLE' : 'MP_NON_PERISHABLE';
  }

  private async createAdjustmentMovement(
    declarationId: number,
    approvedById: string,
  ): Promise<void> {
    const declaration = await this.prisma.inventoryDeclaration.findUnique({
      where: { id: declarationId },
    });

    if (!declaration || Number(declaration.difference) === 0) return;

    const productId =
      declaration.productType === 'MP'
        ? declaration.productMpId
        : declaration.productPfId;

    await this.prisma.stockMovement.create({
      data: {
        movementType: Number(declaration.difference) > 0 ? 'IN' : 'OUT',
        origin: 'INVENTAIRE',
        productType: declaration.productType,
        productMpId: declaration.productType === 'MP' ? productId : null,
        productPfId: declaration.productType === 'PF' ? productId : null,
        quantity: Math.abs(Number(declaration.difference)),
        userId: approvedById,
        reference: `INV-${declarationId}`,
        referenceType: 'INVENTORY',
        referenceId: declarationId,
        inventoryDeclarationId: declarationId,
      },
    });

    // Mettre à jour dernier stock physique sur le produit
    if (declaration.productType === 'MP' && declaration.productMpId) {
      await this.prisma.productMp.update({
        where: { id: declaration.productMpId },
        data: {
          lastPhysicalStock: Number(declaration.declaredStock),
          lastPhysicalStockDate: declaration.countedAt,
        },
      });
    } else if (declaration.productType === 'PF' && declaration.productPfId) {
      await this.prisma.productPf.update({
        where: { id: declaration.productPfId },
        data: {
          lastPhysicalStock: Number(declaration.declaredStock),
          lastPhysicalStockDate: declaration.countedAt,
        },
      });
    }
  }

  private async createInventoryAlert(
    declarationId: number,
    product: { name: string; code: string },
    analysis: { riskLevel: InventoryRiskLevel },
    suspiciousPattern: boolean,
  ): Promise<void> {
    const declaration = await this.prisma.inventoryDeclaration.findUnique({
      where: { id: declarationId },
      include: { countedBy: { select: { firstName: true, lastName: true } } },
    });

    if (!declaration) return;

    const alertType = suspiciousPattern
      ? 'SUSPICIOUS_INVENTORY_PATTERN'
      : 'HIGH_INVENTORY_DISCREPANCY';

    await this.prisma.alert.create({
      data: {
        type: 'LOW_STOCK_MP', // Utiliser un type existant
        severity: analysis.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        status: 'OPEN',
        title: suspiciousPattern
          ? `Pattern suspect: ${product.name}`
          : `Écart inventaire ${analysis.riskLevel}: ${product.name}`,
        message: suspiciousPattern
          ? `Pattern d'écarts négatifs consécutifs détecté pour ${product.name}. Investigation recommandée.`
          : `Écart de ${declaration.differencePercent.toFixed(1)}% détecté pour ${product.name}. Validation requise.`,
        entityType: declaration.productType === 'MP' ? 'ProductMp' : 'ProductPf',
        entityId: String(
          declaration.productType === 'MP'
            ? declaration.productMpId
            : declaration.productPfId,
        ),
        metadata: {
          alertSubType: alertType,
          declarationId,
          productCode: product.code,
          productName: product.name,
          difference: declaration.difference,
          differencePercent: declaration.differencePercent,
          riskLevel: analysis.riskLevel,
          suspiciousPattern,
          countedBy: `${declaration.countedBy.firstName} ${declaration.countedBy.lastName}`,
          actionRequired: 'VALIDATE_OR_REJECT',
        },
      },
    });
  }
}
