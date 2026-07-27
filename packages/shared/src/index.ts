/**
 * Shared constants and types for FleetNexus.
 * Keep this package free of framework-specific dependencies.
 */

export const APP_NAME = 'FleetNexus' as const;

export const ROLES = [
  'ADMIN',
  'FACTORY_MANAGER',
  'UNION_MANAGER',
  'FLEET_OWNER',
  'DRIVER',
] as const;

export type Role = (typeof ROLES)[number];

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
