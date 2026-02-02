import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicensingService } from './licensing.service';

/**
 * License Guard
 * 
 * Enforces license validation on protected endpoints:
 * - Checks if user has valid license
 * - Blocks write operations in read-only mode
 * - Returns 403 for expired/suspended licenses
 * 
 * Usage:
 * @UseGuards(JwtAuthGuard, LicenseGuard)
 * @LicenseRequired() // or @LicenseRequired({ writeRequired: true })
 */
export const LICENSE_KEY = 'license_required';

export interface LicenseOptions {
  writeRequired?: boolean; // Block if license is in read-only mode
}

export const LicenseRequired = (options?: LicenseOptions) => {
  return (target: any, key?: string, descriptor?: any) => {
    Reflect.defineMetadata(LICENSE_KEY, options || {}, descriptor?.value || target);
    return descriptor || target;
  };
};

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private licensingService: LicensingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<LicenseOptions>(
      LICENSE_KEY,
      context.getHandler(),
    );

    // If no @LicenseRequired decorator, allow access
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    const licenseStatus = await this.licensingService.validateUserLicense(user.sub);

    // Store license status on request for controllers to access
    request.licenseStatus = licenseStatus;

    if (!licenseStatus.valid && !licenseStatus.readOnly) {
      throw new ForbiddenException(licenseStatus.reason || 'Invalid license');
    }

    // Check if write access is required but license is read-only
    if (options.writeRequired && licenseStatus.readOnly) {
      throw new ForbiddenException(
        'License expired - read-only mode. Please renew your subscription.',
      );
    }

    return true;
  }
}

/**
 * Read-Only Guard
 * 
 * Specifically for blocking write operations when license is expired.
 * Use on endpoints that modify data.
 */
@Injectable()
export class ReadOnlyGuard implements CanActivate {
  constructor(private licensingService: LicensingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.sub) {
      return true; // Let auth guard handle this
    }

    const isWriteAllowed = await this.licensingService.isWriteAllowed(user.sub);

    if (!isWriteAllowed) {
      throw new ForbiddenException(
        'License expired - modifications not allowed. Please renew your subscription.',
      );
    }

    return true;
  }
}
