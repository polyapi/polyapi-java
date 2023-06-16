import { IsNotEmpty } from 'class-validator';

export class CreateAuthFunctionDto {
  @IsNotEmpty()
  name: string;
  context?: string;
  description?: string;
  audienceRequired?: boolean;
  @IsNotEmpty()
  authUrl: string;
  @IsNotEmpty()
  accessTokenUrl: string;
  @IsNotEmpty()
  revokeUrl: string;
}
