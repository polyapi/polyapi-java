import { IsNotEmpty, IsString, Validate } from 'class-validator';
import { NotContainDots } from '../validators';

export class CreateCustomFunctionDto {
  @IsString()
  @IsNotEmpty()
  @Validate(NotContainDots)
  name: string;
  context?: string;
  @IsNotEmpty()
  code: string;
}
