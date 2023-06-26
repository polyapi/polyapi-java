import { Environment } from '@prisma/client';

export interface SecretServiceProvider {
  init: (environment: Environment) => Promise<void>;
  get: (environmentId: string, key: string) => Promise<any>;
  set: (environmentId: string, key: string, value: any) => Promise<void>;
  delete: (environmentId: string, key: string) => Promise<void>;
  deleteAll: (environmentId: string) => Promise<void>;
}
