/**
 * Organization domain type definitions.
 * Utility types specific to the Organization feature.
 */

/** Unique identifier for an Organization. Branded type for type safety. */
export type OrganizationId = string & { readonly __brand: 'OrganizationId' };

/** Status of an organization in the system. */
export type OrganizationStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/**
 * Slim representation used in list views and related entity references.
 * Avoids over-fetching full Organization records.
 */
export type OrganizationSummary = {
  id: OrganizationId;
  name: string;
  slug: string;
  status: OrganizationStatus;
};
