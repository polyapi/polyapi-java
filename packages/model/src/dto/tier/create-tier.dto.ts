import { IsInt, IsString, ValidateIf } from 'class-validator';

export class CreateTierDto {
  @IsString()
  name: string;

  @IsInt()
  @ValidateIf((o) => o.maxFunctions !== null)
  maxFunctions: number | null;

  @IsInt()
  @ValidateIf((o) => o.chatQuestionsPerDay !== null)
  chatQuestionsPerDay: number | null;

  @IsInt()
  @ValidateIf((o) => o.functionCallsPerDay !== null)
  functionCallsPerDay: number | null;

  @IsInt()
  @ValidateIf((o) => o.variableCallsPerDay !== null)
  variableCallsPerDay: number | null;

  @IsInt()
  @ValidateIf((o) => o.serverFunctionLimitCpu !== null)
  serverFunctionLimitCpu: number | null;

  @IsInt()
  @ValidateIf((o) => o.serverFunctionLimitMemory !== null)
  serverFunctionLimitMemory: number | null;

  @IsInt()
  @ValidateIf((o) => o.serverFunctionLimitTime !== null)
  serverFunctionLimitTime: number | null;
}
