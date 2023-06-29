import { Body, Variables, Header, Auth, Method } from '../..';
import { IsNotEmpty, IsOptional, IsString, Validate } from 'class-validator';

import { ContextIdentifier, NameIdentifier } from './../validators';

export class CreateApiFunctionDto {
  @IsString()
  @Validate(NameIdentifier)
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

  body: Body;
  response: any;
  variables?: Variables;
  statusCode: number;
  templateHeaders: Header[];
  templateAuth?: Auth;
  method: Method;
  @IsNotEmpty()
  templateUrl: string;

  templateBody: Body;
  @IsOptional()
  @IsString()
  id?: string;
}
