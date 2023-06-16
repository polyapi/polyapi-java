import { IsOptional, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  name?: string;
  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: string;
}
