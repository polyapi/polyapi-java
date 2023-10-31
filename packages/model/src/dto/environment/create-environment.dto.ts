import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateEnvironmentDto {
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsBoolean()
  logsDefault?: boolean;
}
