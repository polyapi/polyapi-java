import { IntrospectionQuery } from 'graphql';
import { PostmanBody, Variables, Header, Auth, Method } from '../..';
import { IsNotEmpty, IsObject, IsOptional, IsString, Validate } from 'class-validator';

import { ContextIdentifier, NameIdentifier } from './../validators';

export class CreateApiFunctionDto {
  @IsString()
  @IsOptional()
  requestName: string;

  @IsOptional()
  @IsString()
  @Validate(NameIdentifier)
  name?: string;

  @IsOptional()
  @IsString()
  @Validate(ContextIdentifier)
  context?: string;

  description?: string;
  payload?: string;
  @IsNotEmpty()
  url: string;

  body: PostmanBody;
  response: any;
  variables?: Variables;
  statusCode: number;
  templateHeaders: Header[];
  templateAuth?: Auth;
  method: Method;
  @IsNotEmpty()
  templateUrl: string;

  templateBody: PostmanBody;
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsObject()
  introspectionResponse: IntrospectionQuery | null;
}
