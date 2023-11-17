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

  @IsOptional()
  typeSchemas?: Record<string, any>;

}

export class CreateClientCustomFunctionDto extends CreateCustomFunctionDto {
}

export class CreateServerCustomFunctionDto extends CreateCustomFunctionDto {
}
