import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateEnvironmentDto {
  @IsOptional()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsBoolean()
  logsDefault?: boolean;
}
