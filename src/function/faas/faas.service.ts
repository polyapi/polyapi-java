import { ServerFunctionLimits } from '@poly/model';

export interface FaasFunctionResult {
  status: 'deployed' | 'deploying';
  message?: string;
  waitForDeploy?: Promise<void>;
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
    limits: ServerFunctionLimits
  ) => Promise<void>;
  executeFunction: (id: string, tenantId: string, environmentId: string, args: any[], headers: Record<string, any>) => Promise<any>;
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
}
