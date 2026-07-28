import { IsString, MaxLength, MinLength, Matches, IsOptional } from 'class-validator';
import {
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_NAME_MIN_LENGTH,
  ORGANIZATION_SLUG_MAX_LENGTH,
  ORGANIZATION_SLUG_PATTERN,
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

  /**
   * URL-safe slug for the organization.
   * If not provided, will be auto-generated from the name.
   */
  @IsOptional()
  @IsString()
  @MaxLength(ORGANIZATION_SLUG_MAX_LENGTH)
  @Matches(ORGANIZATION_SLUG_PATTERN, {
    message: 'Slug must be lowercase alphanumeric with hyphens (e.g. my-org)',
  })
  slug?: string;
}
