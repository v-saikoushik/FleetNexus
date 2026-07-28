import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';

/**
 * UserModule — manages system users.
 *
 * A User belongs to exactly one Organization.
 * Users are assigned one or more Roles which govern their permissions.
 *
 * Sprint 2 will add:
 *   - Prisma model (User)
 *   - User CRUD endpoints
 *   - Password hashing (bcrypt)
 *   - Email uniqueness enforcement
 */
@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
