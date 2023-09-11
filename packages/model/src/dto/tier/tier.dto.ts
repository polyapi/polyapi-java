export class TierDto {
  id: string;
  name: string;
  maxFunctions: number | null;
  chatQuestionsPerDay: number | null;
  functionCallsPerDay: number | null;
  variableCallsPerDay: number | null;
}
