import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@fleetnexus/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestUser } from '../strategies/jwt.strategy';

/**
 * RolesGuard — checks that the authenticated user has at least one of
 * the required roles declared via the @Roles() decorator.
 *
 * Must be used AFTER JwtAuthGuard (which populates request.user).
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('SUPER_ADMIN', 'FACTORY_MANAGER')
 *   @Get('admin-resource')
 *   getResource() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles required — allow through
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: RequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
