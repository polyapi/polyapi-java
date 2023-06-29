import { IsIn, ValidationArguments } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { validateObjectValue } from '../../utils';
import { ConfigVariableLevel, ConfigVariableValueConstraints } from './types';

function getMessageFn(message: string) {
  return (validationArguments: ValidationArguments) => `${validationArguments.property} ${message}`;
}

const falseOrNull = 'must be false or null at non instance level.';
const booleanOrUndefined = 'must be boolean';

export class SetTrainingDataGenerationValue {
    @IsIn([false, null, undefined], { message: getMessageFn(falseOrNull) })
    webhooks: false | null;

    @IsIn([false, null, undefined], { message: getMessageFn(falseOrNull) })
    clientFunctions: false | null;

    @IsIn([false, null, undefined], { message: getMessageFn(falseOrNull) })
    serverFunctions: false | null;

    @IsIn([false, null, undefined], { message: getMessageFn(falseOrNull) })
    apiFunctions: false | null;
}

export class SetInstanceTrainingDataGenerationValue {
    @IsIn([false, true, undefined], { message: getMessageFn(booleanOrUndefined) })
    webhooks: boolean;

    @IsIn([false, true, undefined], { message: getMessageFn(booleanOrUndefined) })
    clientFunctions: boolean;

    @IsIn([false, true, undefined], { message: getMessageFn(booleanOrUndefined) })
    serverFunctions: boolean;

    @IsIn([false, true, undefined], { message: getMessageFn(booleanOrUndefined) })
    apiFunctions: boolean;
}

export function validate(value: unknown, constraints: ConfigVariableValueConstraints) {
  const isInstanceLevel = constraints.find(constraint => constraint.level === ConfigVariableLevel.Instance);

  let ValidationClass: any = plainToClass(SetTrainingDataGenerationValue, value);

  if (isInstanceLevel) {
    ValidationClass = plainToClass(SetInstanceTrainingDataGenerationValue, value);
  }

  validateObjectValue(ValidationClass, value);
}
