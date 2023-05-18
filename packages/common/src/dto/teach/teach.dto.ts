import { Body, Variables, Header, Auth, Method } from '../..';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TeachDto {
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
