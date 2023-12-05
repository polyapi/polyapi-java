import { ServerFunctionLimits, FunctionLog } from '@poly/model';

export interface ExecuteFunctionResult {
  body: any;
  statusCode: number;
}

export interface FaasLogsService {
  getLogs: (functionId: string, keyword: string | undefined, hours: number | undefined, limit: number | undefined) => Promise<FunctionLog[]>;
}

export interface FaasService {
  init: () => Promise<void>;
  createFunction: (
    id: string,
    tenantId: string,
    environmentId: string,
    name: string,
    code: string,
    language: string,
    requirements: string[],
    apiKey: string,
    limits: ServerFunctionLimits,
    forceCustomImage?: boolean,
    sleep?: boolean | null,
    sleepAfter?: number | null,
    logsEnabled?: boolean,
  ) => Promise<void>;
  executeFunction: (
    id: string,
    functionEnvironmentId: string,
    tenantId: string,
    executionEnvironmentId: string,
    args: any[],
    headers: Record<string, any>
  ) => Promise<ExecuteFunctionResult>;
  updateFunction: (
    id: string,
    tenantId: string,
    environmentId: string,
    name: string,
    code: string,
    language: string,
    requirements: string[],
    apiKey: string,
    limits: ServerFunctionLimits,
    sleep?: boolean | null,
    sleepAfter?: number | null,
    logsEnabled?: boolean,
  ) => Promise<void>;
  deleteFunction: (id: string, tenantId: string, environmentId: string) => Promise<void>;

  getFunctionName(id: string): string;
}
