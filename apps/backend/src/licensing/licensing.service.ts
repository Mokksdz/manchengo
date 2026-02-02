import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseStatus, LicenseType, DevicePlatform } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Licensing Service
 * 
 * Core SaaS licensing logic:
 * - License validation (active, not expired, device limit)
 * - Device registration against license
 * - License key generation and activation
 * - Read-only mode enforcement for expired licenses
 * 
 * Security model:
 * - Every user belongs to a company
 * - Company has one active license
 * - License defines max devices and expiry
 * - Expired license = read-only mode
 */
@Injectable()
export class LicensingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validate license for a user
   * Called on login and sync
   * Returns license status and permissions
   */
  async validateUserLicense(userId: string): Promise<{
    valid: boolean;
    readOnly: boolean;
    company: any;
    license: any;
    reason?: string;
  }> {
    // Find user's company
    const companyUser = await this.prisma.companyUser.findFirst({
      where: { userId },
      include: {
        company: {
          include: {
            licenses: {
              where: { status: { in: [LicenseStatus.ACTIVE, LicenseStatus.EXPIRED] } },
              orderBy: { expiresAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!companyUser) {
      return {
        valid: false,
        readOnly: true,
        company: null,
        license: null,
        reason: 'User not associated with any company',
      };
    }

    const company = companyUser.company;
    if (!company.isActive) {
      return {
        valid: false,
        readOnly: true,
        company,
        license: null,
        reason: 'Company account suspended',
      };
    }

    const license = company.licenses[0];
    if (!license) {
      return {
        valid: false,
        readOnly: true,
        company,
        license: null,
        reason: 'No license found for company',
      };
    }

    // Check license status
    const now = new Date();
    const isExpired = license.expiresAt < now;

    if (license.status === LicenseStatus.SUSPENDED || license.status === LicenseStatus.CANCELLED) {
      return {
        valid: false,
        readOnly: true,
        company,
        license,
        reason: `License ${license.status.toLowerCase()}`,
      };
    }

    if (isExpired) {
      // Auto-update status if expired
      await this.prisma.license.update({
        where: { id: license.id },
        data: { status: LicenseStatus.EXPIRED },
      });

      return {
        valid: true,
        readOnly: true, // Expired = read-only mode
        company,
        license: { ...license, status: LicenseStatus.EXPIRED },
        reason: 'License expired - read-only mode',
      };
    }

    return {
      valid: true,
      readOnly: false,
      company,
      license,
    };
  }

  /**
   * Validate and register a device against license
   * Called when device first connects
   */
  async validateDeviceLicense(
    userId: string,
    deviceId: string,
    platform: DevicePlatform,
    deviceName: string,
  ): Promise<{
    valid: boolean;
    readOnly: boolean;
    reason?: string;
  }> {
    const licenseCheck = await this.validateUserLicense(userId);
    
    if (!licenseCheck.valid && !licenseCheck.readOnly) {
      return {
        valid: false,
        readOnly: true,
        reason: licenseCheck.reason,
      };
    }

    if (!licenseCheck.company || !licenseCheck.license) {
      return {
        valid: false,
        readOnly: true,
        reason: 'No valid license',
      };
    }

    const companyId = licenseCheck.company.id;
    const license = licenseCheck.license;

    // Check if device already registered
    const existingDevice = await this.prisma.companyDevice.findUnique({
      where: { companyId_deviceId: { companyId, deviceId } },
    });

    if (existingDevice) {
      // Update last seen
      await this.prisma.companyDevice.update({
        where: { id: existingDevice.id },
        data: { lastSeenAt: new Date() },
      });

      if (!existingDevice.isActive) {
        return {
          valid: false,
          readOnly: true,
          reason: 'Device deactivated by administrator',
        };
      }

      return {
        valid: true,
        readOnly: licenseCheck.readOnly,
      };
    }

    // New device - check device limit
    const activeDeviceCount = await this.prisma.companyDevice.count({
      where: { companyId, isActive: true },
    });

    if (activeDeviceCount >= license.maxDevices) {
      return {
        valid: false,
        readOnly: true,
        reason: `Device limit reached (${license.maxDevices} devices)`,
      };
    }

    // Register new device
    await this.prisma.companyDevice.create({
      data: {
        companyId,
        deviceId,
        platform,
        deviceName,
        lastSeenAt: new Date(),
      },
    });

    return {
      valid: true,
      readOnly: licenseCheck.readOnly,
    };
  }

  /**
   * Generate a unique license key
   */
  generateLicenseKey(): string {
    const bytes = randomBytes(16);
    const key = bytes.toString('hex').toUpperCase();
    // Format: XXXX-XXXX-XXXX-XXXX
    return `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}`;
  }

  /**
   * Activate a license with key
   */
  async activateLicense(licenseKey: string, companyId: string): Promise<any> {
    const license = await this.prisma.license.findUnique({
      where: { licenseKey },
    });

    if (!license) {
      throw new NotFoundException('Invalid license key');
    }

    if (license.companyId !== companyId) {
      throw new ForbiddenException('License key not valid for this company');
    }

    if (license.status !== LicenseStatus.ACTIVE) {
      throw new ForbiddenException(`License is ${license.status.toLowerCase()}`);
    }

    return license;
  }

  /**
   * Create a new company with trial license
   */
  async createCompanyWithTrial(data: {
    name: string;
    email: string;
    taxId?: string;
    address?: string;
    phone?: string;
  }): Promise<{ company: any; license: any }> {
    // Generate company code
    const companyCount = await this.prisma.company.count();
    const code = `MCG-${String(companyCount + 1).padStart(3, '0')}`;

    // Create company
    const company = await this.prisma.company.create({
      data: {
        code,
        name: data.name,
        email: data.email,
        taxId: data.taxId,
        address: data.address,
        phone: data.phone,
      },
    });

    // Create 30-day trial license
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const license = await this.prisma.license.create({
      data: {
        companyId: company.id,
        type: LicenseType.TRIAL,
        status: LicenseStatus.ACTIVE,
        maxDevices: 3,
        startDate: now,
        expiresAt,
        licenseKey: this.generateLicenseKey(),
        features: { exports: true, monitoring: true },
      },
    });

    return { company, license };
  }

  /**
   * Add user to company
   */
  async addUserToCompany(companyId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    await this.prisma.companyUser.upsert({
      where: { companyId_userId: { companyId, userId } },
      create: { companyId, userId, isAdmin },
      update: { isAdmin },
    });
  }

  /**
   * Get company license info
   */
  async getCompanyLicenseInfo(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        licenses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        companyDevices: {
          where: { isActive: true },
        },
        _count: {
          select: { companyUsers: true, companyDevices: true },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const license = company.licenses[0];
    const daysRemaining = license
      ? Math.max(0, Math.ceil((license.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;

    return {
      company: {
        id: company.id,
        code: company.code,
        name: company.name,
        email: company.email,
      },
      license: license
        ? {
            type: license.type,
            status: license.status,
            maxDevices: license.maxDevices,
            usedDevices: company._count.companyDevices,
            expiresAt: license.expiresAt,
            daysRemaining,
            features: license.features,
          }
        : null,
      devices: company.companyDevices.map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        platform: d.platform,
        deviceName: d.deviceName,
        lastSeenAt: d.lastSeenAt,
      })),
    };
  }

  /**
   * Deactivate a device (admin action)
   */
  async deactivateDevice(companyId: string, deviceId: string): Promise<void> {
    await this.prisma.companyDevice.updateMany({
      where: { companyId, deviceId },
      data: { isActive: false },
    });
  }

  /**
   * Check if operation is allowed (for read-only enforcement)
   */
  async isWriteAllowed(userId: string): Promise<boolean> {
    const licenseCheck = await this.validateUserLicense(userId);
    return licenseCheck.valid && !licenseCheck.readOnly;
  }
}
