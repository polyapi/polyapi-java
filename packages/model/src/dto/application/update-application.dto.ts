import { IsOptional } from 'class-validator';

export class UpdateApplicationDto {
  @IsOptional()
  name?: string;
  @IsOptional()
  description?: string;
}
