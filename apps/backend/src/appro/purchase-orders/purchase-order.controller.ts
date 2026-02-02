/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PURCHASE ORDER CONTROLLER — Endpoints BC (Bons de Commande)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ENDPOINTS AUTORISÉS (et seulement ceux-là):
 * - POST /appro/demands/:id/generate-bc    → Générer BC depuis Demande validée
 * - GET  /appro/purchase-orders/:id        → Détail d'un BC
 * - POST /appro/purchase-orders/:id/send   → Envoyer au fournisseur
 * - POST /appro/purchase-orders/:id/confirm → Confirmer réception fournisseur
 * - POST /appro/purchase-orders/:id/receive → Réceptionner les MP
 * 
 * ❌ INTERDICTION ABSOLUE:
 * - /purchase-orders/create
 * - /purchase-orders/update
 * - /purchase-orders/delete
 * 
 * RBAC:
 * - ADMIN / APPRO: Toutes les actions
 * - PRODUCTION: Lecture seule
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PurchaseOrderService } from './purchase-order.service';
import {
  GenerateBcDto,
  GenerateBcResponseDto,
  SendBcDto,
  SendBcResponseDto,
  ReceiveBcDto,
  ReceiveBcResponseDto,
  CancelBcDto,
  CancelBcResponseDto,
} from './dto';
import { PurchaseOrderStatus } from '@prisma/client';

