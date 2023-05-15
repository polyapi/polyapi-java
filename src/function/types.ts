import { ApiFunction } from '@prisma/client';

export type ApiFunctionArguments = Pick<ApiFunction, 'url' | 'headers' | 'body' | 'auth' | 'argumentsMetadata'>;