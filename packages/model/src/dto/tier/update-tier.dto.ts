import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateTierDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  maxFunctions?: number | null;

  @IsInt()
  @IsOptional()
  chatQuestionsPerDay?: number | null;

  @IsInt()
  @IsOptional()
  functionCallsPerDay?: number | null;
}
