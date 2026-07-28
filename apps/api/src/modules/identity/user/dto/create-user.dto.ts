import { IsEmail, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';
import {
  USER_EMAIL_MAX_LENGTH,
  USER_FIRST_NAME_MAX_LENGTH,
  USER_LAST_NAME_MAX_LENGTH,
  USER_PASSWORD_MIN_LENGTH,
  USER_PASSWORD_MAX_LENGTH,
} from '../constants/user.constants';

/**
 * DTO for creating a new user account.
 * Validated by NestJS ValidationPipe.
 *
 * Note: organizationId is intentionally NOT in this DTO.
 * It is resolved from the authenticated session or route context.
 */
export class CreateUserDto {
  @IsEmail()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(USER_FIRST_NAME_MAX_LENGTH)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(USER_LAST_NAME_MAX_LENGTH)
  lastName!: string;

  @IsString()
  @MinLength(USER_PASSWORD_MIN_LENGTH)
  @MaxLength(USER_PASSWORD_MAX_LENGTH)
  password!: string;

  /** Confirmation field — validated by a custom validator in Sprint 2. */
  @IsString()
  @MinLength(USER_PASSWORD_MIN_LENGTH)
  @MaxLength(USER_PASSWORD_MAX_LENGTH)
  @IsOptional()
  passwordConfirm?: string;
}
