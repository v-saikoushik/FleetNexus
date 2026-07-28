/**
 * Organization domain constants.
 */

/** Maximum length for an organization display name. */
export const ORGANIZATION_NAME_MAX_LENGTH = 120;

/** Minimum length for an organization display name. */
export const ORGANIZATION_NAME_MIN_LENGTH = 2;

/** Maximum length for an organization URL slug. */
export const ORGANIZATION_SLUG_MAX_LENGTH = 60;

/** Regex pattern for a valid organization slug (lowercase, hyphens). */
export const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Error message keys used by OrganizationService. */
export const ORGANIZATION_ERRORS = {
  NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  SLUG_TAKEN: 'ORGANIZATION_SLUG_TAKEN',
  NAME_TAKEN: 'ORGANIZATION_NAME_TAKEN',
  INACTIVE: 'ORGANIZATION_INACTIVE',
} as const;
