import { ROLES, Role } from '@fleetnexus/shared';

/**
 * Role domain interface.
 * Represents a role assignment record in the application layer.
 */
export interface IRole {
  id: string;
  name: Role;
  description: string;
}

/**
 * Role assignment record linking a User to a Role.
 */
export interface IUserRole {
  id: string;
  userId: string;
  role: Role;
  organizationId: string;
  assignedAt: Date;
  assignedById: string;
}

/**
 * Interface for the RoleRepository contract.
 */
export interface IRoleRepository {
  findAll(): Promise<IRole[]>;
  assignRoleToUser(userId: string, role: Role, organizationId: string, assignedById: string): Promise<IUserRole>;
  removeRoleFromUser(userId: string, role: Role, organizationId: string): Promise<void>;
  getUserRoles(userId: string): Promise<Role[]>;
  userHasRole(userId: string, role: Role): Promise<boolean>;
}

/** All valid system roles (re-exported from shared for convenience). */
export { ROLES, Role };
