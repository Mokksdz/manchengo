import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DeliveryService } from './delivery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ValidateDeliveryDto,
  CancelDeliveryDto,
  CreateDeliveryDto,
  DeliveryQueryDto,
} from './dto/delivery.dto';

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY CONTROLLER - QR Validation & Proof of Delivery
// ═══════════════════════════════════════════════════════════════════════════════
//
// ⚠️ NOTE: This module is WORK IN PROGRESS and NOT integrated in the frontend.
// These endpoints are designed for:
// - Mobile app delivery validation (future feature)
// - QR code scanning for proof of delivery
// - Delivery tracking and management
//
// SECURITY:
// - All endpoints require JWT authentication
// - QR validation is rate-limited to prevent brute force
// - Role-based access control (ADMIN, COMMERCIAL)
// - Complete audit trail for all operations
// ═══════════════════════════════════════════════════════════════════════════════

@ApiTags('Deliveries (WIP - Not in Frontend)')
@Controller('deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATE DELIVERY VIA QR CODE (CRITICAL ENDPOINT)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 scans per minute max
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({
    summary: 'Validate delivery via QR code scan',
    description: `
      CRITICAL ENDPOINT - Validates a delivery using the scanned QR code.
      
      Security features:
      - SHA256 checksum verification
      - Anti-double validation (atomic transaction)
      - Device/User validation
      - Complete audit trail
      
      QR Format: MCG:DLV:{UUID}:{REFERENCE}:{CHECKSUM}
    `,
  })
  @ApiResponse({ status: 200, description: 'Delivery validated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid QR code or delivery cancelled' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  @ApiResponse({ status: 409, description: 'Delivery already validated' })
  @ApiResponse({ status: 429, description: 'Too many validation attempts' })
  async validateDelivery(
    @Body() dto: ValidateDeliveryDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string; role: string };
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.deliveryService.validateDelivery(
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET PENDING DELIVERIES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('pending')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({
    summary: 'Get list of pending deliveries',
    description: 'Returns deliveries that are waiting to be validated',
  })
  @ApiResponse({ status: 200, description: 'List of pending deliveries' })
  async getPendingDeliveries(@Query() query: DeliveryQueryDto) {
    return this.deliveryService.getPendingDeliveries(query);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST ALL DELIVERIES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get()
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({
    summary: 'List deliveries with filters',
    description: 'Returns paginated list of deliveries with optional filters',
  })
  @ApiResponse({ status: 200, description: 'List of deliveries' })
  async listDeliveries(@Query() query: DeliveryQueryDto) {
    return this.deliveryService.listDeliveries(query);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET DELIVERY BY ID
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':id')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({
    summary: 'Get delivery details by ID',
    description: 'Returns full delivery details including client and invoice info',
  })
  @ApiParam({ name: 'id', description: 'Delivery UUID' })
  @ApiResponse({ status: 200, description: 'Delivery details' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  async getDeliveryById(@Param('id', ParseUUIDPipe) id: string) {
    return this.deliveryService.getDeliveryById(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE DELIVERY (FROM INVOICE)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({
    summary: 'Create a new delivery for an invoice',
    description: 'Creates a delivery record and generates secure QR code',
  })
  @ApiResponse({ status: 201, description: 'Delivery created with QR code' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async createDelivery(
    @Body() dto: CreateDeliveryDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string; role: string };
    return this.deliveryService.createDelivery(dto, user.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CANCEL DELIVERY
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({
    summary: 'Cancel a pending delivery',
    description: 'Cancels a delivery that has not been validated yet',
  })
  @ApiParam({ name: 'id', description: 'Delivery UUID' })
  @ApiResponse({ status: 200, description: 'Delivery cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel validated delivery' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  async cancelDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDeliveryDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string; role: string };
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.deliveryService.cancelDelivery(
      id,
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }
}
