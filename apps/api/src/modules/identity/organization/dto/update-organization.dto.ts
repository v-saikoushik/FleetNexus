import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganizationDto } from './create-organization.dto';

/**
 * DTO for updating an existing organization.
 * All fields from CreateOrganizationDto are optional (PartialType pattern).
 */
export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
