import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type {
  CreateOrganizationData,
  IOrganization,
  UpdateOrganizationData,
} from './interfaces/organization.interface';

/**
 * OrganizationRepository — data access layer for organizations.
 * Sole Prisma touchpoint for organization data.
 */
@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateOrganizationData): Promise<IOrganization> {
    return this.prisma.organization.create({
      data: {
        name: data.name,
        type: data.type,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country ?? 'IN',
      },
    });
  }

  async findById(id: string): Promise<IOrganization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateOrganizationData): Promise<IOrganization> {
    return this.prisma.organization.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
