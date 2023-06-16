import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum ConfigVariableName {
  openai_keyword_similarity_threshold = 'openai_keyword_similarity_threshold',
  openai_function_match_limit = 'openai_function_match_limit',
  openai_extract_keywords_temperature = 'openai_extract_keywords_temperature',
}

export class SetConfigVariableDto {
  @IsNotEmpty()
  @IsEnum(ConfigVariableName)
  name: string;
  @IsNotEmpty()
  @IsString()
  value: string;
}
