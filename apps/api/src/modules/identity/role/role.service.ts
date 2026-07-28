import { Injectable } from '@nestjs/common';
import { RoleRepository } from './role.repository';

/**
 * RoleService — business logic layer for role management.
 *
 * Responsibilities (to be implemented in Sprint 2):
 *   - List all available system roles
 *   - Assign a role to a user within an organization
 *   - Remove a role from a user
 *   - Check if a user has a specific role (for permission guards)
 *
 * Single Responsibility:
 *   - Role CRUD and assignment lives here.
 *   - JWT claims/token logic belongs in AuthService.
 *   - Guard logic belongs in common/guards.
 */
@Injectable()
export class RoleService {
  constructor(private readonly roleRepository: RoleRepository) {}

  // Methods will be implemented in Sprint 2 once Prisma model is defined.
}
