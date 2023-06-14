import { IsNotEmpty, IsOptional } from 'class-validator';
import { Permissions } from '../../permissions';

export class CreateUserKeyDto {
  @IsNotEmpty()
  environmentId: string;
  @IsOptional()
  permissions?: Permissions;
}
