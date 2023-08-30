import { registerDecorator, ValidationOptions } from 'class-validator';

export const IsOnlyOneOfDefined = (properties: string[], validationOptions?: ValidationOptions) =>
  (object: any, propertyName: string) => {
    registerDecorator({
      name: 'isOnlyOneOfDefined',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any): boolean {
          if (!value) {
            return true;
          }
          return properties
            .filter(key => value[key] !== undefined)
            .length === 1;
        },
        defaultMessage(): string {
          return `exactly one of the following properties must be defined: ${properties.join(', ')}`;
        },
      },
    });
  };
