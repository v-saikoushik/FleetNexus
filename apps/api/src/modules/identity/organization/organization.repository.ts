import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

/**
 * OrganizationRepository — data access layer for organizations.
 *
 * This class is the ONLY place that talks to Prisma for organization data.
 * Services must go through this repository — never call PrismaService directly.
 *
 * Follows the Repository pattern (interface segregation):
 *   - Raw Prisma types stay here; services receive domain types
 *
 * Methods to implement in Sprint 2:
 *   - create(data): Promise<Organization>
 *   - findById(id): Promise<Organization | null>
 *   - findBySlug(slug): Promise<Organization | null>
 *   - update(id, data): Promise<Organization>
 *   - softDelete(id): Promise<void>
 */
@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Prisma queries will be added in Sprint 2 once schema models are defined.
}
