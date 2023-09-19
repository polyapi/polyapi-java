import { ArgumentType, FormDataBody, PostmanGraphQLBody, UrlEncodedBody, Visibility } from '../..';

export type ApiFunctionSource = {
  url: string;
  headers: {
      [key: string]: string
  }[];
  method: string;
  body: {
      urlencoded: UrlEncodedBody['urlencoded']
  } | {
      formdata: FormDataBody['formdata']
  } | {
      raw: string
  } | {
    graphql: PostmanGraphQLBody['graphql'] 
  } | null
}

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
  source?: ApiFunctionSource
}

export interface FunctionPublicBasicDto extends FunctionBasicDto {
  tenant: string;
  hidden: boolean;
}

export interface FunctionPublicDetailsDto extends FunctionDetailsDto {
  tenant: string;
  hidden: boolean;
}
