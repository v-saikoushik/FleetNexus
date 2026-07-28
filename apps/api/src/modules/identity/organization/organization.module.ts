import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationRepository } from './organization.repository';

/**
 * OrganizationModule — manages fleet organizations (multi-tenancy root).
 *
 * An Organization is the top-level tenant entity in FleetNexus.
 * Every User, Fleet, and Trip belongs to exactly one Organization.
 *
 * Sprint 2 will add:
 *   - Prisma model (Organization)
 *   - Create/Read/Update/Deactivate API endpoints
 *   - Organization-scoped request context
 */
@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationRepository],
  exports: [OrganizationService],
})
export class OrganizationModule {}
