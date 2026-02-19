import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LicensingService } from './licensing.service';
import { DevicePlatform } from '@prisma/client';

/**
 * Licensing Controller - SaaS License Management
 *
 * ⚠️ NOTE: These endpoints are NOT exposed in the current frontend.
 * They are designed for:
 * - SaaS multi-tenant license management (future feature)
 * - Device registration and validation
 * - Company/tenant management
 *
 * Routes include:
 * - License validation and status checks
 * - Device registration for offline sync
 * - Company setup and configuration
 */
@ApiTags('Licensing (SaaS - Future)')
@Controller('licensing')
export class LicensingController {
  constructor(private licensingService: LicensingService) {}

  /**
   * GET /api/licensing/status
   * 
   * Check current user's license status
   */
  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get license status for current user' })
  async getLicenseStatus(@Request() req: any) {
    const userId = req.user.sub;
    return this.licensingService.validateUserLicense(userId);
  }

  /**
   * POST /api/licensing/register-device
   * 
   * Register a device against user's license
   */
  @Post('register-device')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register device against license' })
  async registerDevice(
    @Request() req: any,
    @Body() body: {
      deviceId: string;
      platform: DevicePlatform;
      deviceName: string;
    },
  ) {
    const userId = req.user.sub;
    return this.licensingService.validateDeviceLicense(
      userId,
      body.deviceId,
      body.platform,
      body.deviceName,
    );
  }

  /**
   * POST /api/licensing/activate
   * 
   * Activate a license key for a company
   */
  @Post('activate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Activate license key' })
  async activateLicense(
    @Request() req: any,
    @Body() body: { licenseKey: string; companyId: string },
  ) {
    return this.licensingService.activateLicense(body.licenseKey, body.companyId);
  }

  /**
   * GET /api/licensing/company/:id
   * 
   * Get company license info (admin only)
   */
  @Get('company/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get company license info' })
  async getCompanyInfo(@Param('id') id: string) {
    return this.licensingService.getCompanyLicenseInfo(id);
  }

  /**
   * POST /api/licensing/company
   * 
   * Create a new company with trial license (admin only)
   */
  @Post('company')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create company with trial license' })
  async createCompany(
    @Body() body: {
      name: string;
      email: string;
      taxId?: string;
      address?: string;
      phone?: string;
    },
  ) {
    return this.licensingService.createCompanyWithTrial(body);
  }

  /**
   * POST /api/licensing/company/:id/add-user
   * 
   * Add user to company (admin only)
   */
  @Post('company/:id/add-user')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add user to company' })
  async addUserToCompany(
    @Param('id') companyId: string,
    @Body() body: { userId: string; isAdmin?: boolean },
  ) {
    await this.licensingService.addUserToCompany(
      companyId,
      body.userId,
      body.isAdmin || false,
    );
    return { success: true };
  }

  /**
   * POST /api/licensing/company/:id/deactivate-device
   * 
   * Deactivate a device from company (admin only)
   */
  @Post('company/:id/deactivate-device')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Deactivate device from company' })
  async deactivateDevice(
    @Param('id') companyId: string,
    @Body() body: { deviceId: string },
  ) {
    await this.licensingService.deactivateDevice(companyId, body.deviceId);
    return { success: true };
  }

  /**
   * GET /api/licensing/check-write
   * 
   * Check if write operations are allowed (for read-only mode)
   */
  @Get('check-write')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check if write operations allowed' })
  async checkWriteAllowed(@Request() req: any) {
    const userId = req.user.sub;
    const allowed = await this.licensingService.isWriteAllowed(userId);
    return { writeAllowed: allowed };
  }
}
