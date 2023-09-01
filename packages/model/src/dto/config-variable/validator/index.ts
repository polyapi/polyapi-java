import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { validate as validateTrainingDataGeneration } from './training-data-generation';
import { validate as validatePublicVisibility } from './public-visibility';
import { validate as validateDefaultTier } from './default-tier';
import { ConfigVariableName } from '../value-types';
import { ConfigVariableValueConstraints } from './types';

export * from './public-visibility';

export { DefaultTierValue } from './default-tier';
export { SetTrainingDataGenerationValue } from './training-data-generation';
export { ConfigVariableLevel, ConfigVariableValueConstraints } from './types';

@ValidatorConstraint({ name: 'ConfigVariableValue' })
export class ConfigVariableValue implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean | Promise<boolean> {
    const constraints = (args.constraints || []) as ConfigVariableValueConstraints;

    const object = args.object as any;

    switch (object.name) {
      case ConfigVariableName.TrainingDataGeneration:
        validateTrainingDataGeneration(value, constraints);
        break;
      case ConfigVariableName.PublicVisibility:
        validatePublicVisibility(value);
        break;
      case ConfigVariableName.DefaultTier:
        validateDefaultTier(value);
        break;
    }

    return true;
  }
}
