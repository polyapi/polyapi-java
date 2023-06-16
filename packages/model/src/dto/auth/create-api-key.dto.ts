import { IsNotEmpty, IsOptional } from 'class-validator';
import { Permissions } from '../../permissions';

export class CreateApiKeyDto {
  @IsNotEmpty()
  name: string;
  @IsOptional()
  applicationId?: string;
  @IsOptional()
  userId?: string;
  @IsNotEmpty()
  permissions: Permissions;
}
