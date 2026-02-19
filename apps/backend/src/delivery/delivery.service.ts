import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityLogService } from '../security/security-log.service';
import { createHash } from 'crypto';
import {
  ValidateDeliveryDto,
  CancelDeliveryDto,
  CreateDeliveryDto,
  DeliveryValidationError,
  DeliveryValidationResponse,
  DeliveryQueryDto,
} from './dto/delivery.dto';
import { DeliveryStatus } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY SERVICE - QR Validation & Proof of Delivery
// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY CRITICAL:
// - QR checksum validation (SHA256)
// - Anti-double validation (status check + transaction)
// - Complete audit trail
// - Device/User validation
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  // Secret key for QR checksum - should match Rust implementation
  private readonly QR_SECRET_KEY = (() => {
    const key = process.env.QR_SECRET_KEY;
    if (!key || key === 'CHANGE_ME_IN_PRODUCTION_USE_openssl_rand_base64_32') {
      throw new Error(
        'QR_SECRET_KEY environment variable is required. Generate one with: openssl rand -base64 32',
      );
    }
    return key;
  })();

  constructor(
    private prisma: PrismaService,
    private securityLog: SecurityLogService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATE DELIVERY VIA QR CODE (CRITICAL ENDPOINT)
  // ═══════════════════════════════════════════════════════════════════════════

  async validateDelivery(
    dto: ValidateDeliveryDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DeliveryValidationResponse> {
    const startTime = Date.now();

    // 1. Parse and validate QR code format
    const qrData = this.parseQrCode(dto.qrCode);
    if (!qrData) {
      await this.logValidationAttempt({
        qrScanned: dto.qrCode,
        userId,
        deviceId: dto.deviceId,
        ipAddress,
        userAgent,
        success: false,
        errorCode: DeliveryValidationError.INVALID_QR_FORMAT,
        errorMessage: 'Invalid QR code format',
      });

      return {
        success: false,
        message: 'Format QR code invalide',
        error: DeliveryValidationError.INVALID_QR_FORMAT,
      };
    }

    // 2. Verify it's a DELIVERY type QR
    if (qrData.entityType !== 'DLV') {
      await this.logValidationAttempt({
        qrScanned: dto.qrCode,
        userId,
        deviceId: dto.deviceId,
        ipAddress,
        userAgent,
        success: false,
        errorCode: DeliveryValidationError.INVALID_ENTITY_TYPE,
        errorMessage: `Expected DLV, got ${qrData.entityType}`,
      });

      return {
        success: false,
        message: 'Ce QR code n\'est pas un bon de livraison',
        error: DeliveryValidationError.INVALID_ENTITY_TYPE,
      };
    }

    // 3. Verify checksum (SHA256)
    const expectedChecksum = this.computeChecksum(
      qrData.entityId,
      qrData.reference,
    );

    if (!this.constantTimeCompare(qrData.checksum, expectedChecksum)) {
      this.logger.warn(
        `QR checksum mismatch for delivery ${qrData.entityId}`,
      );

      await this.logValidationAttempt({
        qrScanned: dto.qrCode,
        userId,
        deviceId: dto.deviceId,
        ipAddress,
        userAgent,
        success: false,
        errorCode: DeliveryValidationError.INVALID_QR_CHECKSUM,
        errorMessage: 'Checksum verification failed',
      });

      return {
        success: false,
        message: 'QR code invalide ou falsifié',
        error: DeliveryValidationError.INVALID_QR_CHECKSUM,
      };
    }

    // 4. Validate user is active
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, role: true },
    });

    if (!user || !user.isActive) {
      await this.logValidationAttempt({
        qrScanned: dto.qrCode,
        userId,
        deviceId: dto.deviceId,
        ipAddress,
        userAgent,
        success: false,
        errorCode: DeliveryValidationError.USER_NOT_ACTIVE,
        errorMessage: 'User account is inactive',
      });

      return {
        success: false,
        message: 'Compte utilisateur inactif',
        error: DeliveryValidationError.USER_NOT_ACTIVE,
      };
    }

    // 5. Validate device if provided
    if (dto.deviceId) {
      const device = await this.prisma.device.findUnique({
        where: { id: dto.deviceId },
        select: { id: true, isActive: true },
      });

      if (!device || !device.isActive) {
        await this.logValidationAttempt({
          qrScanned: dto.qrCode,
          userId,
          deviceId: dto.deviceId,
          ipAddress,
          userAgent,
          success: false,
          errorCode: DeliveryValidationError.DEVICE_NOT_ACTIVE,
          errorMessage: 'Device is inactive or not registered',
        });

        return {
          success: false,
          message: 'Appareil non autorisé',
          error: DeliveryValidationError.DEVICE_NOT_ACTIVE,
        };
      }
    }

    // 6. CRITICAL: Atomic validation with transaction
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Load delivery with lock
          const delivery = await tx.delivery.findUnique({
            where: { id: qrData.entityId },
            include: {
              client: { select: { id: true, name: true } },
              invoice: { select: { id: true, reference: true } },
            },
          });

          if (!delivery) {
            throw new NotFoundException({
              code: DeliveryValidationError.DELIVERY_NOT_FOUND,
              message: 'Livraison non trouvée',
            });
          }

          // ANTI-DOUBLE VALIDATION: Check status
          if (delivery.status === DeliveryStatus.VALIDATED) {
            throw new ConflictException({
              code: DeliveryValidationError.DELIVERY_ALREADY_VALIDATED,
              message: `Livraison déjà validée le ${delivery.validatedAt?.toISOString()}`,
              validatedAt: delivery.validatedAt,
              validatedBy: delivery.validatedByUserId,
            });
          }

          if (delivery.status === DeliveryStatus.CANCELLED) {
            throw new BadRequestException({
              code: DeliveryValidationError.DELIVERY_CANCELLED,
              message: 'Cette livraison a été annulée',
            });
          }

          // Update delivery status atomically
          const updatedDelivery = await tx.delivery.update({
            where: { id: delivery.id },
            data: {
              status: DeliveryStatus.VALIDATED,
              validatedAt: new Date(),
              validatedByUserId: userId,
              validatedByDeviceId: dto.deviceId || null,
              recipientName: dto.recipientName || null,
              recipientSignature: dto.recipientSignature || null,
              proofPhoto: dto.proofPhoto || null,
            },
            include: {
              client: { select: { id: true, name: true } },
              invoice: { select: { id: true, reference: true } },
            },
          });

          // Log successful validation
          await tx.deliveryValidationLog.create({
            data: {
              deliveryId: delivery.id,
              action: 'VALIDATED',
              qrScanned: dto.qrCode,
              userId,
              deviceId: dto.deviceId || null,
              ipAddress: ipAddress || null,
              userAgent: userAgent || null,
              success: true,
              metadata: {
                gpsCoordinates: dto.gpsCoordinates,
                processingTimeMs: Date.now() - startTime,
              },
            },
          });

          return updatedDelivery;
        },
        {
          isolationLevel: 'Serializable', // Highest isolation to prevent race conditions
          timeout: 10000, // 10 second timeout
        },
      );

      this.logger.log(
        `Delivery ${result.reference} validated by user ${userId} in ${Date.now() - startTime}ms`,
      );

      // TODO: Add cache invalidation when caching is re-enabled

      return {
        success: true,
        message: 'Livraison validée avec succès',
        delivery: {
          id: result.id,
          reference: result.reference,
          status: result.status,
          validatedAt: result.validatedAt!,
          client: result.client,
          invoice: result.invoice,
        },
      };
    } catch (error) {
      // Handle specific errors
      if (error instanceof NotFoundException) {
        await this.logValidationAttempt({
          deliveryId: qrData.entityId,
          qrScanned: dto.qrCode,
          userId,
          deviceId: dto.deviceId,
          ipAddress,
          userAgent,
          success: false,
          errorCode: DeliveryValidationError.DELIVERY_NOT_FOUND,
          errorMessage: 'Delivery not found',
        });

        return {
          success: false,
          message: 'Livraison non trouvée',
          error: DeliveryValidationError.DELIVERY_NOT_FOUND,
        };
      }

      if (error instanceof ConflictException) {
        const errorData = error.getResponse() as any;
        
        await this.logValidationAttempt({
          deliveryId: qrData.entityId,
          qrScanned: dto.qrCode,
          userId,
          deviceId: dto.deviceId,
          ipAddress,
          userAgent,
          success: false,
          errorCode: DeliveryValidationError.DELIVERY_ALREADY_VALIDATED,
          errorMessage: errorData.message,
          metadata: {
            previousValidatedAt: errorData.validatedAt,
            previousValidatedBy: errorData.validatedBy,
          },
        });

        return {
          success: false,
          message: errorData.message,
          error: DeliveryValidationError.DELIVERY_ALREADY_VALIDATED,
        };
      }

      if (error instanceof BadRequestException) {
        await this.logValidationAttempt({
          deliveryId: qrData.entityId,
          qrScanned: dto.qrCode,
          userId,
          deviceId: dto.deviceId,
          ipAddress,
          userAgent,
          success: false,
          errorCode: DeliveryValidationError.DELIVERY_CANCELLED,
          errorMessage: 'Delivery is cancelled',
        });

        return {
          success: false,
          message: 'Cette livraison a été annulée',
          error: DeliveryValidationError.DELIVERY_CANCELLED,
        };
      }

      // Log unexpected error
      this.logger.error(`Delivery validation error: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET DELIVERY BY ID
  // ═══════════════════════════════════════════════════════════════════════════

  async getDeliveryById(id: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        client: true,
        invoice: {
          include: {
            lines: {
              include: { productPf: true },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException('Livraison non trouvée');
    }

    return delivery;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET PENDING DELIVERIES
  // ═══════════════════════════════════════════════════════════════════════════

  async getPendingDeliveries(query: DeliveryQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      status: DeliveryStatus.PENDING,
    };

    if (query.clientId) {
      where.clientId = query.clientId;
    }

    if (query.dateFrom || query.dateTo) {
      where.scheduledDate = {};
      if (query.dateFrom) {
        where.scheduledDate.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.scheduledDate.lte = new Date(query.dateTo);
      }
    }

    const [deliveries, total] = await Promise.all([
      this.prisma.delivery.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, address: true } },
          invoice: { select: { id: true, reference: true, netToPay: true } },
        },
        orderBy: [
          { scheduledDate: 'asc' },
          { createdAt: 'asc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.delivery.count({ where }),
    ]);

    return {
      data: deliveries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST DELIVERIES WITH FILTERS
  // ═══════════════════════════════════════════════════════════════════════════

  async listDeliveries(query: DeliveryQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.clientId) {
      where.clientId = query.clientId;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    const [deliveries, total] = await Promise.all([
      this.prisma.delivery.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          invoice: { select: { id: true, reference: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.delivery.count({ where }),
    ]);

    return {
      data: deliveries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE DELIVERY (from invoice)
  // ═══════════════════════════════════════════════════════════════════════════

  async createDelivery(dto: CreateDeliveryDto, userId: string) {
    // Verify invoice exists
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: { client: true },
    });

    if (!invoice) {
      throw new NotFoundException('Facture non trouvée');
    }

    // Generate unique reference: LIV-YYMMDD-XXX
    const reference = await this.generateReference();

    // Generate delivery ID (UUID)
    const deliveryId = crypto.randomUUID();

    // Compute QR checksum
    const checksum = this.computeChecksum(deliveryId, reference);

    // Build QR code string
    const qrCode = `MCG:DLV:${deliveryId}:${reference}:${checksum}`;

    // Create delivery
    const delivery = await this.prisma.delivery.create({
      data: {
        id: deliveryId,
        reference,
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        qrCode,
        qrChecksum: checksum,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
        deliveryAddress: dto.deliveryAddress || invoice.client.address,
        deliveryNotes: dto.deliveryNotes,
        createdByUserId: userId,
      },
      include: {
        client: { select: { id: true, name: true } },
        invoice: { select: { id: true, reference: true } },
      },
    });

    this.logger.log(`Delivery ${reference} created for invoice ${invoice.reference}`);

    return {
      ...delivery,
      qrCode, // Include QR code for label generation
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CANCEL DELIVERY
  // ═══════════════════════════════════════════════════════════════════════════

  async cancelDelivery(
    id: string,
    dto: CancelDeliveryDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
    });

    if (!delivery) {
      throw new NotFoundException('Livraison non trouvée');
    }

    if (delivery.status === DeliveryStatus.VALIDATED) {
      throw new BadRequestException(
        'Impossible d\'annuler une livraison déjà validée',
      );
    }

    if (delivery.status === DeliveryStatus.CANCELLED) {
      throw new BadRequestException('Cette livraison est déjà annulée');
    }

    const updatedDelivery = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: { id },
        data: {
          status: DeliveryStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledByUserId: userId,
          cancelReason: dto.reason,
        },
        include: {
          client: { select: { id: true, name: true } },
          invoice: { select: { id: true, reference: true } },
        },
      });

      // Log cancellation
      await tx.deliveryValidationLog.create({
        data: {
          deliveryId: id,
          action: 'CANCELLED',
          qrScanned: delivery.qrCode,
          userId,
          ipAddress,
          userAgent,
          success: true,
          metadata: { reason: dto.reason },
        },
      });

      return updated;
    });

    this.logger.log(`Delivery ${delivery.reference} cancelled by user ${userId}`);

    // TODO: Add cache invalidation when caching is re-enabled

    return updatedDelivery;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Parse QR code string into components
   * Format: MCG:{TYPE}:{ID}:{REFERENCE}:{CHECKSUM}
   */
  private parseQrCode(qrString: string): {
    entityType: string;
    entityId: string;
    reference: string;
    checksum: string;
  } | null {
    const parts = qrString.split(':');

    if (parts.length !== 5) {
      this.logger.warn(`QR parse failed: expected 5 parts, got ${parts.length}`);
      return null;
    }

    if (parts[0] !== 'MCG') {
      this.logger.warn(`QR parse failed: invalid prefix '${parts[0]}'`);
      return null;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(parts[2])) {
      this.logger.warn(`QR parse failed: invalid UUID '${parts[2]}'`);
      return null;
    }

    return {
      entityType: parts[1],
      entityId: parts[2],
      reference: parts[3],
      checksum: parts[4],
    };
  }

  /**
   * Compute SHA256 checksum matching Rust implementation
   * Input: {ENTITY_ID}:{REFERENCE}:{SECRET_KEY}
   * Output: First 16 chars of hex-encoded SHA256
   */
  private computeChecksum(entityId: string, reference: string): string {
    const input = `${entityId}:${reference}:${this.QR_SECRET_KEY}`;
    const hash = createHash('sha256').update(input).digest('hex');
    return hash.substring(0, 16); // First 16 chars (64 bits)
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Generate unique delivery reference: LIV-YYMMDD-XXX
   */
  private async generateReference(): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `LIV-${dateStr}`;

    // Get count of deliveries today
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const count = await this.prisma.delivery.count({
      where: {
        reference: { startsWith: prefix },
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const sequence = String(count + 1).padStart(3, '0');
    return `${prefix}-${sequence}`;
  }

  /**
   * Log validation attempt for audit trail
   */
  private async logValidationAttempt(data: {
    deliveryId?: string;
    qrScanned: string;
    userId: string;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
    metadata?: any;
  }) {
    try {
      await this.prisma.deliveryValidationLog.create({
        data: {
          deliveryId: data.deliveryId || 'UNKNOWN',
          action: data.success ? 'VALIDATED' : 'REJECTED',
          qrScanned: data.qrScanned,
          userId: data.userId,
          deviceId: data.deviceId || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          success: data.success,
          errorCode: data.errorCode || null,
          errorMessage: data.errorMessage || null,
          metadata: data.metadata || null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log validation attempt', error);
    }
  }
}
