import { Injectable } from '@nestjs/common';
import { ROLES, type Role } from '@fleetnexus/shared';

/**
 * RoleService — simple RBAC helpers.
 * Roles are modeled as a Prisma enum on User (no separate roles table).
 */
@Injectable()
export class RoleService {
  listRoles(): Role[] {
    return [...ROLES];
  }

  isValidRole(role: string): role is Role {
    return (ROLES as readonly string[]).includes(role);
  }

  userHasRole(userRole: Role, required: Role | Role[]): boolean {
    const requiredList = Array.isArray(required) ? required : [required];
    return requiredList.includes(userRole);
  }
}
