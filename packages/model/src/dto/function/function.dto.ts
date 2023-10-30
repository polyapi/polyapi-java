import { Auth } from '../../auth';
import { ArgumentType, FormDataBody, GraphQLBody, UrlencodedBody } from '../../function';
import { Visibility } from '../../specs';

export type ApiFunctionSource = {
  url: string;
  headers: {
      key: string;
      value: string;
  }[];
  method: string;
  body: {
    mode: 'empty';
  } | {
      urlencoded: UrlencodedBody['urlencoded']
  } | {
      formdata: FormDataBody['formdata']
  } | {
      raw: string
  } | {
    graphql: Omit<GraphQLBody['graphql'], 'variables'>
  };
  auth: Auth;
}

export interface FunctionArgument<T extends string | Record<string, any> = string> {
  key: string;
  name: string;
  description?: string;
  required?: boolean;
  secure?: boolean;
  type: ArgumentType;
  typeSchema?: T;
  typeObject?: object;
  payload?: boolean;
  variable?: string;
  location?: 'url' | 'body' | 'headers' | 'auth';
  removeIfNotPresentOnExecute?: boolean;
}

export interface FunctionBasicDto {
  id: string;
  context: string;
  name: string;
  description: string;
  visibility: Visibility;
  enabled?: boolean;
  logsEnabled?: boolean;
}

export interface TrainingFunctionDto extends FunctionBasicDto{
  traceId?: string;
}

export interface FunctionDetailsDto extends FunctionBasicDto {
  arguments: Omit<FunctionArgument<Record<string, any>>, 'location'>[];
  source?: ApiFunctionSource
  returnType: string | null;
  returnTypeSchema?: Record<string, any>;
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

export interface CreateServerCustomFunctionResponseDto extends FunctionDetailsDto {
  traceId?: string;
}
