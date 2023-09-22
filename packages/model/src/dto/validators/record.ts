import { ValidationOptions, registerDecorator } from 'class-validator';
import { isPlainObject } from 'lodash';

/**
 * Intended to validate Records on JSON structures, for that reason you only have to provide value type and not index type
 * since in JSON all indexes will be string.
 */
export const Record = (opts: {
  type: 'string',
  nullable: boolean
} = {
  nullable: false,
  type: 'string',
}, validationOptions?: ValidationOptions) => {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'Record',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!isPlainObject(value)) {
            return false;
          }

          return !Object.values(value).some(currentValue => {
            if (opts.nullable && currentValue === null) {
              return false;
            }

            if (opts.type === 'string') {
              return typeof currentValue !== 'string';
            }

            return false;
          });
        },
      },
    });
  };
};
