import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { validate as validateTrainingDataGeneration } from './training-data-generation';
import { validate as validatePublicVisibility } from './public-visibility';
import { validate as validateDefaultTier } from './default-tier';
import { validate as validateDefaultTos } from './default-tos';
import { validate as validateJobs } from './jobs';
import { ConfigVariableName } from '../value-types';
import { ConfigVariableValueConstraints } from './types';

export * from './public-visibility';

export { DefaultTierValue } from './default-tier';
export { DefaultTosValue } from './default-tos';
export { SetTrainingDataGenerationValue } from './training-data-generation';
export { Jobs } from './jobs';
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
      case ConfigVariableName.DefaultTos:
        validateDefaultTos(value);
        break;
      case ConfigVariableName.Jobs:
        validateJobs(value);
        break;
    }

    return true;
  }
}
