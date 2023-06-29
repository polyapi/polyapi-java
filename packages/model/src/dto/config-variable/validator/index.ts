import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { validate as validateTrainingDataGeneration } from './training-data-generation';
import { ConfigVariableName } from '../value-types';
import { ConfigVariableValueConstraints } from './types';

export { SetTrainingDataGenerationValue } from './training-data-generation';

export { ConfigVariableLevel, ConfigVariableValueConstraints } from './types';

@ValidatorConstraint({ name: 'ConfigVariableValue' })
export class ConfigVariableValue implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean | Promise<boolean> {
    const constraints = (args.constraints || []) as ConfigVariableValueConstraints;

    const object = args.object as any;

    if (object.name === ConfigVariableName.TrainingDataGeneration) {
      validateTrainingDataGeneration(value, constraints);
    }

    return true;
  }
}
