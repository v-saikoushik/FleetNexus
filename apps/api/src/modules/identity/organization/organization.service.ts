import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRepository } from './organization.repository';
import type {
  CreateOrganizationData,
  IOrganization,
  UpdateOrganizationData,
} from './interfaces/organization.interface';
import { ORGANIZATION_ERRORS } from './constants/organization.constants';

/**
 * OrganizationService — business logic for organizations.
 */
@Injectable()
export class OrganizationService {
  constructor(private readonly organizationRepository: OrganizationRepository) {}

  create(data: CreateOrganizationData): Promise<IOrganization> {
    return this.organizationRepository.create(data);
  }

  async findByIdOrThrow(id: string): Promise<IOrganization> {
    const org = await this.organizationRepository.findById(id);
    if (!org) {
      throw new NotFoundException(ORGANIZATION_ERRORS.NOT_FOUND);
    }
    return org;
  }

  update(id: string, data: UpdateOrganizationData): Promise<IOrganization> {
    return this.organizationRepository.update(id, data);
  }

  softDelete(id: string): Promise<void> {
    return this.organizationRepository.softDelete(id);
  }
}
