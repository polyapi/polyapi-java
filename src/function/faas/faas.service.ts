import { ServerFunctionLimits } from '@poly/model';

export interface ExecuteFunctionResult {
  body: any;
  statusCode: number;
}

export interface FaasService {
  init: () => Promise<void>;
  createFunction: (
    id: string,
    tenantId: string,
    environmentId: string,
    name: string,
    code: string,
    requirements: string[],
    apiKey: string,
    limits: ServerFunctionLimits,
    createFromScratch?: boolean
  ) => Promise<void>;
  executeFunction: (id: string, tenantId: string, environmentId: string, args: any[], headers: Record<string, any>) => Promise<ExecuteFunctionResult>;
  updateFunction: (
    id: string,
    tenantId: string,
    environmentId: string,
    name: string,
    code: string,
    requirements: string[],
    apiKey: string,
    limits: ServerFunctionLimits
  ) => Promise<void>;
  deleteFunction: (id: string, tenantId: string, environmentId: string) => Promise<void>;

  getFunctionName(id: string): string;
}
