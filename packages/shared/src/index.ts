/**
 * Shared constants and types for FleetNexus.
 * Keep this package free of framework-specific dependencies.
 * Used by both backend (NestJS) and frontend (React).
 */

export const APP_NAME = 'FleetNexus' as const;

// ─── Role System ─────────────────────────────────────────────────────────────

export const ROLES = [
  'SUPER_ADMIN',
  'FACTORY_MANAGER',
  'UNION_MANAGER',
  'FLEET_OWNER',
  'DRIVER',
] as const;

export type Role = (typeof ROLES)[number];

// ─── Organization Types ──────────────────────────────────────────────────────

export const ORGANIZATION_TYPES = ['FACTORY', 'UNION', 'FLEET_OWNER'] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

// ─── API Response Shapes ─────────────────────────────────────────────────────

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Pagination ───────────────────────────────────────────────────────────────

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = ApiSuccessResponse<T[]> & {
  meta: PaginationMeta;
};
