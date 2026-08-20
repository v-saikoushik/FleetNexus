/**
 * Organization domain constants.
 */

/** Maximum length for an organization display name. */
export const ORGANIZATION_NAME_MAX_LENGTH = 120;

/** Minimum length for an organization display name. */
export const ORGANIZATION_NAME_MIN_LENGTH = 2;

/** Error message keys used by OrganizationService. */
export const ORGANIZATION_ERRORS = {
  NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  NAME_TAKEN: 'ORGANIZATION_NAME_TAKEN',
  INACTIVE: 'ORGANIZATION_INACTIVE',
} as const;
