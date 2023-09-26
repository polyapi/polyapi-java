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
  arguments: Omit<FunctionArgument<Record<string, any>>, 'location'>[];
  source?: ApiFunctionSource
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
