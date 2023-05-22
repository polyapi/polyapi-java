import { ArgumentType } from '../..';

export interface FunctionArgument {
  key: string;
  name: string;
  required?: boolean;
  secure?: boolean;
  type: ArgumentType;
  typeSchema?: string;
  typeObject?: object;
  payload?: boolean;
  location?: 'url' | 'body' | 'headers' | 'auth';
}

export interface FunctionBasicDto {
  id: string;
  context: string;
  name: string;
  description: string;
}

export interface FunctionDetailsDto extends FunctionBasicDto {
  arguments: FunctionArgument[];
}
