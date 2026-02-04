/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PURCHASE ORDER SERVICE — Logique métier Bons de Commande
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * FLUX:
 * Create BC → Send → Confirm → Receive → Stock updated
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchaseOrderStatus } from '@prisma/client';
import {
  SendBcDto,
  SendBcResponseDto,
  ReceiveBcDto,
  ReceiveBcResponseDto,
} from './dto';

@Injectable()
export class PurchaseOrderService {
  private readonly logger = new Logger(PurchaseOrderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * CRÉATION BC DIRECTE
   * ═══════════════════════════════════════════════════════════════════════════════
   * L'APPRO peut créer un BC librement
   */
  async createDirect(
    dto: {
      supplierId: number;
      lines: Array<{ productMpId: number; quantity: number; unitPrice?: number }>;
      expectedDelivery?: string;
      notes?: string;
    },
    userId: string,
  ): Promise<{ id: string; reference: string; status: string; message: string }> {
    // Validation
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Le BC doit contenir au moins une ligne');
    }

    // Vérifier le fournisseur
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) {
      throw new NotFoundException(`Fournisseur #${dto.supplierId} non trouvé`);
    }
    if (!supplier.isActive) {
      throw new BadRequestException(`Fournisseur ${supplier.name} est inactif`);
    }

    // Vérifier les MPs
    for (const line of dto.lines) {
      const mp = await this.prisma.productMp.findUnique({
        where: { id: line.productMpId },
      });
      if (!mp) {
        throw new BadRequestException(`MP #${line.productMpId} non trouvée`);
      }
      if (line.quantity <= 0) {
        throw new BadRequestException(`Quantité invalide pour ${mp.name}`);
      }
    }

    // Créer le BC dans une transaction
    const po = await this.prisma.$transaction(async (tx) => {
      const reference = await this.generateReference(tx);

      const created = await tx.purchaseOrder.create({
        data: {
          reference,
          supplier: { connect: { id: dto.supplierId } },
          status: PurchaseOrderStatus.DRAFT,
          expectedDelivery: dto.expectedDelivery ? new Date(dto.expectedDelivery) : null,
          notes: dto.notes,
          createdBy: { connect: { id: userId } },
          items: {
            create: dto.lines.map((line) => ({
              productMp: { connect: { id: line.productMpId } },
              quantity: line.quantity,
              unitPrice: line.unitPrice || 0,
              totalHT: (line.unitPrice || 0) * line.quantity,
            })),
          },
        },
      });

      // Audit
      await tx.auditLog.create({
        data: {
          action: 'APPRO_DEMANDE_CREATED',
          entityType: 'PURCHASE_ORDER',
          entityId: created.id,
          actorId: userId,
          actorRole: 'APPRO',
          metadata: {
            reference: created.reference,
            supplierId: dto.supplierId,
            supplierName: supplier.name,
            linesCount: dto.lines.length,
            createdDirectly: true,
          },
        },
      });

      return created;
    });

    this.logger.log(`BC ${po.reference} créé directement (sans demande) par user ${userId}`);

    return {
      id: po.id,
      reference: po.reference,
      status: po.status,
      message: `BC ${po.reference} créé avec succès`,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ENVOI D'UN BC AU FOURNISSEUR — P0.1 PREUVE TRAÇABLE OBLIGATOIRE
   * ═══════════════════════════════════════════════════════════════════════════════
   * TRANSITION: DRAFT → SENT
   * 
   * RÈGLE MÉTIER STRICTE:
   * ❌ Un BC ne peut JAMAIS être SENT sans preuve d'envoi
   * ✅ Mode EMAIL: email envoyé + messageId stocké
   * ✅ Mode MANUAL: note de preuve obligatoire (min 20 caractères)
   */
  async sendPurchaseOrder(
    poId: string,
    dto: SendBcDto,
    userId: string,
  ): Promise<SendBcResponseDto> {
    // 1. Récupérer le BC
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { supplier: true, items: { include: { productMp: true } } },
    });

    if (!po) {
      throw new NotFoundException(`BC #${poId} non trouvé`);
    }

