import { IsNotEmpty, IsOptional, IsString, Validate } from 'class-validator';
import { NotContainDots } from '../validators';

export class CreateCustomFunctionDto {
  @IsString()
  @IsNotEmpty()
  @Validate(NotContainDots)
  name: string;
  @IsOptional()
  description?: string;
  @IsOptional()
  context?: string;
  @IsNotEmpty()
  code: string;
}
