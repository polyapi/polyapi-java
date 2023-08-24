import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateTierDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  maxFunctions?: number;

  @IsInt()
  @IsOptional()
  chatQuestionsPerDay?: number;

  @IsInt()
  @IsOptional()
  functionCallsPerDay?: number;
}
