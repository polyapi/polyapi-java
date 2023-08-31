import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ async: false })
export class PublicNamespaceConstraint implements ValidatorConstraintInterface {
  validate(text: string | null): boolean {
    if (!text) {
      return true;
    }

    const regex = /^[A-Z]{2,4}$/;
    return regex.test(text);
  }

  defaultMessage(): string {
    return 'String must be 2-4 uppercase letters.';
  }
}

export const IsValidPublicNamespace = (validationOptions?: ValidationOptions) =>
  (object: any, propertyName: string) => {
    registerDecorator({
      name: 'isUppercaseWithLength',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: PublicNamespaceConstraint,
    });
  };
