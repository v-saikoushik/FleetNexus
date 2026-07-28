import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

/**
 * RoleRepository — data access layer for roles.
 *
 * This class is the ONLY place that talks to Prisma for role data.
 *
 * Methods to implement in Sprint 2:
 *   - findAll(): Promise<Role[]>
 *   - assignRoleToUser(userId, role): Promise<UserRole>
 *   - removeRoleFromUser(userId, role): Promise<void>
 *   - getUserRoles(userId): Promise<Role[]>
 *   - userHasRole(userId, role): Promise<boolean>
 */
@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Prisma queries will be added in Sprint 2 once schema models are defined.
}
