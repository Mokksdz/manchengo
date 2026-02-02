import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Fail-closed: if no @Roles decorator, deny access by default
    // Endpoints MUST explicitly declare which roles can access them
    if (!requiredRoles) {
      const handler = context.getHandler().name;
      const controller = context.getClass().name;
      this.logger.error(
        `SECURITY: Endpoint ${controller}.${handler} has no @Roles() decorator — access DENIED (fail-closed)`,
      );
      throw new ForbiddenException(
        'Accès non configuré — contactez l\'administrateur',
      );
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Accès non autorisé pour ce rôle');
    }

    return true;
  }
}