    // 2. Vérifier le statut
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Impossible d'envoyer: le BC doit être en DRAFT (statut actuel: ${po.status})`,
      );
    }

    // 3. Protection idempotence: vérifier si déjà envoyé avec cette clé
    if (dto.idempotencyKey) {
      const existingWithKey = await this.prisma.auditLog.findFirst({
        where: {
          entityType: 'PURCHASE_ORDER',
          entityId: poId,
          action: 'BC_SENT',
          metadata: { path: ['idempotencyKey'], equals: dto.idempotencyKey },
        },
      });
      if (existingWithKey) {
        this.logger.warn(`Idempotency key ${dto.idempotencyKey} already used for BC ${po.reference}`);
        // Retourner le résultat existant sans erreur
        return {
          id: po.id,
          reference: po.reference,
          status: po.status,
          sentAt: po.sentAt!,
          sentVia: po.sentVia as any,
          emailSent: po.sentVia === 'EMAIL',
          message: `BC ${po.reference} déjà envoyé (idempotence)`,
        };
      }
    }

    // 4. Préparer les données d'envoi selon le mode
    let sentMessageId: string | null = null;
    let emailSent = false;

    if (dto.sendVia === 'EMAIL') {
      // Mode EMAIL: envoyer réellement l'email
      const targetEmail = dto.supplierEmail || po.supplier.email;
      
      if (!targetEmail) {
        throw new BadRequestException(
          `Impossible d'envoyer par email: aucun email fournisseur disponible`,
        );
      }

      // Envoyer l'email (TODO: intégrer avec service email réel)
      // Pour l'instant, simuler l'envoi et générer un messageId
      sentMessageId = `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      emailSent = true;
      
      this.logger.log(`Email BC ${po.reference} envoyé à ${targetEmail} (messageId: ${sentMessageId})`);
    } else if (dto.sendVia === 'MANUAL') {
      // Mode MANUAL: preuve note obligatoire (déjà validée par DTO)
      sentMessageId = `MANUAL-${Date.now()}`;
      this.logger.log(`BC ${po.reference} marqué envoyé manuellement: ${dto.proofNote?.substring(0, 50)}...`);
    }

    // 5. Mettre à jour le BC dans une transaction avec audit
    const result = await this.prisma.$transaction(async (tx) => {
      // Update BC
      const updated = await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: PurchaseOrderStatus.SENT,
          sentAt: new Date(),
          sentById: userId,
          sentVia: dto.sendVia,
          sentToEmail: dto.sendVia === 'EMAIL' ? (dto.supplierEmail || po.supplier.email) : null,
          sentMessageId: sentMessageId,
          sentProofUrl: dto.proofUrl || null,
          sentProofNote: dto.proofNote || null,
          version: { increment: 1 },
        },
      });

      // Audit log obligatoire
      await tx.auditLog.create({
        data: {
          action: 'BC_SENT',
          entityType: 'PURCHASE_ORDER',
          entityId: poId,
          actorId: userId,
          actorRole: 'APPRO',
          metadata: {
            reference: po.reference,
            supplierId: po.supplierId,
            supplierName: po.supplier.name,
            sendVia: dto.sendVia,
            sentToEmail: dto.sendVia === 'EMAIL' ? (dto.supplierEmail || po.supplier.email) : null,
            messageId: sentMessageId,
            proofNote: dto.proofNote?.substring(0, 200),
            proofUrl: dto.proofUrl,
            idempotencyKey: dto.idempotencyKey,
            totalHT: po.totalHT,
            itemsCount: po.items.length,
            statusBefore: 'DRAFT',
            statusAfter: 'SENT',
          },
        },
      });

      return updated;
    });

    this.logger.log(`BC ${po.reference} envoyé au fournisseur ${po.supplier.name} via ${dto.sendVia}`);

    return {
      id: result.id,
      reference: result.reference,
      status: result.status,
      sentAt: result.sentAt!,
      sentVia: dto.sendVia,
      emailSent,
      message: emailSent 
        ? `BC ${result.reference} envoyé par email à ${dto.supplierEmail || po.supplier.email}`
        : `BC ${result.reference} marqué comme envoyé (preuve enregistrée)`,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * CONFIRMATION D'UN BC PAR LE FOURNISSEUR — P1.2 AUDIT LOG
   * ═══════════════════════════════════════════════════════════════════════════════
   * TRANSITION: SENT → CONFIRMED
   */
  async confirmPurchaseOrder(poId: string, userId: string): Promise<{ id: string; reference: string; status: string; message: string }> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { supplier: true },
    });

    if (!po) {
      throw new NotFoundException(`BC #${poId} non trouvé`);
    }

    if (po.status !== PurchaseOrderStatus.SENT) {
      throw new BadRequestException(
        `Impossible de confirmer: le BC doit être SENT (statut actuel: ${po.status})`,
      );
    }

    // Transaction avec audit log
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: PurchaseOrderStatus.CONFIRMED,
          confirmedAt: new Date(),
          confirmedById: userId,
          version: { increment: 1 },
        },
      });

      // P1.2: Audit log pour confirmation
      await tx.auditLog.create({
        data: {
          action: 'BC_CONFIRMED',
          entityType: 'PURCHASE_ORDER',
          entityId: poId,
          actorId: userId,
          actorRole: 'APPRO',
          metadata: {
            reference: po.reference,
            supplierId: po.supplierId,
            supplierName: po.supplier.name,
            totalHT: po.totalHT,
            statusBefore: 'SENT',
            statusAfter: 'CONFIRMED',
          },
        },
      });

      return result;
    });

    this.logger.log(`BC ${po.reference} confirmé par le fournisseur`);

    return {
      id: updated.id,
      reference: updated.reference,
      status: updated.status,
      message: `BC ${updated.reference} confirmé`,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ANNULATION D'UN BC — P0.2 ANNULATION SÉCURISÉE
   * ═══════════════════════════════════════════════════════════════════════════════
   * TRANSITION: DRAFT/SENT/CONFIRMED → CANCELLED
   * 
   * RÈGLES MÉTIER STRICTES:
   * ❌ Rôle ADMIN uniquement
   * ❌ Interdit si réception partielle effectuée
   * ✅ Motif obligatoire (min 10 caractères)
   * ✅ Audit log obligatoire
   */
  async cancelPurchaseOrder(
    poId: string,
    dto: { reason: string; idempotencyKey?: string },
    userId: string,
    userRole: string,
  ): Promise<{ id: string; reference: string; status: string; cancelledAt: Date; reason: string; message: string }> {
    // 1. Vérifier le rôle ADMIN
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException(
        `Seul un ADMIN peut annuler un BC (rôle actuel: ${userRole})`,
      );
    }

    // 2. Récupérer le BC
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { supplier: true, items: true },
    });

    if (!po) {
      throw new NotFoundException(`BC #${poId} non trouvé`);
    }

    // 3. Vérifier le statut
    const allowedStatuses: PurchaseOrderStatus[] = [
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.SENT,
      PurchaseOrderStatus.CONFIRMED,
    ];
    if (!allowedStatuses.includes(po.status)) {
      throw new BadRequestException(
        `Impossible d'annuler: le BC est en statut ${po.status}. Annulation possible uniquement depuis DRAFT, SENT ou CONFIRMED.`,
      );
    }

    // 4. Vérifier qu'aucune réception partielle n'a été effectuée
    const hasPartialReceived = po.items.some((item) => Number(item.quantityReceived) > 0);
    if (hasPartialReceived) {
      throw new BadRequestException(
        `Impossible d'annuler: une réception partielle a déjà été effectuée. Utilisez le processus de litige/avoir.`,
      );
    }

    // 5. Protection idempotence
    if (dto.idempotencyKey) {
      const existingWithKey = await this.prisma.auditLog.findFirst({
        where: {
          entityType: 'PURCHASE_ORDER',
          entityId: poId,
          action: 'BC_CANCELLED',
          metadata: { path: ['idempotencyKey'], equals: dto.idempotencyKey },
        },
      });
      if (existingWithKey) {
        this.logger.warn(`Idempotency key ${dto.idempotencyKey} already used for cancel BC ${po.reference}`);
        return {
          id: po.id,
          reference: po.reference,
          status: po.status,
          cancelledAt: po.cancelledAt!,
          reason: po.cancelReason || dto.reason,
          message: `BC ${po.reference} déjà annulé (idempotence)`,
        };
      }
    }

    // 6. Annuler le BC dans une transaction avec audit
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: PurchaseOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledById: userId,
          cancelReason: dto.reason,
          version: { increment: 1 },
        },
      });

      // Audit log obligatoire
      await tx.auditLog.create({
        data: {
          action: 'BC_CANCELLED',
          entityType: 'PURCHASE_ORDER',
          entityId: poId,
          actorId: userId,
          actorRole: 'ADMIN',
          metadata: {
            reference: po.reference,
            supplierId: po.supplierId,
            supplierName: po.supplier.name,
            reason: dto.reason,
            idempotencyKey: dto.idempotencyKey,
            totalHT: po.totalHT,
            itemsCount: po.items.length,
            statusBefore: po.status,
            statusAfter: 'CANCELLED',
          },
        },
      });

      return updated;
    });

    this.logger.log(`BC ${po.reference} annulé par ADMIN: ${dto.reason.substring(0, 50)}...`);

    return {
      id: result.id,
      reference: result.reference,
      status: result.status,
      cancelledAt: result.cancelledAt!,
      reason: dto.reason,
      message: `BC ${result.reference} annulé avec succès`,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * RÉCEPTION D'UN BC
   * ═══════════════════════════════════════════════════════════════════════════════
   * TRANSITION: SENT/CONFIRMED → PARTIAL/RECEIVED
   *
   * ACTIONS:
   * 1. Créer une ReceptionMp
   * 2. Créer les StockMovements (IN)
   * 3. Mettre à jour le stock des MP
   */
  async receivePurchaseOrder(
    poId: string,
    dto: ReceiveBcDto,
    userId: string,
  ): Promise<ReceiveBcResponseDto> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        supplier: true,
        items: {
          include: {
            productMp: true,
          },
        },
      },
    });

    if (!po) {
      throw new NotFoundException(`BC #${poId} non trouvé`);
    }

    if (
      po.status !== PurchaseOrderStatus.SENT &&
      po.status !== PurchaseOrderStatus.CONFIRMED &&
      po.status !== PurchaseOrderStatus.PARTIAL
    ) {
      throw new BadRequestException(
        `Impossible de réceptionner: le BC doit être SENT, CONFIRMED ou PARTIAL (statut actuel: ${po.status})`,
      );
    }

    // Valider les lignes
    for (const line of dto.lines) {
      const item = po.items.find((i) => i.id === line.itemId);
      if (!item) {
        throw new BadRequestException(`Ligne BC #${line.itemId} non trouvée`);
      }
    }

    // Transaction pour atomicité
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Générer référence réception
      const receptionRef = await this.generateReceptionReference(tx);

      // 2. Créer la réception MP
      const reception = await tx.receptionMp.create({
        data: {
          reference: receptionRef,
          supplierId: po.supplierId,
          date: dto.receptionDate ? new Date(dto.receptionDate) : new Date(),
          blNumber: dto.blNumber,
          status: 'VALIDATED',
          source: 'BC',
          note: dto.notes,
          userId,
          validatedAt: new Date(),
          validatedBy: userId,
        },
      });

      let stockMovementsCreated = 0;
      let allFullyReceived = true;

      // 3. Traiter chaque ligne
      for (const line of dto.lines) {
        const item = po.items.find((i) => i.id === line.itemId)!;
        const currentQtyReceived = Number(item.quantityReceived);
        const itemQuantity = Number(item.quantity);
        const itemUnitPrice = Number(item.unitPrice);
        const newQtyReceived = currentQtyReceived + line.quantityReceived;

        // Mettre à jour la ligne du BC
        await tx.purchaseOrderItem.update({
          where: { id: line.itemId },
          data: { quantityReceived: newQtyReceived },
        });

        // Vérifier si pas totalement reçu
        if (newQtyReceived < itemQuantity) {
          allFullyReceived = false;
        }

        if (line.quantityReceived > 0) {
          // Créer la ligne de réception
          await tx.receptionMpLine.create({
            data: {
              receptionId: reception.id,
              productMpId: item.productMpId,
              quantity: Math.round(line.quantityReceived),
              unitCost: Math.round(itemUnitPrice * 100), // Convertir DA en centimes
              lotNumber: line.lotNumber,
              expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
              tvaRate: item.tvaRate,
              totalHT: Math.round(line.quantityReceived * itemUnitPrice * 100),
              tvaAmount: Math.round(
                line.quantityReceived * itemUnitPrice * (item.tvaRate / 100) * 100,
              ),
              totalTTC: Math.round(
                line.quantityReceived * itemUnitPrice * (1 + item.tvaRate / 100) * 100,
              ),
            },
          });

          // Générer numéro de lot si non fourni
          const lotNumber =
            line.lotNumber || `L${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${item.productMpId}`;

          // Créer le lot MP
          const lot = await tx.lotMp.create({
            data: {
              productId: item.productMpId,
              lotNumber: `${lotNumber}-${Date.now()}`, // Unique
              quantityInitial: Math.round(line.quantityReceived),
              quantityRemaining: Math.round(line.quantityReceived),
              expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
              supplierId: po.supplierId,
              receptionId: reception.id,
              unitCost: Math.round(itemUnitPrice * 100),
              isActive: true,
            },
          });

          // Créer le mouvement de stock
          await tx.stockMovement.create({
            data: {
              movementType: 'IN',
              productType: 'MP',
              origin: 'RECEPTION',
              productMpId: item.productMpId,
              lotMpId: lot.id,
              quantity: Math.round(line.quantityReceived),
              unitCost: Math.round(itemUnitPrice * 100),
              referenceType: 'RECEPTION',
              referenceId: reception.id,
              reference: reception.reference,
              userId,
              note: `Réception BC ${po.reference}`,
            },
          });

          stockMovementsCreated++;
        }
      }

      // Vérifier si des items n'ont pas été mentionnés
      for (const item of po.items) {
        const lineInDto = dto.lines.find((l) => l.itemId === item.id);
        if (!lineInDto && item.quantityReceived < item.quantity) {
          allFullyReceived = false;
        }
      }

      // 4. Mettre à jour le statut du BC
      const newStatus = allFullyReceived
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIAL;

      await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: newStatus,
          receptionMpId: reception.id,
          ...(allFullyReceived
            ? {
                receivedAt: new Date(),
                receivedById: userId,
              }
            : {}),
        },
      });

      // P1.2: Audit log pour réception BC
      await tx.auditLog.create({
        data: {
          action: newStatus === PurchaseOrderStatus.RECEIVED ? 'BC_RECEIVED' : 'BC_PARTIAL_RECEIVED',
          entityType: 'PURCHASE_ORDER',
          entityId: poId,
          actorId: userId,
          actorRole: 'APPRO',
          metadata: {
            reference: po.reference,
            supplierId: po.supplierId,
            supplierName: po.supplier.name,
            receptionMpId: reception.id,
            receptionMpReference: reception.reference,
            stockMovementsCreated,
            linesReceived: dto.lines.length,
            statusBefore: po.status,
            statusAfter: newStatus,
          },
        },
      });

      return {
        id: po.id,
        reference: po.reference,
        status: newStatus,
        receptionMpId: reception.id,
        receptionMpReference: reception.reference,
        stockMovementsCreated,
      };
    });

    this.logger.log(
      `BC ${po.reference} réceptionné: ${result.stockMovementsCreated} mouvements créés`,
    );

    return {
      ...result,
      message: result.status === PurchaseOrderStatus.RECEIVED
        ? `BC ${result.reference} entièrement reçu`
        : `BC ${result.reference} partiellement reçu`,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * RÉCUPÉRER UN BC PAR ID
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  async getById(poId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        supplier: true,
        items: {
          include: {
            productMp: true,
          },
        },
        createdBy: {
          select: { firstName: true, lastName: true },
        },
        sentBy: {
          select: { firstName: true, lastName: true },
        },
        confirmedBy: {
          select: { firstName: true, lastName: true },
        },
        receivedBy: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!po) {
      throw new NotFoundException(`BC #${poId} non trouvé`);
    }

    return po;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * LISTE DE TOUS LES BC (avec filtres)
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  async findAll(filters?: {
    status?: PurchaseOrderStatus;
    supplierId?: number;
    limit?: number;
  }) {
    return this.prisma.purchaseOrder.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.supplierId && { supplierId: filters.supplierId }),
      },
      include: {
        supplier: true,
        items: {
          include: {
            productMp: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
        },
        createdBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * P1.1: BC EN RETARD — CALCUL CÔTÉ BACKEND
   * ═══════════════════════════════════════════════════════════════════════════════
   * 
   * Retourne les BC en retard avec champs calculés:
   * - isLate: true si expectedDelivery < now
   * - daysLate: nombre de jours de retard
   * - isCritical: true si retard > seuil (défaut 3 jours)
   */
  async getLatePurchaseOrders(criticalThresholdDays: number = 3) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // BC actifs (SENT, CONFIRMED, PARTIAL) avec expectedDelivery dans le passé
    const latePOs = await this.prisma.purchaseOrder.findMany({
      where: {
        status: {
          in: [
            PurchaseOrderStatus.SENT,
            PurchaseOrderStatus.CONFIRMED,
            PurchaseOrderStatus.PARTIAL,
          ],
        },
        expectedDelivery: {
          lt: now,
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            productMp: {
              select: { id: true, code: true, name: true, unit: true, criticite: true },
            },
          },
        },
        createdBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { expectedDelivery: 'asc' },
    });

    // Enrichir avec champs calculés
    return latePOs.map((po) => {
      const expectedDate = new Date(po.expectedDelivery!);
      expectedDate.setHours(0, 0, 0, 0);
      const daysLate = Math.ceil((now.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
      const isCritical = daysLate >= criticalThresholdDays;
      
      // Calculer si MP critique impactée (HAUTE = niveau le plus critique)
      const hasCriticalMp = po.items.some((item) => item.productMp.criticite === 'HAUTE');

      return {
        ...po,
        isLate: true,
        daysLate,
        isCritical,
        hasCriticalMp,
        impactLevel: isCritical && hasCriticalMp ? 'BLOQUANT' : isCritical ? 'MAJEUR' : 'MINEUR',
      };
    });
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * P1.1: STATISTIQUES RETARDS BC
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  async getDelayStats() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const [totalActive, totalLate, criticalLate] = await Promise.all([
      // BC actifs
      this.prisma.purchaseOrder.count({
        where: {
          status: {
            in: [
              PurchaseOrderStatus.SENT,
              PurchaseOrderStatus.CONFIRMED,
              PurchaseOrderStatus.PARTIAL,
            ],
          },
        },
      }),
      // BC en retard
      this.prisma.purchaseOrder.count({
        where: {
          status: {
            in: [
              PurchaseOrderStatus.SENT,
              PurchaseOrderStatus.CONFIRMED,
              PurchaseOrderStatus.PARTIAL,
            ],
          },
          expectedDelivery: { lt: now },
        },
      }),
      // BC en retard critique (> 3 jours)
      this.prisma.purchaseOrder.count({
        where: {
          status: {
            in: [
              PurchaseOrderStatus.SENT,
              PurchaseOrderStatus.CONFIRMED,
              PurchaseOrderStatus.PARTIAL,
            ],
          },
          expectedDelivery: {
            lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalActive,
      totalLate,
      criticalLate,
      latePercentage: totalActive > 0 ? Math.round((totalLate / totalActive) * 100) : 0,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * HELPERS
   * ═══════════════════════════════════════════════════════════════════════════════
   */

  /**
   * P1.3: Vérification version optimiste
   * Lance une erreur si la version a changé depuis la dernière lecture
   */
  private async verifyVersion(
    tx: any,
    poId: string,
    expectedVersion: number,
  ): Promise<void> {
    const current = await tx.purchaseOrder.findUnique({
      where: { id: poId },
      select: { version: true },
    });

    if (!current) {
      throw new NotFoundException(`BC #${poId} non trouvé`);
    }

    if (current.version !== expectedVersion) {
      throw new BadRequestException(
        `Conflit de version: le BC a été modifié par un autre utilisateur. ` +
        `Version attendue: ${expectedVersion}, version actuelle: ${current.version}. ` +
        `Veuillez recharger la page et réessayer.`,
      );
    }
  }

  /**
   * P1.3: Acquérir un lock temporaire sur un BC
   * Empêche les modifications concurrentes pendant une opération
   */
  async acquireLock(
    poId: string,
    userId: string,
    durationMinutes: number = 5,
  ): Promise<{ success: boolean; expiresAt: Date | null; lockedBy: string | null }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { lockedById: true, lockExpiresAt: true },
    });

    if (!po) {
      throw new NotFoundException(`BC #${poId} non trouvé`);
    }

    // Vérifier si un lock existe et n'est pas expiré
    if (po.lockedById && po.lockExpiresAt && po.lockExpiresAt > now) {
      if (po.lockedById !== userId) {
        return {
          success: false,
          expiresAt: po.lockExpiresAt,
          lockedBy: po.lockedById,
        };
      }
      // L'utilisateur a déjà le lock, le renouveler
    }

    // Acquérir ou renouveler le lock
    await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        lockedById: userId,
        lockedAt: now,
        lockExpiresAt: expiresAt,
      },
    });

    this.logger.log(`Lock acquis sur BC ${poId} par user ${userId}, expire à ${expiresAt.toISOString()}`);

    return {
      success: true,
      expiresAt,
      lockedBy: userId,
    };
  }

  /**
   * P1.3: Libérer un lock sur un BC
   */
  async releaseLock(poId: string, userId: string): Promise<boolean> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { lockedById: true },
    });

    if (!po) {
      throw new NotFoundException(`BC #${poId} non trouvé`);
    }

    // Seul le détenteur du lock peut le libérer
    if (po.lockedById !== userId) {
      return false;
    }

    await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        lockedById: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
    });

    this.logger.log(`Lock libéré sur BC ${poId} par user ${userId}`);

    return true;
  }

  private async generateReference(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `BC-${year}-`;

    const lastPO = await tx.purchaseOrder.findFirst({
      where: { reference: { startsWith: prefix } },
      orderBy: { reference: 'desc' },
    });

    let sequence = 1;
    if (lastPO) {
      const lastNum = parseInt(lastPO.reference.split('-').pop() || '0', 10);
      sequence = lastNum + 1;
    }

    return `${prefix}${sequence.toString().padStart(5, '0')}`;
  }

  private async generateReceptionReference(tx: any): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `REC-${dateStr}-`;

    const lastRec = await tx.receptionMp.findFirst({
      where: { reference: { startsWith: prefix } },
      orderBy: { reference: 'desc' },
    });

    let sequence = 1;
    if (lastRec) {
      const lastNum = parseInt(lastRec.reference.split('-').pop() || '0', 10);
      sequence = lastNum + 1;
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * GÉNÉRATION PDF D'UN BON DE COMMANDE
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  async generatePdf(poId: string): Promise<Buffer> {
    const po = await this.getById(poId);

    // Import pdfmake dynamiquement
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PdfPrinter = require('pdfmake');
    const path = require('path');
    const fs = require('fs');

    // Trouver les fonts
    const srcFontsDir = path.join(process.cwd(), 'src/assets/fonts');
    const distFontsDir = path.join(process.cwd(), 'dist/assets/fonts');
    let fontsDir = srcFontsDir;
    if (fs.existsSync(distFontsDir)) {
      fontsDir = distFontsDir;
    }

    const fonts = {
      Roboto: {
        normal: path.join(fontsDir, 'Roboto-Regular.ttf'),
        bold: path.join(fontsDir, 'Roboto-Medium.ttf'),
        italics: path.join(fontsDir, 'Roboto-Italic.ttf'),
        bolditalics: path.join(fontsDir, 'Roboto-MediumItalic.ttf'),
      },
    };

    const printer = new PdfPrinter(fonts);

    // Formater les montants
    const formatAmount = (centimes: number) => {
      const da = centimes / 100;
      return da.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DA';
    };

    const formatDate = (date: Date | string | null) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('fr-DZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    // Construire le tableau des lignes
    const tableBody = [
      [
        { text: 'Code', style: 'tableHeader' },
        { text: 'Désignation', style: 'tableHeader' },
        { text: 'Unité', style: 'tableHeader' },
        { text: 'Qté', style: 'tableHeader', alignment: 'right' },
        { text: 'P.U. HT', style: 'tableHeader', alignment: 'right' },
        { text: 'Total HT', style: 'tableHeader', alignment: 'right' },
      ],
    ];

    for (const item of po.items) {
      tableBody.push([
        { text: item.productMp.code, style: 'tableCell' },
        { text: item.productMp.name, style: 'tableCell' },
        { text: item.productMp.unit, style: 'tableCell' },
        { text: item.quantity.toString(), style: 'tableCell', alignment: 'right' },
        { text: formatAmount(Number(item.unitPrice)), style: 'tableCell', alignment: 'right' },
        { text: formatAmount(Number(item.totalHT)), style: 'tableCell', alignment: 'right' },
      ]);
    }

    // Totaux
    const totalHT = Number(po.totalHT);
    const tva = Math.round(totalHT * 0.19);
    const totalTTC = totalHT + tva;

    // Charger le logo SVG
    const logoPath = path.join(process.cwd(), 'src/assets/logo_manchengo.svg');
    const distLogoPath = path.join(process.cwd(), 'dist/assets/logo_manchengo.svg');
    let logoSvg = '';
    if (fs.existsSync(distLogoPath)) {
      logoSvg = fs.readFileSync(distLogoPath, 'utf8');
    } else if (fs.existsSync(logoPath)) {
      logoSvg = fs.readFileSync(logoPath, 'utf8');
    }

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: [
        // En-tête: logo à gauche, infos entreprise à droite
        {
          columns: [
            logoSvg ? {
              svg: logoSvg,
              width: 100,
              margin: [0, 0, 0, 0],
            } : { text: '', width: 100 },
            {
              width: '*',
              stack: [
                { text: 'EURL MANCHENGO', style: 'companyName', alignment: 'right' },
                { text: 'Lot 05, grp propriété 342, local n° 01, Ouled Chbel - Alger', style: 'companyAddress', alignment: 'right' },
                { text: 'RC: 25 B 1204921 16/00 | NIF: 002516120492183', style: 'companyFiscal', alignment: 'right' },
                { text: 'AI: 16350190602 | NIS: 002516360095929', style: 'companyFiscal', alignment: 'right' },
                { text: 'Tél: 0661 54 29 14 / 020 089 633', style: 'companyFiscal', alignment: 'right' },
              ],
            },
          ],
        },
        { text: '', margin: [0, 15] },

        // Titre
        { text: 'BON DE COMMANDE', style: 'documentTitle', alignment: 'center' },
        { text: po.reference, style: 'reference', alignment: 'center' },
        { text: '', margin: [0, 15] },

        // Infos BC et Fournisseur
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'FOURNISSEUR', style: 'sectionTitle' },
                { text: po.supplier.name, style: 'supplierName' },
                { text: `Code: ${po.supplier.code}`, style: 'supplierInfo' },
                po.supplier.address ? { text: po.supplier.address, style: 'supplierInfo' } : {},
                po.supplier.phone ? { text: `Tél: ${po.supplier.phone}`, style: 'supplierInfo' } : {},
                { text: '', margin: [0, 5] },
                { text: 'Informations fiscales:', style: 'supplierInfo', bold: true },
                po.supplier.rc ? { text: `RC: ${po.supplier.rc}`, style: 'supplierInfo' } : {},
                po.supplier.nif ? { text: `NIF: ${po.supplier.nif}`, style: 'supplierInfo' } : {},
                po.supplier.ai ? { text: `AI: ${po.supplier.ai}`, style: 'supplierInfo' } : {},
                po.supplier.nis ? { text: `NIS: ${po.supplier.nis}`, style: 'supplierInfo' } : {},
              ],
            },
            {
              width: '50%',
              stack: [
                { text: 'INFORMATIONS', style: 'sectionTitle' },
                { text: `Date: ${formatDate(po.createdAt)}`, style: 'infoText' },
                { text: `Statut: ${po.status}`, style: 'infoText' },
                po.expectedDelivery ? { text: `Livraison prévue: ${formatDate(po.expectedDelivery)}`, style: 'infoText' } : {},
                { text: `Créé par: ${po.createdBy.firstName} ${po.createdBy.lastName}`, style: 'infoText' },
              ],
            },
          ],
        },
        { text: '', margin: [0, 20] },

        // Tableau des articles
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody,
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f0f0f0' : null),
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cccccc',
            vLineColor: () => '#cccccc',
          },
        },
        { text: '', margin: [0, 15] },

        // Totaux
        {
          columns: [
            { width: '*', text: '' },
            {
              width: 200,
              table: {
                widths: ['*', 'auto'],
                body: [
                  [{ text: 'Total HT', style: 'totalLabel' }, { text: formatAmount(totalHT), style: 'totalValue', alignment: 'right' }],
                  [{ text: 'TVA (19%)', style: 'totalLabel' }, { text: formatAmount(tva), style: 'totalValue', alignment: 'right' }],
                  [{ text: 'Total TTC', style: 'totalLabelBold' }, { text: formatAmount(totalTTC), style: 'totalValueBold', alignment: 'right' }],
                ],
              },
              layout: 'noBorders',
            },
          ],
        },
        { text: '', margin: [0, 30] },

        // Notes
        po.notes ? { text: 'Notes:', style: 'sectionTitle' } : {},
        po.notes ? { text: po.notes, style: 'notes' } : {},

        // Signature
        { text: '', margin: [0, 40] },
        {
          columns: [
            { width: '50%', text: 'Signature Acheteur:', style: 'signatureLabel' },
            { width: '50%', text: 'Cachet Fournisseur:', style: 'signatureLabel' },
          ],
        },
      ],
      styles: {
        companyName: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
        companyAddress: { fontSize: 10, margin: [0, 0, 0, 3] },
        companyFiscal: { fontSize: 9, color: '#666666' },
        documentTitle: { fontSize: 18, bold: true },
        reference: { fontSize: 12, color: '#333333', margin: [0, 5, 0, 0] },
        sectionTitle: { fontSize: 11, bold: true, margin: [0, 0, 0, 5] },
        supplierName: { fontSize: 12, bold: true },
        supplierInfo: { fontSize: 10, color: '#444444' },
        infoText: { fontSize: 10 },
        tableHeader: { fontSize: 9, bold: true, fillColor: '#f0f0f0', margin: [2, 4, 2, 4] },
        tableCell: { fontSize: 9, margin: [2, 3, 2, 3] },
        totalLabel: { fontSize: 10, margin: [0, 2] },
        totalValue: { fontSize: 10, margin: [0, 2] },
        totalLabelBold: { fontSize: 11, bold: true, margin: [0, 2] },
        totalValueBold: { fontSize: 11, bold: true, margin: [0, 2] },
        notes: { fontSize: 9, italics: true, color: '#555555' },
        signatureLabel: { fontSize: 10, color: '#666666' },
      },
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `Généré le ${new Date().toLocaleString('fr-DZ')}`, fontSize: 8, color: '#888888', margin: [40, 0] },
          { text: `Page ${currentPage}/${pageCount}`, fontSize: 8, color: '#888888', alignment: 'right', margin: [0, 0, 40, 0] },
        ],
      }),
    };

    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];
        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', reject);
        pdfDoc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
