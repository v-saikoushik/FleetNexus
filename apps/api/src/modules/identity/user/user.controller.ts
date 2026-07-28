import { Controller } from '@nestjs/common';

/**
 * UserController — HTTP entry point for user management endpoints.
 *
 * Placeholder — no routes implemented yet.
 * Sprint 2 will expose:
 *   POST   /users              — create user (admin or self-registration)
 *   GET    /users/:id          — get user by ID
 *   GET    /users/me           — get current authenticated user
 *   PATCH  /users/:id          — update user profile
 *   DELETE /users/:id          — deactivate user (soft delete)
 */
@Controller('users')
export class UserController {
  // Routes will be added in Sprint 2
}
