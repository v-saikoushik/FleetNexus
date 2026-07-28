/**
 * Organization domain interface.
 * Represents the shape of an Organization in the application layer
 * (decoupled from Prisma-generated types).
 *
 * This interface will grow as the Organization model is defined in Prisma.
 */
export interface IOrganization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for the OrganizationRepository contract.
 * Services depend on this interface (Dependency Inversion Principle).
 */
export interface IOrganizationRepository {
  create(data: CreateOrganizationData): Promise<IOrganization>;
  findById(id: string): Promise<IOrganization | null>;
  findBySlug(slug: string): Promise<IOrganization | null>;
  update(id: string, data: UpdateOrganizationData): Promise<IOrganization>;
  softDelete(id: string): Promise<void>;
}

// Data shapes for repository operations (inputs)
export type CreateOrganizationData = Pick<IOrganization, 'name' | 'slug'>;
export type UpdateOrganizationData = Partial<Pick<IOrganization, 'name' | 'isActive'>>;
