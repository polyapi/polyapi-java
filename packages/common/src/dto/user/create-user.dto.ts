import { IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  name: string;
  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: string;
}
