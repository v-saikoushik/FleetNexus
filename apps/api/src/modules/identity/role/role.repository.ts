import { Injectable } from '@nestjs/common';
import { ROLES, type Role } from '@fleetnexus/shared';

/**
 * RoleRepository — thin helper around the Role enum.
 * No separate roles/permissions tables in the current schema.
 */
@Injectable()
export class RoleRepository {
  findAll(): Role[] {
    return [...ROLES];
  }
}
