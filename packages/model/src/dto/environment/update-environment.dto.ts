import { IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateEnvironmentDto {
  @IsOptional()
  @IsNotEmpty()
  name: string;
}
