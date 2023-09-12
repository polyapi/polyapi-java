export class TierDto {
  id: string;
  name: string;
  maxFunctions: number | null;
  chatQuestionsPerDay: number | null;
  functionCallsPerDay: number | null;
  variableCallsPerDay: number | null;
  serverFunctionLimitCpu: number | null;
  serverFunctionLimitMemory: number | null;
  serverFunctionLimitTime: number | null;
}
