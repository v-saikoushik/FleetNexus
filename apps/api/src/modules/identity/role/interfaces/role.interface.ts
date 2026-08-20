import { ROLES, type Role } from '@fleetnexus/shared';

/**
 * Role domain interface.
 * Roles are a fixed enum assigned directly on User — no join table yet.
 */
export interface IRole {
  name: Role;
  description: string;
}

export interface IRoleRepository {
  findAll(): Role[];
}

/** All valid system roles (re-exported from shared for convenience). */
export { ROLES };
export type { Role };
