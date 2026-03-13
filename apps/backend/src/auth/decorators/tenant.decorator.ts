import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @TenantId() - Extract the current tenant (companyId) from the request.
 *
 * Usage in controllers:
 *   @Get()
 *   findAll(@TenantId() companyId: string) {
 *     return this.service.findAll(companyId);
 *   }
 *
 * Requires TenantMiddleware to be registered in the module.
 * Returns undefined if user is not associated with any company.
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  },
);
