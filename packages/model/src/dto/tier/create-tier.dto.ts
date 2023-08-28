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
}
