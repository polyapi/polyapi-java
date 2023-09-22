import { BadRequestException } from '@nestjs/common';
import { ValidatorOptions, validateSync } from 'class-validator';

import { isPlainObjectPredicate } from '@poly/common/utils';

export const validateObjectValue = (validationClass: new (...args: any[]) => any, value: unknown, validatorOptions?: ValidatorOptions) => {
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
};

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
