import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, Validate } from 'class-validator';
import { ContextIdentifier, NameIdentifier } from '../validators';
import { FunctionArgument } from './function.dto';

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
  language?: string;

  @IsOptional()
  typeSchemas?: Record<string, any>;

  @IsOptional()
  @IsString()
  returnType?: string;

  @IsOptional()
  @IsObject()
  returnTypeSchema?: Record<string, any>;

  @IsOptional()
  arguments?: FunctionArgument[];

  @IsOptional()
  @IsBoolean()
  logsEnabled?: boolean;
}

export class CreateClientCustomFunctionDto extends CreateCustomFunctionDto {
}

export class CreateServerCustomFunctionDto extends CreateCustomFunctionDto {
}
