import { IsEnum, IsNotEmpty, Validate } from 'class-validator';
import { ConfigVariableValue } from './validator';
import { ConfigVariableName } from './value-types';

export { SetTrainingDataGenerationValue } from './validator'


export class SetConfigVariableDto {
  @IsNotEmpty()
  @IsEnum(ConfigVariableName)
  name: string;
  @IsNotEmpty()
  @Validate(ConfigVariableValue)
  value: unknown;
}
