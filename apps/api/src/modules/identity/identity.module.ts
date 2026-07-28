import { Module } from '@nestjs/common';
import { OrganizationModule } from './organization/organization.module';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';

/**
 * IdentityModule — root module for the identity domain.
 *
 * Composes:
 *   - OrganizationModule  (multi-tenancy root entity)
 *   - UserModule          (system users)
 *   - RoleModule          (RBAC roles and permissions)
 *
 * This module is intentionally infrastructure-only.
 * No controllers, no Prisma models, no authentication yet.
 * Business logic will be implemented in Sprint 2.
 */
@Module({
  imports: [OrganizationModule, UserModule, RoleModule],
  exports: [OrganizationModule, UserModule, RoleModule],
})
export class IdentityModule {}
