import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DemandeApproStatus, DemandeApproPriority, UserRole } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// DEMANDES MP SERVICE
// ═══════════════════════════════════════════════════════════════════════════════
// Gestion des demandes d'approvisionnement MP par la PRODUCTION
// Workflow: BROUILLON → SOUMISE → VALIDEE/REJETEE → EN_COURS_COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateDemandeDto {
  priority?: DemandeApproPriority;
  commentaire?: string;
  lignes: {
    productMpId: number;
    quantiteDemandee: number;
    commentaire?: string;
  }[];
}

export interface UpdateDemandeDto {
  priority?: DemandeApproPriority;
  commentaire?: string;
  lignes?: {
    productMpId: number;
    quantiteDemandee: number;
    commentaire?: string;
  }[];
}

export interface ValidateDemandeDto {
  lignesAjustees?: {
    productMpId: number;
    quantiteValidee: number;
  }[];
}

export interface RejectDemandeDto {
  motif: string;
}

@Injectable()
export class DemandesMpService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // GÉNÉRATION RÉFÉRENCE
  // ═══════════════════════════════════════════════════════════════════════════

  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REQ-MP-${year}-`;
    
    const lastDemande = await this.prisma.demandeApprovisionnementMp.findFirst({
      where: { reference: { startsWith: prefix } },
      orderBy: { reference: 'desc' },
    });

    let nextNumber = 1;
    if (lastDemande) {
      const lastNumber = parseInt(lastDemande.reference.split('-').pop() || '0');
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD DEMANDES (PRODUCTION)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Créer une nouvelle demande (PRODUCTION uniquement)
   */
  async create(dto: CreateDemandeDto, userId: string, userRole: UserRole) {
    if (userRole !== 'PRODUCTION' && userRole !== 'ADMIN') {
      throw new ForbiddenException('Seul le rôle PRODUCTION peut créer des demandes MP');
    }

    if (!dto.lignes || dto.lignes.length === 0) {
      throw new BadRequestException('La demande doit contenir au moins une ligne');
    }

    const reference = await this.generateReference();

    return this.prisma.demandeApprovisionnementMp.create({
      data: {
        reference,
        status: 'BROUILLON',
        priority: dto.priority || 'NORMALE',
        commentaire: dto.commentaire,
        createdById: userId,
        lignes: {
          create: dto.lignes.map(l => ({
            productMpId: l.productMpId,
            quantiteDemandee: l.quantiteDemandee,
            commentaire: l.commentaire,
          })),
        },
      },
      include: {
        lignes: { include: { productMp: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Liste des demandes (filtré par rôle)
   */
  async findAll(userId: string, userRole: UserRole, filters?: {
    status?: DemandeApproStatus;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    // PRODUCTION ne voit que ses propres demandes
    if (userRole === 'PRODUCTION') {
      where.createdById = userId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const [demandes, total] = await Promise.all([
      this.prisma.demandeApprovisionnementMp.findMany({
        where,
        include: {
          lignes: { include: { productMp: { select: { code: true, name: true, unit: true } } } },
          createdBy: { select: { firstName: true, lastName: true } },
          // Validation data: visible uniquement ADMIN/APPRO
          ...(userRole !== 'PRODUCTION' && {
            validatedBy: { select: { firstName: true, lastName: true } },
          }),
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.demandeApprovisionnementMp.count({ where }),
    ]);

    // MICRO-1: Masquer données validation pour PRODUCTION
    const sanitizedDemandes = userRole === 'PRODUCTION'
      ? demandes.map(d => ({
          ...d,
          validatedById: undefined,
          validatedAt: undefined,
          validatedBy: undefined,
        }))
      : demandes;

    return { demandes: sanitizedDemandes, total };
  }

  /**
   * Détail d'une demande
   */
  async findOne(id: number, userId: string, userRole: UserRole) {
    const demande = await this.prisma.demandeApprovisionnementMp.findUnique({
      where: { id },
      include: {
        lignes: { include: { productMp: true } },
        createdBy: { select: { firstName: true, lastName: true, role: true } },
        validatedBy: { select: { firstName: true, lastName: true } },
        reception: { select: { id: true, reference: true, date: true } },
      },
    });

    if (!demande) {
      throw new NotFoundException('Demande non trouvée');
    }

    // PRODUCTION ne peut voir que ses propres demandes
    if (userRole === 'PRODUCTION' && demande.createdById !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette demande');
    }

    // MICRO-1: Masquer données validation pour PRODUCTION
    if (userRole === 'PRODUCTION') {
      return {
        ...demande,
        validatedById: undefined,
        validatedAt: undefined,
        validatedBy: undefined,
      };
    }

    return demande;
  }

  /**
   * Modifier une demande (BROUILLON uniquement)
   */
  async update(id: number, dto: UpdateDemandeDto, userId: string, userRole: UserRole) {
    const demande = await this.findOne(id, userId, userRole);

    // MICRO-2: Verrouillage strict après ENVOI
    if (demande.status !== 'BROUILLON') {
      throw new BadRequestException(
        `Modification interdite : la demande ${demande.reference} est en statut ${demande.status}. ` +
        'Seules les demandes en BROUILLON peuvent être modifiées.'
      );
    }

    if (userRole === 'PRODUCTION' && demande.createdById !== userId) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres demandes');
    }

    // Supprimer les anciennes lignes si nouvelles lignes fournies
    if (dto.lignes) {
      await this.prisma.demandeApproLigne.deleteMany({ where: { demandeId: id } });
    }

    return this.prisma.demandeApprovisionnementMp.update({
      where: { id },
      data: {
        priority: dto.priority,
        commentaire: dto.commentaire,
        ...(dto.lignes && {
          lignes: {
            create: dto.lignes.map(l => ({
              productMpId: l.productMpId,
              quantiteDemandee: l.quantiteDemandee,
              commentaire: l.commentaire,
            })),
          },
        }),
      },
      include: {
        lignes: { include: { productMp: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Soumettre une demande (BROUILLON → SOUMISE)
   */
  async envoyer(id: number, userId: string, userRole: UserRole) {
    const demande = await this.findOne(id, userId, userRole);

    if (demande.status !== 'BROUILLON') {
      throw new BadRequestException('Seules les demandes en BROUILLON peuvent être envoyées');
    }

    if (userRole === 'PRODUCTION' && demande.createdById !== userId) {
      throw new ForbiddenException('Vous ne pouvez envoyer que vos propres demandes');
    }

    return this.prisma.demandeApprovisionnementMp.update({
      where: { id },
      data: {
        status: 'SOUMISE' as DemandeApproStatus,
        envoyeeAt: new Date(),
      },
      include: {
        lignes: { include: { productMp: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Supprimer une demande (BROUILLON uniquement)
   */
  async delete(id: number, userId: string, userRole: UserRole) {
    const demande = await this.findOne(id, userId, userRole);

    // MICRO-2: Verrouillage strict après ENVOI - Suppression interdite
    if (demande.status !== 'BROUILLON') {
      throw new BadRequestException(
        `Suppression interdite : la demande ${demande.reference} est en statut ${demande.status}. ` +
        'Une demande envoyée ou traitée ne peut plus être supprimée pour des raisons de traçabilité.'
      );
    }

    if (userRole === 'PRODUCTION' && demande.createdById !== userId) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres demandes');
    }

    await this.prisma.demandeApprovisionnementMp.delete({ where: { id } });
    return { success: true, message: 'Demande supprimée' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION (ADMIN / APPRO)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Valider une demande (ADMIN/APPRO uniquement)
   */
  async valider(id: number, dto: ValidateDemandeDto, userId: string, userRole: UserRole) {
    if (userRole !== 'ADMIN' && userRole !== 'APPRO') {
      throw new ForbiddenException('Seuls ADMIN et APPRO peuvent valider les demandes');
    }

    const demande = await this.prisma.demandeApprovisionnementMp.findUnique({
      where: { id },
      include: { lignes: true },
    });

    if (!demande) {
      throw new NotFoundException('Demande non trouvée');
    }

    if (demande.status !== 'SOUMISE' && demande.status !== 'ENVOYEE') {
      throw new BadRequestException('Seules les demandes SOUMISES peuvent être validées');
    }

    // Mettre à jour les quantités validées si fournies
    if (dto.lignesAjustees) {
      for (const ajustement of dto.lignesAjustees) {
        await this.prisma.demandeApproLigne.updateMany({
          where: { demandeId: id, productMpId: ajustement.productMpId },
          data: { quantiteValidee: ajustement.quantiteValidee },
        });
      }
    } else {
      // Par défaut, quantité validée = quantité demandée
      for (const ligne of demande.lignes) {
        await this.prisma.demandeApproLigne.update({
          where: { id: ligne.id },
          data: { quantiteValidee: ligne.quantiteDemandee },
        });
      }
    }

    return this.prisma.demandeApprovisionnementMp.update({
      where: { id },
      data: {
        status: 'VALIDEE',
        validatedById: userId,
        validatedAt: new Date(),
      },
      include: {
        lignes: { include: { productMp: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        validatedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Rejeter une demande (ADMIN/APPRO uniquement)
   */
  async rejeter(id: number, dto: RejectDemandeDto, userId: string, userRole: UserRole) {
    if (userRole !== 'ADMIN' && userRole !== 'APPRO') {
      throw new ForbiddenException('Seuls ADMIN et APPRO peuvent rejeter les demandes');
    }

    const demande = await this.prisma.demandeApprovisionnementMp.findUnique({
      where: { id },
    });

    if (!demande) {
      throw new NotFoundException('Demande non trouvée');
    }

    if (demande.status !== 'SOUMISE' && demande.status !== 'ENVOYEE') {
      throw new BadRequestException('Seules les demandes SOUMISES peuvent être rejetées');
    }

    if (!dto.motif || dto.motif.trim() === '') {
      throw new BadRequestException('Le motif de rejet est obligatoire');
    }

    return this.prisma.demandeApprovisionnementMp.update({
      where: { id },
      data: {
        status: 'REJETEE',
        validatedById: userId,
        validatedAt: new Date(),
        rejectReason: dto.motif,
      },
      include: {
        lignes: { include: { productMp: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        validatedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTIQUES (pour Dashboard Production)
  // ═══════════════════════════════════════════════════════════════════════════

  async getStats(userId: string, userRole: UserRole) {
    const where: any = {};
    if (userRole === 'PRODUCTION') {
      where.createdById = userId;
    }

    const [brouillons, soumises, validees, rejetees] = await Promise.all([
      this.prisma.demandeApprovisionnementMp.count({ where: { ...where, status: 'BROUILLON' } }),
      this.prisma.demandeApprovisionnementMp.count({ where: { ...where, status: { in: ['SOUMISE', 'ENVOYEE'] } } }),
      this.prisma.demandeApprovisionnementMp.count({ where: { ...where, status: 'VALIDEE' } }),
      this.prisma.demandeApprovisionnementMp.count({ where: { ...where, status: 'REJETEE' } }),
    ]);

    return {
      brouillons,
      soumises,
      validees,
      rejetees,
      total: brouillons + soumises + validees + rejetees,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFORMATION EN RÉCEPTION (ADMIN / APPRO uniquement)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Transformer une demande VALIDÉE en Réception MP
   * - Transaction Prisma pour garantir l'intégrité
   * - Une demande ne peut être transformée qu'UNE SEULE FOIS
   * - Aucun impact stock tant que réception non confirmée
   */
  async transformer(id: number, userId: string, userRole: UserRole) {
    // RBAC: Seuls ADMIN et APPRO peuvent transformer
    if (userRole !== 'ADMIN' && userRole !== 'APPRO') {
      throw new ForbiddenException(
        'Seuls les rôles ADMIN et APPRO peuvent transformer une demande en réception.'
      );
    }

    // Récupérer la demande avec ses lignes
    const demande = await this.prisma.demandeApprovisionnementMp.findUnique({
      where: { id },
      include: {
        lignes: { include: { productMp: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!demande) {
      throw new NotFoundException(`Demande #${id} non trouvée.`);
    }

    // Vérification: statut VALIDÉE requis
    if (demande.status !== 'VALIDEE') {
      throw new BadRequestException(
        `Transformation impossible : la demande ${demande.reference} est en statut ${demande.status}. ` +
        'Seules les demandes VALIDÉES peuvent être transformées en réception.'
      );
    }

    // Vérification: pas déjà transformée
    if (demande.receptionId) {
      throw new BadRequestException(
        `Transformation impossible : la demande ${demande.reference} a déjà été transformée ` +
        `en réception (ID: ${demande.receptionId}). Une demande ne peut être transformée qu'une seule fois.`
      );
    }

    // Générer référence réception unique
    const receptionRef = await this.generateReceptionReference();

    // Transaction: créer réception + mettre à jour demande
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Créer la réception MP
      const reception = await tx.receptionMp.create({
        data: {
          reference: receptionRef,
          date: new Date(),
          status: 'DRAFT', // EN_ATTENTE = DRAFT dans le modèle existant
          source: 'DEMANDE_MP',
          note: `Générée depuis demande ${demande.reference}`,
          userId: userId,
          // Lignes de réception (sans données financières)
          lines: {
            create: demande.lignes.map((ligne) => ({
              productMpId: ligne.productMpId,
              quantity: Math.round(ligne.quantiteValidee || ligne.quantiteDemandee),
              // Pas de données financières (unitCost, tva, etc.)
            })),
          },
        },
        include: {
          lines: { include: { productMp: true } },
        },
      });

      // 2. Mettre à jour la demande
      const demandeUpdated = await tx.demandeApprovisionnementMp.update({
        where: { id },
        data: {
          status: 'EN_COURS_COMMANDE' as DemandeApproStatus,
          receptionId: reception.id,
        },
        include: {
          lignes: { include: { productMp: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          validatedBy: { select: { firstName: true, lastName: true } },
        },
      });

      return { demande: demandeUpdated, reception };
    });

    return {
      success: true,
      message: `Demande ${demande.reference} transformée en réception ${receptionRef}`,
      demande: result.demande,
      reception: result.reception,
    };
  }

  /**
   * Générer une référence unique pour la réception
   * Format: REC-YYMMDD-XXX
   */
  private async generateReceptionReference(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `REC-${dateStr}`;

    // Trouver le dernier numéro du jour
    const lastReception = await this.prisma.receptionMp.findFirst({
      where: { reference: { startsWith: prefix } },
      orderBy: { reference: 'desc' },
    });

    let sequence = 1;
    if (lastReception) {
      const lastSeq = parseInt(lastReception.reference.split('-')[2], 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}-${sequence.toString().padStart(3, '0')}`;
  }
}
