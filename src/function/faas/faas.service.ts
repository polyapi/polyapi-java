import { ServerFunctionLimits, FunctionLog } from '@poly/model';

export interface ExecuteFunctionResult {
  body: any;
  statusCode: number;
}

export interface FaasLogsService {
  getLogs: (functionId: string, keyword: string | undefined, hours: number | undefined, limit: number | undefined) => Promise<FunctionLog[]>;
  deleteLogs: (functionId: string) => Promise<void>;
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
  ) => Promise<void>;
  executeFunction: (
    id: string,
    tenantId: string,
    args: any[],
    headers: Record<string, any>,
    logsEnabled: boolean,
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
  ) => Promise<void>;
  deleteFunction: (id: string, tenantId: string, environmentId: string) => Promise<void>;

  getFunctionName(id: string): string;
}
