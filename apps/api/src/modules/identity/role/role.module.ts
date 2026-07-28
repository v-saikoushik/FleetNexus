import { Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { RoleRepository } from './role.repository';

/**
 * RoleModule — manages RBAC roles and permission assignments.
 *
 * Roles are organization-scoped in FleetNexus.
 * A User can have multiple Roles within their Organization.
 *
 * System roles (from @fleetnexus/shared):
 *   ADMIN, FACTORY_MANAGER, UNION_MANAGER, FLEET_OWNER, DRIVER
 *
 * Sprint 2 will add:
 *   - Prisma model (Role, UserRole)
 *   - Role assignment endpoints
 *   - Permission checking utilities
 */
@Module({
  controllers: [RoleController],
  providers: [RoleService, RoleRepository],
  exports: [RoleService],
})
export class RoleModule {}
