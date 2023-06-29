import { IsEnum, IsNotEmpty, Validate } from 'class-validator';
import { ConfigVariableLevel, ConfigVariableValue, ConfigVariableValueConstraints } from './validator';
import { ConfigVariableName } from './value-types';

export { SetTrainingDataGenerationValue } from './validator';

export class SetConfigVariableDto {
  @IsNotEmpty()
  @IsEnum(ConfigVariableName)
  name: string;

  @IsNotEmpty()
  @Validate(ConfigVariableValue)
  value: unknown;
}

export class SetInstanceConfigVariableDto extends SetConfigVariableDto {
  @Validate(ConfigVariableValue, [{ level: ConfigVariableLevel.Instance }] as ConfigVariableValueConstraints)
  value: unknown;
}
