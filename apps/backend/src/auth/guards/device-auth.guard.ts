import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityLogService } from '../../security/security-log.service';

/**
 * Device Auth Guard
 * 
 * Enhanced JWT guard that validates:
 * 1. JWT token validity
 * 2. User is not blocked (isActive = true)
 * 3. Device is not revoked (if device_id provided)
 * 
 * Security model:
 * - Server is authoritative
 * - Blocked user = immediate access denial
 * - Revoked device = 403 on next request
 * - Offline usage continues until sync attempt
 */
@Injectable()
export class DeviceAuthGuard extends AuthGuard('jwt') {
  constructor(
    private prisma: PrismaService,
    private securityLog: SecurityLogService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, validate JWT
    const isValidJwt = await super.canActivate(context);
    if (!isValidJwt) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const deviceId = request.headers['x-device-id'] || request.body?.deviceId;
    const ipAddress = request.ip || request.connection?.remoteAddress;

    // Validate user is active
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isActive: true },
    });

    if (!dbUser || !dbUser.isActive) {
      await this.securityLog.logAccessDenied(
        user.sub,
        deviceId,
        request.path,
        'User blocked',
        ipAddress,
      );
      throw new ForbiddenException('Compte utilisateur bloqué');
    }

    // Validate device if provided
    if (deviceId) {
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
        select: { isActive: true, userId: true },
      });

      if (device) {
        // Device exists, check status
        if (!device.isActive) {
          await this.securityLog.logAccessDenied(
            user.sub,
            deviceId,
            request.path,
            'Device revoked',
            ipAddress,
          );
          throw new ForbiddenException('Appareil révoqué');
        }

        // Check device belongs to user
        if (device.userId !== user.sub) {
          await this.securityLog.logAccessDenied(
            user.sub,
            deviceId,
            request.path,
            'Device belongs to different user',
            ipAddress,
          );
          throw new ForbiddenException('Appareil non autorisé');
        }
      }
      // If device doesn't exist, it will be registered on sync
    }

    // Attach device ID to request for use in controllers
    request.deviceId = deviceId;

    return true;
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Token invalide ou expiré');
    }
    return user;
  }
}
