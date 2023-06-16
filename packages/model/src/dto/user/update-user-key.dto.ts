import { IsNotEmpty } from 'class-validator';
import { Permissions } from '../../permissions';

export class UpdateUserKeyDto {
  @IsNotEmpty()
  permissions: Permissions;
}
