import { IsNotEmpty, IsOptional } from 'class-validator';
import { Permissions } from '../../permissions';

export class UpdateApiKeyDto {
  @IsOptional()
  name?: string;
  @IsOptional()
  permissions?: Permissions;
}
