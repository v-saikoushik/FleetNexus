import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';

/**
 * UserService — business logic layer for system users.
 *
 * Responsibilities (to be implemented in Sprint 2):
 *   - Create a new user (with password hashing)
 *   - Find user by ID, email, or organization
 *   - Update user profile
 *   - Soft-deactivate a user
 *   - Look up user by credentials (for auth module consumption)
 *
 * Single Responsibility:
 *   - This service handles user CRUD and lookup only.
 *   - Password hashing strategy belongs here (not in auth).
 *   - JWT issuance belongs in AuthService (not here).
 */
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  // Methods will be implemented in Sprint 2 once Prisma model is defined.
}
