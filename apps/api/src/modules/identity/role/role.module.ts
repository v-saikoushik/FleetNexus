import { Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { RoleRepository } from './role.repository';

/**
 * RoleModule — simple RBAC helpers around the Role enum on User.
 *
 * System roles (from @fleetnexus/shared):
 *   SUPER_ADMIN, FACTORY_MANAGER, UNION_MANAGER, FLEET_OWNER, DRIVER
 *
 * No separate permissions tables in the current foundation.
 */
@Module({
  controllers: [RoleController],
  providers: [RoleService, RoleRepository],
  exports: [RoleService],
})
export class RoleModule {}
