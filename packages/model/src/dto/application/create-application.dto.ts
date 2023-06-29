import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreateApplicationDto {
  @IsNotEmpty()
  name: string;

  @IsOptional()
  description?: string;
}
