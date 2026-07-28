/**
 * User domain constants.
 */

export const USER_EMAIL_MAX_LENGTH = 254; // RFC 5321
export const USER_FIRST_NAME_MAX_LENGTH = 100;
export const USER_LAST_NAME_MAX_LENGTH = 100;
export const USER_PASSWORD_MIN_LENGTH = 8;
export const USER_PASSWORD_MAX_LENGTH = 72; // bcrypt max

/** Error message keys used by UserService. */
export const USER_ERRORS = {
  NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_TAKEN: 'USER_EMAIL_TAKEN',
  INACTIVE: 'USER_INACTIVE',
  EMAIL_NOT_VERIFIED: 'USER_EMAIL_NOT_VERIFIED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
} as const;

/** DI injection tokens. */
export const USER_REPOSITORY_TOKEN = 'USER_REPOSITORY';
