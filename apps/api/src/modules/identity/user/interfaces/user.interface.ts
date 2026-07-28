/**
 * User domain interface.
 * Represents the shape of a User in the application layer
 * (decoupled from Prisma-generated types).
 */
export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for the UserRepository contract.
 * Services depend on this interface (Dependency Inversion Principle).
 */
export interface IUserRepository {
  create(data: CreateUserData): Promise<IUser>;
  findById(id: string): Promise<IUser | null>;
  findByEmail(email: string): Promise<IUser | null>;
  findAllByOrganization(organizationId: string): Promise<IUser[]>;
  update(id: string, data: UpdateUserData): Promise<IUser>;
  softDelete(id: string): Promise<void>;
}

// Data shapes for repository operations
export type CreateUserData = Pick<IUser, 'email' | 'firstName' | 'lastName' | 'organizationId'> & {
  hashedPassword: string;
};
export type UpdateUserData = Partial<
  Pick<IUser, 'firstName' | 'lastName' | 'isActive' | 'emailVerifiedAt'>
>;
