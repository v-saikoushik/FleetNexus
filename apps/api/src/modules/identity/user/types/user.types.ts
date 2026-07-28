/**
 * User domain type definitions.
 */

/** Unique identifier for a User. Branded for type safety. */
export type UserId = string & { readonly __brand: 'UserId' };

/** Status of a user account. */
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED';

/**
 * Slim user representation for list views and references.
 * Never includes sensitive fields (password hash, tokens, etc.).
 */
export type UserSummary = {
  id: UserId;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: UserStatus;
};
