import { ArgumentType, Visibility } from '../..';

export interface FunctionArgument {
  key: string;
  name: string;
  description?: string;
  required?: boolean;
  secure?: boolean;
  type: ArgumentType;
  typeSchema?: string;
  typeObject?: object;
  payload?: boolean;
  variable?: string;
  location?: 'url' | 'body' | 'headers' | 'auth';
}

export interface FunctionBasicDto {
  id: string;
  context: string;
  name: string;
  description: string;
  visibility: Visibility;
  enabled?: boolean;
}

export interface FunctionDetailsDto extends FunctionBasicDto {
  arguments: Omit<FunctionArgument, 'location'>[];
}

export interface ApiFunctionDetailsDto extends FunctionDetailsDto {
  enabledRedirect: boolean;
}

export interface FunctionPublicBasicDto extends FunctionBasicDto {
  tenant: string;
  hidden: boolean;
}

export interface FunctionPublicDetailsDto extends FunctionDetailsDto {
  tenant: string;
  hidden: boolean;
}

export interface ApiFunctionPublicDetailsDto extends FunctionPublicDetailsDto {
  enabledRedirect: boolean;
}
