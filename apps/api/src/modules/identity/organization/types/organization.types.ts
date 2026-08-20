/**
 * Organization domain type definitions.
 */

/** Unique identifier for an Organization. Branded type for type safety. */
export type OrganizationId = string & { readonly __brand: 'OrganizationId' };

/** Status of an organization in the system. */
export type OrganizationStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/**
 * Slim representation used in list views and related entity references.
 */
export type OrganizationSummary = {
  id: OrganizationId;
  name: string;
  type: string;
  isActive: boolean;
};
