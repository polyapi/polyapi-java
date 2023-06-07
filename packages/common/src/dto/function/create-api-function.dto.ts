import { Body, Variables, Header, Auth, Method, PostmanUrl } from '../..';
import { IsNotEmpty, IsObject, IsOptional, IsString, Validate } from 'class-validator';

import { NotContainDots } from './../validators'

export class CreateApiFunctionDto {
  @IsString()
  @Validate(NotContainDots)
  requestName: string;
  @IsOptional()
  @IsString()
  @Validate(NotContainDots)
  name?: string;
  context?: string;
  description?: string;
  payload?: string;
  @IsNotEmpty()
  url: string;
  body: Body;
  response: any;
  variables?: Variables;
  statusCode: number;
  templateHeaders: Header[];
  templateAuth?: Auth;
  method: Method;
  @IsNotEmpty()
  @IsObject()
  templateUrl: PostmanUrl;
  templateBody: Body;
  @IsOptional()
  @IsString()
  id?: string;
}
