import { UserKeyDto } from './user-key.dto';
import { Role } from '../../user';

export class UserDto {
  id: string;
  name: string;
  role: Role;
}

export class UserFullDto extends UserDto {
  userKeys: UserKeyDto[];
}
