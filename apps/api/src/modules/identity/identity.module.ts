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
 *   - RoleModule          (simple RBAC enum helpers)
 *
 * Authentication / JWT lives in AuthModule. Full CRUD HTTP APIs can grow later.
 */
@Module({
  imports: [OrganizationModule, UserModule, RoleModule],
  exports: [OrganizationModule, UserModule, RoleModule],
})
export class IdentityModule {}
