import { ConfigVariable } from '@prisma/client';

export * from './training-data-generation';
export * from './config-variable-name';

export type ParsedConfigVariable<T = string> = Omit<ConfigVariable, 'value'> & { value: T };