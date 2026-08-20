import { SetMetadata } from '@nestjs/common';
import type { Role } from '@fleetnexus/shared';

export const ROLES_KEY = 'roles';

/**
 * @Roles() decorator — declares which roles are permitted to access a route.
 *
 * Must be used with RolesGuard.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('SUPER_ADMIN', 'FACTORY_MANAGER')
 *   @Get('protected')
 *   getProtected() { ... }
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
