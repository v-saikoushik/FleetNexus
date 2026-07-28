import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/**
 * DTO for updating an existing user profile.
 * Excludes email and password — those have their own dedicated endpoints
 * (change-email, change-password) with extra verification steps.
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email', 'password', 'passwordConfirm'] as const),
) {}