@ApiTags('APPRO - Bons de Commande')
@ApiBearerAuth()
@Controller('appro')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * GÉNÉRATION DE BC DEPUIS UNE DEMANDE VALIDÉE
   * ═══════════════════════════════════════════════════════════════════════════════
   * POST /appro/demands/:id/generate-bc
   * 
   * RÈGLE MÉTIER: Le BC est TOUJOURS généré depuis une Demande APPRO validée
   * Split automatique si multi-fournisseurs
   */
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * V1: CRÉATION BC DIRECTE (sans Demande)
   * ═══════════════════════════════════════════════════════════════════════════════
   * POST /appro/purchase-orders/create-direct
   * 
   * RÈGLE V1: L'APPRO peut créer un BC librement pour répondre aux urgences
   */
  @Post('purchase-orders/create-direct')
  @Roles('ADMIN', 'APPRO')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer BC direct V1',
    description: 'Création libre de BC par APPRO sans Demande MP préalable. Audit complet.',
  })
  async createDirect(
    @Body() dto: {
      supplierId: number;
      lines: Array<{ productMpId: number; quantity: number; unitPrice?: number }>;
      expectedDelivery?: string;
      notes?: string;
    },
    @Request() req: any,
  ) {
    return this.poService.createDirect(dto, req.user.id);
  }

  @Post('demands/:id/generate-bc')
  @Roles('ADMIN', 'APPRO')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Générer BC depuis une Demande validée',
    description: `
      Génère un ou plusieurs Bons de Commande à partir d'une Demande APPRO validée.
      
      **RÈGLES MÉTIER:**
      - La Demande DOIT être au statut VALIDÉE
      - Split automatique par fournisseur si multi-fournisseurs
      - Les quantités sont pré-remplies depuis la Demande
      - Les prix sont récupérés du dernier achat ou fournis manuellement
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la Demande APPRO' })
  @ApiResponse({
    status: 201,
    description: 'BC généré(s) avec succès',
    type: GenerateBcResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Demande non validée ou BC déjà générés',
  })
  @ApiResponse({ status: 404, description: 'Demande non trouvée' })
  async generateFromDemand(
    @Param('id', ParseIntPipe) demandId: number,
    @Body() dto: GenerateBcDto,
    @Request() req: any,
  ): Promise<GenerateBcResponseDto> {
    return this.poService.generateFromDemand(demandId, dto, req.user.id);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * DÉTAIL D'UN BC
   * ═══════════════════════════════════════════════════════════════════════════════
   * GET /appro/purchase-orders/:id
   */
  @Get('purchase-orders/:id')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({
    summary: 'Détail d\'un Bon de Commande',
    description: 'Récupère les détails complets d\'un BC avec ses lignes et historique',
  })
  @ApiParam({ name: 'id', description: 'ID du BC (UUID)' })
  @ApiResponse({ status: 200, description: 'Détail du BC' })
  @ApiResponse({ status: 404, description: 'BC non trouvé' })
  async getById(@Param('id') id: string) {
    return this.poService.getById(id);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * TÉLÉCHARGEMENT PDF D'UN BC
   * ═══════════════════════════════════════════════════════════════════════════════
   * GET /appro/purchase-orders/:id/pdf
   */
  @Get('purchase-orders/:id/pdf')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({
    summary: 'Télécharger le PDF d\'un Bon de Commande',
    description: 'Génère et télécharge le PDF d\'un BC',
  })
  @ApiParam({ name: 'id', description: 'ID du BC (UUID)' })
  @ApiResponse({ status: 200, description: 'PDF du BC' })
  @ApiResponse({ status: 404, description: 'BC non trouvé' })
  async downloadPdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdfBuffer = await this.poService.generatePdf(id);
    const po = await this.poService.getById(id);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="BC-${po.reference}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return new StreamableFile(pdfBuffer);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * LISTE DES BC
   * ═══════════════════════════════════════════════════════════════════════════════
   * GET /appro/purchase-orders
   */
  @Get('purchase-orders')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({
    summary: 'Liste des Bons de Commande',
    description: 'Liste tous les BC avec filtres optionnels',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PurchaseOrderStatus,
    description: 'Filtrer par statut',
  })
  @ApiQuery({
    name: 'supplierId',
    required: false,
    type: Number,
    description: 'Filtrer par fournisseur',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre max de résultats (défaut: 100)',
  })
  @ApiResponse({ status: 200, description: 'Liste des BC' })
  async findAll(
    @Query('status') status?: PurchaseOrderStatus,
    @Query('supplierId') supplierId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.poService.findAll({
      status,
      supplierId: supplierId ? parseInt(supplierId, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * P1.1: BC EN RETARD — CALCUL BACKEND
   * ═══════════════════════════════════════════════════════════════════════════════
   * GET /appro/purchase-orders/late
   */
  @Get('purchase-orders/late')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({
    summary: 'Liste des BC en retard',
    description: `
      Retourne les BC en retard avec champs calculés côté backend.
      
      **Champs calculés:**
      - isLate: toujours true
      - daysLate: nombre de jours de retard
      - isCritical: true si retard > seuil (défaut 3 jours)
      - hasCriticalMp: true si MP critique impactée
      - impactLevel: BLOQUANT | MAJEUR | MINEUR
    `,
  })
  @ApiQuery({
    name: 'criticalThreshold',
    required: false,
    type: Number,
    description: 'Seuil en jours pour considérer un retard comme critique (défaut: 3)',
  })
  @ApiResponse({ status: 200, description: 'Liste des BC en retard' })
  async getLatePurchaseOrders(
    @Query('criticalThreshold') criticalThreshold?: string,
  ) {
    return this.poService.getLatePurchaseOrders(
      criticalThreshold ? parseInt(criticalThreshold, 10) : undefined,
    );
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * P1.1: STATISTIQUES RETARDS BC
   * ═══════════════════════════════════════════════════════════════════════════════
   * GET /appro/purchase-orders/delay-stats
   */
  @Get('purchase-orders/delay-stats')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({
    summary: 'Statistiques des retards BC',
    description: 'Retourne les statistiques agrégées sur les retards de BC',
  })
  @ApiResponse({ status: 200, description: 'Statistiques des retards' })
  async getDelayStats() {
    return this.poService.getDelayStats();
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * BC D'UNE DEMANDE
   * ═══════════════════════════════════════════════════════════════════════════════
   * GET /appro/demands/:id/purchase-orders
   */
  @Get('demands/:id/purchase-orders')
  @Roles('ADMIN', 'APPRO', 'PRODUCTION')
  @ApiOperation({
    summary: 'BC générés pour une Demande',
    description: 'Liste les BC générés à partir d\'une Demande spécifique',
  })
  @ApiParam({ name: 'id', description: 'ID de la Demande APPRO' })
  @ApiResponse({ status: 200, description: 'Liste des BC de la Demande' })
  async getByDemandId(@Param('id', ParseIntPipe) demandId: number) {
    return this.poService.getByDemandId(demandId);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ENVOI D'UN BC AU FOURNISSEUR
   * ═══════════════════════════════════════════════════════════════════════════════
   * POST /appro/purchase-orders/:id/send
   * TRANSITION: DRAFT → SENT
   */
  @Post('purchase-orders/:id/send')
  @Roles('ADMIN', 'APPRO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envoyer un BC au fournisseur',
    description: `
      Marque le BC comme envoyé au fournisseur.
      
      **TRANSITION:** DRAFT → SENT
      
      Options:
      - Envoi email automatique (si email fournisseur fourni)
      - Ou marquage manuel (markAsSentOnly = true)
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du BC (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'BC envoyé',
    type: SendBcResponseDto,
  })
  @ApiResponse({ status: 400, description: 'BC pas en statut DRAFT' })
  @ApiResponse({ status: 404, description: 'BC non trouvé' })
  async send(
    @Param('id') id: string,
    @Body() dto: SendBcDto,
    @Request() req: any,
  ): Promise<SendBcResponseDto> {
    return this.poService.sendPurchaseOrder(id, dto, req.user.id);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * CONFIRMATION PAR LE FOURNISSEUR
   * ═══════════════════════════════════════════════════════════════════════════════
   * POST /appro/purchase-orders/:id/confirm
   * TRANSITION: SENT → CONFIRMED
   */
  @Post('purchase-orders/:id/confirm')
  @Roles('ADMIN', 'APPRO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmer un BC',
    description: `
      Marque le BC comme confirmé par le fournisseur.
      
      **TRANSITION:** SENT → CONFIRMED
      
      Utilisé quand le fournisseur a accusé réception et confirmé les quantités/délais.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du BC (UUID)' })
  @ApiResponse({ status: 200, description: 'BC confirmé' })
  @ApiResponse({ status: 400, description: 'BC pas en statut SENT' })
  @ApiResponse({ status: 404, description: 'BC non trouvé' })
  async confirm(@Param('id') id: string, @Request() req: any) {
    return this.poService.confirmPurchaseOrder(id, req.user.id);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * RÉCEPTION D'UN BC
   * ═══════════════════════════════════════════════════════════════════════════════
   * POST /appro/purchase-orders/:id/receive
   * TRANSITION: SENT/CONFIRMED/PARTIAL → PARTIAL/RECEIVED
   * 
   * ACTIONS:
   * - Crée une ReceptionMp
   * - Crée les StockMovements (IN)
   * - Met à jour le stock des MP
   * - Clôture la Demande source si tous les BC sont reçus
   */
  @Post('purchase-orders/:id/receive')
  @Roles('ADMIN', 'APPRO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réceptionner un BC',
    description: `
      Enregistre la réception des MP commandées via le BC.
      
      **TRANSITIONS:** 
      - SENT/CONFIRMED → PARTIAL (si réception partielle)
      - SENT/CONFIRMED/PARTIAL → RECEIVED (si tout reçu)
      
      **ACTIONS AUTOMATIQUES:**
      1. Création d'une ReceptionMp
      2. Création des lots MP
      3. Création des StockMovements (IN)
      4. Clôture de la Demande source si tous les BC sont reçus
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du BC (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'BC réceptionné',
    type: ReceiveBcResponseDto,
  })
  @ApiResponse({ status: 400, description: 'BC pas en statut autorisé' })
  @ApiResponse({ status: 404, description: 'BC non trouvé' })
  async receive(
    @Param('id') id: string,
    @Body() dto: ReceiveBcDto,
    @Request() req: any,
  ): Promise<ReceiveBcResponseDto> {
    return this.poService.receivePurchaseOrder(id, dto, req.user.id);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ANNULATION D'UN BC — P0.2 ANNULATION SÉCURISÉE
   * ═══════════════════════════════════════════════════════════════════════════════
   * POST /appro/purchase-orders/:id/cancel
   * TRANSITION: DRAFT/SENT/CONFIRMED → CANCELLED
   * 
   * RÈGLES:
   * - Rôle ADMIN uniquement
   * - Motif obligatoire (min 10 caractères)
   * - Interdit si réception partielle effectuée
   */
  @Post('purchase-orders/:id/cancel')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Annuler un BC',
    description: `
      Annule un BC erroné ou obsolète.
      
      **TRANSITION:** DRAFT/SENT/CONFIRMED → CANCELLED
      
      **RÈGLES STRICTES:**
      - Rôle ADMIN uniquement
      - Motif obligatoire (min 10 caractères)
      - Interdit si réception partielle déjà effectuée
      - Audit log créé automatiquement
      
      **IRRÉVERSIBLE:** Une fois annulé, le BC ne peut plus être modifié.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du BC (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'BC annulé',
    type: CancelBcResponseDto,
  })
  @ApiResponse({ status: 400, description: 'BC pas en statut autorisé ou réception partielle effectuée' })
  @ApiResponse({ status: 403, description: 'Rôle ADMIN requis' })
  @ApiResponse({ status: 404, description: 'BC non trouvé' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelBcDto,
    @Request() req: any,
  ): Promise<CancelBcResponseDto> {
    return this.poService.cancelPurchaseOrder(id, dto, req.user.id, req.user.role);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * P1.3: ACQUÉRIR UN LOCK SUR UN BC
   * ═══════════════════════════════════════════════════════════════════════════════
   * POST /appro/purchase-orders/:id/lock
   */
  @Post('purchase-orders/:id/lock')
  @Roles('ADMIN', 'APPRO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acquérir un lock sur un BC',
    description: 'Empêche les modifications concurrentes pendant une opération',
  })
  @ApiParam({ name: 'id', description: 'ID du BC (UUID)' })
  @ApiResponse({ status: 200, description: 'Résultat de l\'acquisition du lock' })
  async acquireLock(@Param('id') id: string, @Request() req: any) {
    return this.poService.acquireLock(id, req.user.id);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * P1.3: LIBÉRER UN LOCK SUR UN BC
   * ═══════════════════════════════════════════════════════════════════════════════
   * POST /appro/purchase-orders/:id/unlock
   */
  @Post('purchase-orders/:id/unlock')
  @Roles('ADMIN', 'APPRO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Libérer un lock sur un BC',
    description: 'Libère le lock pour permettre d\'autres modifications',
  })
  @ApiParam({ name: 'id', description: 'ID du BC (UUID)' })
  @ApiResponse({ status: 200, description: 'Lock libéré' })
  async releaseLock(@Param('id') id: string, @Request() req: any) {
    return { released: await this.poService.releaseLock(id, req.user.id) };
  }
}
