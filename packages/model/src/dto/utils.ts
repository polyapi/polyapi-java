import { BadRequestException } from '@nestjs/common';
import { ValidatorOptions, validateSync } from 'class-validator';
import { isPlainObject } from 'lodash';

function isPlainObjectPredicate(value: unknown): value is object {
  return isPlainObject(value);
}

export function validateObjectValue(validationClass: new (...args: any[]) => any, value: unknown, validatorOptions?: ValidatorOptions) {
  if (!isPlainObjectPredicate(value)) {
    throw new BadRequestException(['value must be an object']);
  }

  const errors = validateSync(validationClass, {
    whitelist: true,
    forbidNonWhitelisted: true,
    ...validatorOptions,
  });

  const flattenErrors = errors.map(error => {
    return Object.values(error.constraints || {});
  }).flat();

  if (flattenErrors.length) {
    throw new BadRequestException(flattenErrors);
  }
}
