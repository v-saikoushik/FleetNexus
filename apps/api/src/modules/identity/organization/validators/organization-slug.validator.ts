import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { ORGANIZATION_SLUG_PATTERN } from '../constants/organization.constants';

/**
 * @IsOrganizationSlug — custom validator for organization slugs.
 *
 * Enforces:
 *   - Lowercase alphanumeric characters and hyphens only
 *   - Cannot start or end with a hyphen
 *   - No consecutive hyphens
 *
 * Usage:
 *   @IsOrganizationSlug()
 *   slug: string;
 */
export function IsOrganizationSlug(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isOrganizationSlug',
      target: (object as { constructor: Function }).constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments): boolean {
          if (typeof value !== 'string') return false;
          return ORGANIZATION_SLUG_PATTERN.test(value);
        },
        defaultMessage(_args: ValidationArguments): string {
          return `${_args.property} must be a valid slug: lowercase letters, numbers, and single hyphens (e.g. my-org-name)`;
        },
      },
    });
  };
}
