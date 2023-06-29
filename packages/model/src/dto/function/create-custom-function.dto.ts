import { IsNotEmpty, IsOptional, IsString, Validate } from 'class-validator';
import { ContextIdentifier, NameIdentifier } from '../validators';

export class CreateCustomFunctionDto {
  @IsString()
  @IsNotEmpty()
  @Validate(NameIdentifier)
  name: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsString()
  @Validate(ContextIdentifier)
  context?: string;

  @IsNotEmpty()
  code: string;
}
