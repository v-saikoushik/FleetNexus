import type { OrganizationType } from '@fleetnexus/shared';

/**
 * Organization domain interface.
 * Decoupled from Prisma-generated types; mirrors the Prisma Organization model.
 */
export interface IOrganization {
  id: string;
  name: string;
  type: OrganizationType;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrganizationRepository {
  create(data: CreateOrganizationData): Promise<IOrganization>;
  findById(id: string): Promise<IOrganization | null>;
  update(id: string, data: UpdateOrganizationData): Promise<IOrganization>;
  softDelete(id: string): Promise<void>;
}

export type CreateOrganizationData = {
  name: string;
  type: OrganizationType;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
};

export type UpdateOrganizationData = Partial<
  Pick<
    IOrganization,
    'name' | 'email' | 'phone' | 'address' | 'city' | 'state' | 'country' | 'isActive'
  >
>;
