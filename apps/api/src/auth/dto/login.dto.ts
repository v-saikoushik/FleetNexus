import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Login with email or phone + password.
 * `identifier` accepts either an email address or a phone number.
 */
export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  identifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
