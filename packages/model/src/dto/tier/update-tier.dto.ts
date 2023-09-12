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

  @IsInt()
  @IsOptional()
  variableCallsPerDay?: number | null;

  @IsInt()
  @IsOptional()
  serverFunctionLimitCpu?: number | null;

  @IsInt()
  @IsOptional()
  serverFunctionLimitMemory?: number | null;

  @IsInt()
  @IsOptional()
  serverFunctionLimitTime?: number | null;
}
