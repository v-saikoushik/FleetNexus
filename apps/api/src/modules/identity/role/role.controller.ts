import { Controller } from '@nestjs/common';

/**
 * RoleController — HTTP entry point for role management endpoints.
 *
 * Placeholder — no routes implemented yet.
 * Sprint 2 will expose:
 *   GET    /roles                 — list all system roles
 *   POST   /users/:id/roles       — assign role to user
 *   DELETE /users/:id/roles/:role — remove role from user
 *   GET    /users/:id/roles       — list roles for a user
 */
@Controller('roles')
export class RoleController {
  // Routes will be added in Sprint 2
}
