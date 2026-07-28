import { Injectable } from '@nestjs/common';
import { OrganizationRepository } from './organization.repository';

/**
 * OrganizationService — business logic layer for organizations.
 *
 * Responsibilities (to be implemented in Sprint 2):
 *   - Create a new organization (with validation, slug generation)
 *   - Find organization by ID or slug
 *   - Update organization settings
 *   - Soft-deactivate an organization
 *
 * Single Responsibility: This service only handles organization domain logic.
 * It does NOT handle user assignment — that belongs to UserService.
 */
@Injectable()
export class OrganizationService {
  constructor(private readonly organizationRepository: OrganizationRepository) {}

  // Methods will be implemented in Sprint 2 once Prisma model is defined.
}
