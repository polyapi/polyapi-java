import { Body, Variables, Header, Auth, Method } from '../..';
import { IsNotEmpty, IsOptional, IsString, Validate } from 'class-validator';

import { NotContainDots } from './../validators'

export class TeachDto {
  @Validate(NotContainDots)
  name: string;
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
