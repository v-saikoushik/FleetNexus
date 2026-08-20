import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ORGANIZATION_TYPES, type OrganizationType } from '@fleetnexus/shared';

class RegisterOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEnum(ORGANIZATION_TYPES)
  type!: OrganizationType;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  /**
   * Join an existing organization by ID.
   */
  @IsOptional()
  @IsString()
  organizationId?: string;

  /**
   * Create a new organization and attach the user to it.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterOrganizationDto)
  organization?: RegisterOrganizationDto;
}
