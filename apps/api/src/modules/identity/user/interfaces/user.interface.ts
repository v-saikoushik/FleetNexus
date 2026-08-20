import type { Role } from '@fleetnexus/shared';

/**
 * User domain interface.
 * Decoupled from Prisma-generated types; mirrors the Prisma User model
 * without exposing passwordHash to the application layer.
 */
export interface IUser {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: Role;
  organizationId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserRepository {
  create(data: CreateUserData): Promise<IUser>;
  findById(id: string): Promise<IUser | null>;
  findByEmail(email: string): Promise<IUser | null>;
  findByPhone(phone: string): Promise<IUser | null>;
  findAllByOrganization(organizationId: string): Promise<IUser[]>;
  update(id: string, data: UpdateUserData): Promise<IUser>;
  softDelete(id: string): Promise<void>;
}

export type CreateUserData = {
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  role?: Role;
  organizationId?: string;
  passwordHash: string;
};

export type UpdateUserData = Partial<
  Pick<IUser, 'firstName' | 'lastName' | 'phone' | 'isActive' | 'role' | 'organizationId'>
>;
