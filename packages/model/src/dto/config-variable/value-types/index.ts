import { ConfigVariable } from '@prisma/client';

/**
 * Utility type for typing config-variables if you need it.
 */
export type ParsedConfigVariable<T = string> = Omit<ConfigVariable, 'value'> & { value: T };

export enum ConfigVariableName {
    OpenAIKeywordSimilarityThreshold = 'OpenAIKeywordSimilarityThreshold',
    OpenAIFunctionMatchLimit = 'OpenAIFunctionMatchLimit',
    OpenAIExtractKeywordsTemperature = 'OpenAIExtractKeywordsTemperature',
    TrainingDataGeneration = 'TrainingDataGeneration'
}

export class TrainingDataGeneration {
  webhooks: boolean | null;
  clientFunctions: boolean | null;
  serverFunctions: boolean | null;
  apiFunctions: boolean | null;
}
