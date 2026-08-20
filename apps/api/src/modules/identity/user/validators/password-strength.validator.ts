import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * @IsStrongPassword — custom validator for password strength.
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isStrongPassword',
      target: (object as { constructor: (...args: unknown[]) => unknown }).constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const hasUppercase = /[A-Z]/.test(value);
          const hasLowercase = /[a-z]/.test(value);
          const hasDigit = /\d/.test(value);
          const hasSpecial = /[^A-Za-z0-9]/.test(value);
          return hasUppercase && hasLowercase && hasDigit && hasSpecial;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must contain at least one uppercase letter, one lowercase letter, one digit, and one special character`;
        },
      },
    });
  };
}
