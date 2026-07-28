import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

/**
 * UserRepository — data access layer for users.
 *
 * This class is the ONLY place that talks to Prisma for user data.
 * Services must go through this repository — never call PrismaService directly.
 *
 * Methods to implement in Sprint 2:
 *   - create(data): Promise<User>
 *   - findById(id): Promise<User | null>
 *   - findByEmail(email): Promise<User | null>
 *   - findAllByOrganization(orgId): Promise<User[]>
 *   - update(id, data): Promise<User>
 *   - softDelete(id): Promise<void>
 */
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Prisma queries will be added in Sprint 2 once schema models are defined.
}
