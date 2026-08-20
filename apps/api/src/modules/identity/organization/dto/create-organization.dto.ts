import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ORGANIZATION_TYPES, type OrganizationType } from '@fleetnexus/shared';
import {
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_NAME_MIN_LENGTH,
} from '../constants/organization.constants';

/**
 * DTO for creating a new organization.
 * Validated automatically by NestJS ValidationPipe.
 */
export class CreateOrganizationDto {
  @IsString()
  @MinLength(ORGANIZATION_NAME_MIN_LENGTH)
  @MaxLength(ORGANIZATION_NAME_MAX_LENGTH)
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

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;
}
