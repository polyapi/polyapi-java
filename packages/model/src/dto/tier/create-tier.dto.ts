import { IsInt, IsString } from 'class-validator';

export class CreateTierDto {
  @IsString()
  name: string;

  @IsInt()
  maxFunctions: number;

  @IsInt()
  chatQuestionsPerDay: number;

  @IsInt()
  functionCallsPerDay: number;
}
