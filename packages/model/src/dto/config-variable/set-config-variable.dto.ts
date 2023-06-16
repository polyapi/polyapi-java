import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum ConfigVariableName {
  OpenAIKeywordSimilarityThreshold = 'OpenAIKeywordSimilarityThreshold',
  OpenAIFunctionMatchLimit = 'OpenAIFunctionMatchLimit',
  OpenAIExtractKeywordsTemperature = 'OpenAIExtractKeywordsTemperature',
}

export class SetConfigVariableDto {
  @IsNotEmpty()
  @IsEnum(ConfigVariableName)
  name: string;
  @IsNotEmpty()
  @IsString()
  value: string;
}
